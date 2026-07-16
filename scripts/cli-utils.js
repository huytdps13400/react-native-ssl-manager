/* eslint-env node */
/**
 * Core logic for the `react-native-ssl-manager` CLI. Node built-ins only
 * (tls + crypto) — no openssl, no dependencies. Kept free of process/argv
 * handling so every function is unit-testable; scripts/cli.js is the thin
 * argv wrapper.
 */

const crypto = require('crypto');
const tls = require('tls');

/** SPKI SHA-256 pin (`sha256/<base64>`) for an X509Certificate. */
function spkiPinFromX509(x509) {
  const spkiDer = x509.publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('sha256').update(spkiDer).digest('base64');
  return `sha256/${hash}`;
}

/** SPKI pin for a PEM certificate string. */
function spkiPinFromPem(pem) {
  return spkiPinFromX509(new crypto.X509Certificate(pem));
}

/**
 * Connect to `host:port` and return `{subject, pin, notAfter, isLeaf}` for
 * every certificate in the served chain (leaf first). Verification is
 * disabled on purpose: the point is to observe what the server serves, even
 * with self-signed/dev certificates.
 */
function getChainPins(host, { port = 443, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const chain = [];
          let cert = socket.getPeerCertificate(true);
          const seen = new Set();
          while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
            seen.add(cert.fingerprint256);
            const x509 = new crypto.X509Certificate(cert.raw);
            chain.push({
              subject: x509.subject.split('\n').join(', '),
              pin: spkiPinFromX509(x509),
              notAfter: x509.validTo,
              isLeaf: chain.length === 0,
            });
            cert =
              cert.issuerCertificate && cert.issuerCertificate !== cert
                ? cert.issuerCertificate
                : null;
          }
          socket.end();
          resolve(chain);
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      }
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${host}:${port} timed out`));
    });
    socket.on('error', reject);
  });
}

/** Build a ready-to-paste ssl_config.json snippet from chain pins. */
function configSnippetFromChain(host, chain) {
  // Leaf + first intermediate: key continuity for your own key, CA fallback.
  const pins = chain.slice(0, 2).map((entry) => entry.pin);
  return { sha256Keys: { [host]: pins } };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compare a config against live chains. `connect` is injectable for tests:
 * `(host) => Promise<[{pin, ...}]>`. Returns per-domain results and a
 * CI-friendly exit code (non-zero iff an ENFORCED domain mismatches or cannot
 * be checked).
 *
 * Statuses: OK | MISMATCH | AUDIT_MISMATCH | EXPIRED_SKIPPED | ERROR
 * Each result may carry `expiresSoon: true` when the configured
 * expirationDate is within `expiryWarningDays`.
 */
async function verifyConfig(
  config,
  { connect = getChainPins, now = Date.now(), expiryWarningDays = 30 } = {}
) {
  const results = [];
  const domains = config.domains || {};

  for (const [host, pins] of Object.entries(config.sha256Keys || {})) {
    const options = domains[host] || {};
    const enforced = options.enforcePinning !== false;
    const expirationDate = options.expirationDate || null;

    let expired = false;
    let expiresSoon = false;
    if (expirationDate) {
      const endOfDay = Date.parse(`${expirationDate}T23:59:59.999Z`);
      expired = Number.isFinite(endOfDay) && endOfDay < now;
      expiresSoon =
        !expired &&
        Number.isFinite(endOfDay) &&
        endOfDay - now <= expiryWarningDays * MS_PER_DAY;
    }

    if (expired) {
      results.push({
        host,
        status: 'EXPIRED_SKIPPED',
        enforced,
        expirationDate,
        message: `pin-set expired on ${expirationDate} — pinning is fail-open for this domain`,
      });
      continue;
    }

    try {
      const chain = await connect(host);
      const servedPins = chain.map((entry) => entry.pin);
      const matched = servedPins.some((pin) => pins.includes(pin));
      results.push({
        host,
        status: matched ? 'OK' : enforced ? 'MISMATCH' : 'AUDIT_MISMATCH',
        enforced,
        expirationDate,
        expiresSoon,
        servedPins,
        configuredPins: pins,
        message: matched
          ? 'live chain matches configured pins'
          : `live chain matches NONE of the configured pins${enforced ? ' — clients WILL be blocked' : ' (audit mode: reported, not blocked)'}`,
      });
    } catch (error) {
      results.push({
        host,
        status: 'ERROR',
        enforced,
        expirationDate,
        expiresSoon,
        message: `could not check: ${error.message}`,
      });
    }
  }

  const failing = results.some(
    (result) =>
      result.enforced &&
      (result.status === 'MISMATCH' || result.status === 'ERROR')
  );
  return { results, exitCode: failing ? 1 : 0 };
}

/**
 * Generate an Ed25519 keypair. Returns the private key as PKCS#8 PEM and the
 * public key as base64 raw 32 bytes (the format `updatePinsFromUrl` expects).
 */
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER = 12-byte algorithm header + 32 raw key bytes.
  const rawPublicKey = spkiDer.subarray(spkiDer.length - 32);
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyBase64: rawPublicKey.toString('base64'),
  };
}

/**
 * Sign an SSL pinning config into an OTA bundle consumable by
 * `updatePinsFromUrl`.
 */
function signBundle(
  config,
  privateKeyPem,
  { version = 1, expiresInMs = null, now = Date.now() } = {}
) {
  const payload = {
    version,
    issuedAt: new Date(now).toISOString(),
    ...(expiresInMs != null
      ? { expiresAt: new Date(now + expiresInMs).toISOString() }
      : {}),
    config,
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, payloadBytes, privateKeyPem);
  return {
    payload: payloadBytes.toString('base64'),
    signature: signature.toString('base64'),
  };
}

/**
 * Node-side verification of a signed bundle (mirror of the app-side tweetnacl
 * path) — used by the CLI to self-check `sign` output and by tests.
 */
function verifyBundle(bundle, publicKeyBase64) {
  const rawPublicKey = Buffer.from(publicKeyBase64, 'base64');
  if (rawPublicKey.length !== 32) {
    throw new Error('publicKey must be 32 raw Ed25519 bytes (base64)');
  }
  // Rebuild the SPKI DER from the raw key (fixed Ed25519 header).
  const spkiDer = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    rawPublicKey,
  ]);
  const publicKey = crypto.createPublicKey({
    key: spkiDer,
    format: 'der',
    type: 'spki',
  });
  const payloadBytes = Buffer.from(bundle.payload, 'base64');
  const signature = Buffer.from(bundle.signature, 'base64');
  if (!crypto.verify(null, payloadBytes, publicKey, signature)) {
    throw new Error('Bundle signature does not verify');
  }
  return JSON.parse(payloadBytes.toString('utf8'));
}

/** `expires-in` strings like `30d`, `12h`, `45m` → milliseconds. */
function parseDuration(input) {
  const match = /^(\d+)([dhm])$/.exec(String(input).trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${input}" — use <n>d, <n>h, or <n>m (e.g. 30d)`
    );
  }
  const value = Number(match[1]);
  const unit = { d: MS_PER_DAY, h: 3600000, m: 60000 }[match[2]];
  return value * unit;
}

module.exports = {
  spkiPinFromX509,
  spkiPinFromPem,
  getChainPins,
  configSnippetFromChain,
  verifyConfig,
  generateKeypair,
  signBundle,
  verifyBundle,
  parseDuration,
};
