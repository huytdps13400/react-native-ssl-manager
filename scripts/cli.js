#!/usr/bin/env node
/**
 * react-native-ssl-manager CLI
 *
 *   pins <host>      Extract SPKI pins from a live host (or --pem <file>)
 *   verify           Diff live chains against ssl_config.json (CI-friendly)
 *   keygen           Generate an Ed25519 keypair for OTA pin bundles
 *   sign             Sign ssl_config.json into an OTA bundle
 */

const fs = require('fs');
const path = require('path');
const {
  spkiPinFromPem,
  getChainPins,
  configSnippetFromChain,
  verifyConfig,
  generateKeypair,
  signBundle,
  verifyBundle,
  parseDuration,
} = require('./cli-utils');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function readConfig(flags) {
  const configPath = path.resolve(flags.config || 'ssl_config.json');
  if (!fs.existsSync(configPath)) {
    fail(`Config not found: ${configPath} (use --config <path>)`);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    return fail(`Could not parse ${configPath}: ${error.message}`);
  }
}

async function cmdPins({ positional, flags }) {
  if (flags.pem) {
    const pem = fs.readFileSync(path.resolve(flags.pem), 'utf8');
    const pin = spkiPinFromPem(pem);
    if (flags.json) {
      console.log(JSON.stringify({ pin }, null, 2));
    } else {
      console.log(pin);
    }
    return;
  }

  const host = positional[0];
  if (!host)
    fail('Usage: pins <host> [--port 443] [--json] | pins --pem <file>');
  const port = flags.port ? Number(flags.port) : 443;

  const chain = await getChainPins(host, { port });
  if (chain.length === 0) fail(`No certificates received from ${host}:${port}`);

  const snippet = configSnippetFromChain(host, chain);
  if (flags.json) {
    console.log(JSON.stringify({ host, chain, config: snippet }, null, 2));
    return;
  }

  console.log(`\nCertificate chain for ${host}:${port}\n`);
  for (const entry of chain) {
    const role = entry.isLeaf ? 'leaf        ' : 'intermediate';
    console.log(`  [${role}] ${entry.pin}`);
    console.log(
      `                 ${entry.subject} (expires ${entry.notAfter})`
    );
  }
  console.log('\nReady-to-paste ssl_config.json:\n');
  console.log(JSON.stringify(snippet, null, 2));
  console.log(
    '\n💡 Always ship at least 2 pins (primary + backup) to avoid lockout during rotation.'
  );
  if (chain.length < 2) {
    console.warn(
      '⚠️  Only one certificate observed — add a backup pin (e.g. your next key or the intermediate CA) before shipping.'
    );
  }
}

async function cmdVerify({ flags }) {
  const config = readConfig(flags);
  if (!config.sha256Keys || Object.keys(config.sha256Keys).length === 0) {
    fail('Config has no sha256Keys entries to verify');
  }

  const { results, exitCode } = await verifyConfig(config);
  const icons = {
    OK: '✔',
    MISMATCH: '✖',
    AUDIT_MISMATCH: '⚠',
    EXPIRED_SKIPPED: '⚠',
    ERROR: '✖',
  };
  for (const result of results) {
    console.log(
      `${icons[result.status]} ${result.host} [${result.status}] ${
        result.message
      }`
    );
    if (result.expiresSoon) {
      console.log(
        `  ⚠ pin-set expires on ${result.expirationDate} — rotate pins before that date`
      );
    }
    if (result.status === 'MISMATCH' || result.status === 'AUDIT_MISMATCH') {
      console.log(`    served:     ${result.servedPins.join(', ')}`);
      console.log(`    configured: ${result.configuredPins.join(', ')}`);
    }
  }
  if (flags.json) {
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit(exitCode);
}

function cmdKeygen({ flags }) {
  const outDir = path.resolve(flags.out || '.');
  const { privateKeyPem, publicKeyBase64 } = generateKeypair();
  const privatePath = path.join(outDir, 'ssl-manager-ota.key.pem');
  if (fs.existsSync(privatePath) && !flags.force) {
    fail(`${privatePath} already exists (use --force to overwrite)`);
  }
  fs.writeFileSync(privatePath, privateKeyPem, { mode: 0o600 });
  console.log(
    `✔ Private key written to ${privatePath} — keep it OFFLINE and out of git`
  );
  console.log('\nPublic key (pass to updatePinsFromUrl):\n');
  console.log(`  ${publicKeyBase64}`);
}

function cmdSign({ flags }) {
  const config = readConfig(flags);
  if (!flags.key)
    fail(
      'Usage: sign --config ssl_config.json --key <private.pem> [--expires-in 30d] [--out bundle.json]'
    );
  const privateKeyPem = fs.readFileSync(path.resolve(flags.key), 'utf8');
  const expiresInMs = flags['expires-in']
    ? parseDuration(flags['expires-in'])
    : null;
  const version = flags.version ? Number(flags.version) : 1;

  const bundle = signBundle(config, privateKeyPem, { version, expiresInMs });
  const outPath = path.resolve(flags.out || 'ssl-pins-bundle.json');
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  console.log(`✔ Signed bundle written to ${outPath}`);

  if (flags['public-key']) {
    verifyBundle(bundle, flags['public-key']);
    console.log(
      '✔ Self-check: bundle verifies against the provided public key'
    );
  }
}

const HELP = `react-native-ssl-manager <command>

Commands:
  pins <host> [--port 443] [--json]   Extract SPKI pins from a live TLS host
  pins --pem <cert.pem> [--json]      Extract the SPKI pin from a PEM certificate
  verify [--config ssl_config.json]   Check live chains against configured pins
                                      (exit 1 when an enforced domain drifts — CI-friendly)
  keygen [--out <dir>] [--force]      Generate an Ed25519 keypair for OTA bundles
  sign --config <path> --key <pem>    Sign the config into an OTA pin bundle
       [--expires-in 30d] [--out bundle.json] [--public-key <b64>]
`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const parsed = parseArgs(rest);
  try {
    switch (command) {
      case 'pins':
        await cmdPins(parsed);
        break;
      case 'verify':
        await cmdVerify(parsed);
        break;
      case 'keygen':
        cmdKeygen(parsed);
        break;
      case 'sign':
        cmdSign(parsed);
        break;
      default:
        console.log(HELP);
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    fail(error.message);
  }
}

main();
