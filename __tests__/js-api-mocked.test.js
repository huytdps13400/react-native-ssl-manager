/**
 * Behavioral tests for the public JS API with a mocked Nitro HybridObject.
 *
 * These cover features that previously only had source-contract checks:
 * setSSLConfig, getPinnedDomains, failure listeners, OTA apply path, and
 * unlinked-module honesty.
 */

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

function makeMockHybrid(overrides = {}) {
  const state = {
    enabled: true,
    configJson: JSON.stringify({
      sha256Keys: { 'api.example.com': [PIN_A, PIN_B] },
    }),
    failureCallback: null,
  };

  return {
    state,
    setUseSSLPinning: jest.fn(async (v) => {
      state.enabled = v;
    }),
    getUseSSLPinning: jest.fn(async () => state.enabled),
    setSSLConfigJson: jest.fn(async (json) => {
      state.configJson = json;
    }),
    getPinnedDomains: jest.fn(async () => {
      const parsed = JSON.parse(state.configJson);
      return Object.keys(parsed.sha256Keys || {});
    }),
    setPinningFailureCallback: jest.fn((cb) => {
      state.failureCallback = cb;
    }),
    clearPinningFailureCallback: jest.fn(() => {
      state.failureCallback = null;
    }),
    ...overrides,
  };
}

