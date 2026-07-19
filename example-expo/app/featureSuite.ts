/**
 * In-app feature suite for react-native-ssl-manager.
 * Runs against the real Nitro HybridObject on device/simulator.
 *
 * Each case returns { id, ok, detail } so the UI can render a checklist.
 */

import {
  addPinningFailureListener,
  getPinnedDomains,
  getUseSSLPinning,
  isSSLManagerAvailable,
  setSSLConfig,
  setUseSSLPinning,
  verifyOtaBundle,
  type PinningFailureEvent,
} from 'react-native-ssl-manager';

export type FeatureCaseResult = {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
};

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

async function caseAvailable(): Promise<FeatureCaseResult> {
  const ok = isSSLManagerAvailable();
  return {
    id: 'available',
    title: 'isSSLManagerAvailable()',
    ok,
    detail: ok
      ? 'Nitro HybridObject is linked'
      : 'Native module missing — rebuild (prebuild / pods)',
  };
}

async function caseToggle(): Promise<FeatureCaseResult> {
  const before = await getUseSSLPinning();
  await setUseSSLPinning(!before);
  const mid = await getUseSSLPinning();
  await setUseSSLPinning(before);
  const after = await getUseSSLPinning();
  const ok = mid === !before && after === before;
  return {
    id: 'toggle',
    title: 'setUseSSLPinning / getUseSSLPinning',
    ok,
    detail: ok
      ? `toggled ${before} → ${mid} → ${after}`
      : `unexpected states before=${before} mid=${mid} after=${after}`,
  };
}

async function caseSetConfigAndDomains(): Promise<FeatureCaseResult> {
  await setSSLConfig({
    sha256Keys: {
      'feature-suite.example.com': [PIN_A, PIN_B],
      'api.example.com': [PIN_A, PIN_B],
    },
    domains: {
      'feature-suite.example.com': {
        enforcePinning: true,
        expirationDate: '2099-12-31',
        includeSubdomains: true,
      },
      'api.example.com': {
        enforcePinning: false,
      },
    },
  });
  const domains = await getPinnedDomains();
  const ok =
    domains.includes('feature-suite.example.com') &&
    domains.includes('api.example.com');
  return {
    id: 'setSSLConfig',
    title: 'setSSLConfig + getPinnedDomains',
    ok,
    detail: ok
      ? `domains: ${domains.join(', ')}`
      : `got domains: ${JSON.stringify(domains)}`,
  };
}

async function caseFailureListener(): Promise<FeatureCaseResult> {
  const events: PinningFailureEvent[] = [];
  const unsub = addPinningFailureListener((e) => {
    events.push(e);
  });
  // Listener registration is the contract we can assert without a MITM.
  // Native will invoke the callback on real pin failures.
  unsub();
  return {
    id: 'failureListener',
    title: 'addPinningFailureListener (register/unsubscribe)',
    ok: true,
    detail: 'listener registered and unsubscribed without throw',
  };
}

async function caseOtaVerifyPure(): Promise<FeatureCaseResult> {
  // Pure JS path — no network. Ensures OTA helpers are in the app bundle.
  try {
    // Invalid empty bundle should throw OtaError
    verifyOtaBundle(
      { payload: '', signature: '' },
      { publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }
    );
    return {
      id: 'otaVerify',
      title: 'verifyOtaBundle (pure JS)',
      ok: false,
      detail: 'expected invalid bundle to throw',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: 'otaVerify',
      title: 'verifyOtaBundle (pure JS)',
      ok: true,
      detail: `rejects invalid bundle: ${message.slice(0, 80)}`,
    };
  }
}

async function caseFetchUnpinned(): Promise<FeatureCaseResult> {
  // jsonplaceholder is not in ssl_config pins — with TrustKit enforce for only
  // configured hosts, unlisted hosts typically still work.
  const start = Date.now();
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const ms = Date.now() - start;
    const ok = res.ok;
    return {
      id: 'fetchUnpinned',
      title: 'fetch unpinned host (jsonplaceholder)',
      ok,
      detail: ok ? `HTTP ${res.status} in ${ms}ms` : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      id: 'fetchUnpinned',
      title: 'fetch unpinned host (jsonplaceholder)',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run every feature case sequentially. Safe to call from UI.
 * Restores pinning-enabled=true at the end when possible.
 */
export async function runFeatureSuite(): Promise<FeatureCaseResult[]> {
  const results: FeatureCaseResult[] = [];
  const cases = [
    caseAvailable,
    caseToggle,
    caseSetConfigAndDomains,
    caseFailureListener,
    caseOtaVerifyPure,
    caseFetchUnpinned,
  ];

  for (const run of cases) {
    try {
      results.push(await run());
    } catch (error) {
      results.push({
        id: run.name,
        title: run.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Best-effort restore pinning on for further manual testing
  try {
    if (isSSLManagerAvailable()) {
      await setUseSSLPinning(true);
    }
  } catch {
    // ignore
  }

  return results;
}

export function summarizeSuite(results: FeatureCaseResult[]): {
  passed: number;
  failed: number;
  total: number;
} {
  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, total: results.length };
}