describe('JS API with linked Nitro HybridObject', () => {
  let api;
  let hybrid;

  beforeEach(() => {
    jest.resetModules();
    hybrid = makeMockHybrid();

    jest.doMock('react-native-nitro-modules', () => ({
      NitroModules: {
        createHybridObject: jest.fn(() => hybrid),
      },
    }));

    // Require after mock so createHybridObject runs with the mock.
    api = require('../src/index.ts');
  });

  afterEach(() => {
    jest.dontMock('react-native-nitro-modules');
  });

  it('reports availability when HybridObject is created', () => {
    expect(api.isSSLManagerAvailable()).toBe(true);
  });

  it('setUseSSLPinning / getUseSSLPinning round-trip', async () => {
    await api.setUseSSLPinning(false);
    expect(hybrid.setUseSSLPinning).toHaveBeenCalledWith(false);
    expect(await api.getUseSSLPinning()).toBe(false);

    await api.setUseSSLPinning(true);
    expect(await api.getUseSSLPinning()).toBe(true);
  });

  it('setSSLConfig normalizes and sends JSON across the bridge', async () => {
    await api.setSSLConfig({
      sha256Keys: {
        'api.example.com': [PIN_A, PIN_B],
      },
      domains: {
        'api.example.com': {
          enforcePinning: false,
          expirationDate: '2099-01-01',
        },
      },
    });

    expect(hybrid.setSSLConfigJson).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(hybrid.setSSLConfigJson.mock.calls[0][0]);
    expect(sent.sha256Keys['api.example.com'][0]).toBe(PIN_A);
    expect(sent.domains['api.example.com'].enforcePinning).toBe(false);
    expect(sent.domains['api.example.com'].expirationDate).toBe('2099-01-01');
  });

  it('setSSLConfig accepts a pre-serialized JSON string', async () => {
    await api.setSSLConfig(
      JSON.stringify({
        sha256Keys: { 'cdn.example.com': [PIN_A, PIN_B] },
      })
    );
    const sent = JSON.parse(hybrid.setSSLConfigJson.mock.calls[0][0]);
    expect(sent.sha256Keys['cdn.example.com']).toEqual([PIN_A, PIN_B]);
  });

  it('setSSLConfig rejects invalid pin format before calling native', () => {
    // normalizeSslConfig throws synchronously before the native bridge call.
    expect(() =>
      api.setSSLConfig({
        sha256Keys: { 'api.example.com': ['not-a-pin'] },
      })
    ).toThrow(/invalid pin/i);
    expect(hybrid.setSSLConfigJson).not.toHaveBeenCalled();
  });

  it('getPinnedDomains returns domains from active config', async () => {
    hybrid.state.configJson = JSON.stringify({
      sha256Keys: {
        'a.example.com': [PIN_A, PIN_B],
        'b.example.com': [PIN_A, PIN_B],
      },
    });
    await expect(api.getPinnedDomains()).resolves.toEqual([
      'a.example.com',
      'b.example.com',
    ]);
  });

  it('addPinningFailureListener fans out events and unsubscribes', () => {
    const seenA = [];
    const seenB = [];
    const unsubA = api.addPinningFailureListener((e) => seenA.push(e));
    const unsubB = api.addPinningFailureListener((e) => seenB.push(e));

    expect(hybrid.setPinningFailureCallback).toHaveBeenCalledTimes(1);

    const event = {
      host: 'api.example.com',
      enforced: true,
      servedPins: [PIN_A],
      message: 'pin mismatch',
      timestamp: Date.now(),
    };
    hybrid.state.failureCallback(event);
    expect(seenA).toEqual([event]);
    expect(seenB).toEqual([event]);

    unsubA();
    hybrid.state.failureCallback({ ...event, message: 'second' });
    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(2);

    unsubB();
  });

  it('failure listener isolation — one throw does not block others', () => {
    const seen = [];
    api.addPinningFailureListener(() => {
      throw new Error('listener boom');
    });
    api.addPinningFailureListener((e) => seen.push(e));

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    hybrid.state.failureCallback({
      host: 'x.com',
      enforced: false,
      servedPins: [],
      message: 'audit',
      timestamp: 1,
    });
    expect(seen).toHaveLength(1);
    errSpy.mockRestore();
  });

  it('updatePinsFromUrl verifies signature then applies config', async () => {
    const { generateKeypair, signBundle } = require('../scripts/cli-utils');
    const { privateKeyPem, publicKeyBase64 } = generateKeypair();
    const config = {
      sha256Keys: { 'ota.example.com': [PIN_A, PIN_B] },
    };
    const now = Date.parse('2026-07-16T12:00:00Z');
    const bundle = signBundle(config, privateKeyPem, {
      version: 7,
      now,
      expiresInMs: 30 * 24 * 3600 * 1000,
    });

    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => bundle,
    }));

    const result = await api.updatePinsFromUrl('https://cdn.example/pins.json', {
      publicKey: publicKeyBase64,
      fetchFn,
      // inject "now" via maxAge only — verifyOtaBundle uses Date.now unless we
      // pass through; signBundle issuedAt is Date.now() by default in cli-utils
      // when now is set. Our sign uses `now` option.
    });

    // If verify used wall-clock now far from signed `now`, maxAge could fail.
    // The signBundle with `now` sets issuedAt to that timestamp — allow wide age.
    expect(fetchFn).toHaveBeenCalledWith('https://cdn.example/pins.json');
    expect(hybrid.setSSLConfigJson).toHaveBeenCalled();
    expect(result.domains).toContain('ota.example.com');
    expect(result.version).toBe(7);
  });

  it('updatePinsFromUrl rejects HTTP failures without touching native config', async () => {
    hybrid.setSSLConfigJson.mockClear();
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));

    await expect(
      api.updatePinsFromUrl('https://cdn.example/pins.json', {
        publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        fetchFn,
      })
    ).rejects.toMatchObject({ code: 'OTA_FETCH_FAILED' });
    expect(hybrid.setSSLConfigJson).not.toHaveBeenCalled();
  });
});

describe('JS API when Nitro is not linked', () => {
  let api;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native-nitro-modules', () => ({
      NitroModules: {
        createHybridObject: jest.fn(() => {
          throw new Error('not linked');
        }),
      },
    }));
    api = require('../src/index.ts');
  });

  afterEach(() => {
    jest.dontMock('react-native-nitro-modules');
  });

  it('isSSLManagerAvailable is false', () => {
    expect(api.isSSLManagerAvailable()).toBe(false);
  });

  it('API methods throw instead of silently no-oping', () => {
    // requireNative() throws synchronously (Promise is never returned).
    expect(() => api.getUseSSLPinning()).toThrow(/not available/i);
    expect(() => api.setUseSSLPinning(true)).toThrow(/not available/i);
    expect(() => api.getPinnedDomains()).toThrow(/not available/i);
    expect(() => api.addPinningFailureListener(() => {})).toThrow(
      /not available/i
    );
  });
});
