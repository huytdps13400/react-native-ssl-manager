#!/usr/bin/env node
/**
 * Feature test matrix runner.
 *
 * Runs the automated suites that map 1:1 to implemented capabilities and
 * prints a coverage matrix so it's obvious what is unit-tested vs device-only.
 *
 * Usage:
 *   node scripts/run-feature-tests.js
 *   npm run test:features
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const jestBin = path.join(root, 'node_modules', '.bin', 'jest');

/** @type {{ feature: string; suites: string[]; device?: string }[]} */
const MATRIX = [
  {
    feature: 'Eager init (iOS +load / Android Startup)',
    suites: ['eager-init.test.js'],
    device: 'Launch app → log "SSL pinning ACTIVE" (manual)',
  },
  {
    feature: 'Nitro HybridObject surface + packaging',
    suites: ['nitro-module-contract.test.js', 'js-api-mocked.test.js'],
    device: 'example-expo → Run Feature Suite',
  },
  {
    feature: 'setUseSSLPinning / getUseSSLPinning',
    suites: ['js-api-mocked.test.js'],
    device: 'example-expo toggle + Feature Suite',
  },
  {
    feature: 'setSSLConfig / getPinnedDomains',
    suites: ['js-api-mocked.test.js', 'config-normalization.test.js'],
    device: 'example-expo Feature Suite',
  },
  {
    feature: 'Pin-failure listeners',
    suites: ['js-api-mocked.test.js'],
    device: 'MITM / wrong pin → listener (manual)',
  },
  {
    feature: 'OTA sign → verify → apply path',
    suites: ['ota-verify.test.js', 'js-api-mocked.test.js'],
    device: 'updatePinsFromUrl against hosted bundle (manual)',
  },
  {
    feature: 'Android Network Security Config',
    suites: [
      'nsc-generation.test.js',
      'nsc-xml-generation.test.js',
      'nsc-extended.test.js',
    ],
  },
  {
    feature: 'Android PinnedOkHttpClient',
    suites: ['pinned-okhttpclient.test.js'],
  },
  {
    feature: 'Expo plugin (iOS Xcode + Android assets)',
    suites: ['expo-plugin-xcode.test.js'],
    device: 'npx expo prebuild --clean',
  },
  {
    feature: 'pnpm / monorepo postinstall safety',
    suites: ['postinstall-monorepo.test.js', 'postinstall-nsc.test.js'],
  },
  {
    feature: 'pnpm monorepo fixture + monorepo-setup CLI',
    suites: ['monorepo-fixture.test.js'],
    device: 'fixtures/pnpm-monorepo + npm run test:monorepo',
  },
  {
    feature: 'CLI pins / verify / sign helpers',
    suites: ['cli-utils.test.js', 'ota-verify.test.js'],
  },
];

function runJest(patterns) {
  const args = ['--no-coverage', ...patterns.map((p) => path.join('__tests__', p))];
  const result = spawnSync(jestBin, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function main() {
  console.log('🧪 react-native-ssl-manager — feature test matrix\n');

  // Unique suite list in matrix order
  const allSuites = [
    ...new Set(MATRIX.flatMap((row) => row.suites)),
  ];

  console.log(`Running Jest suites (${allSuites.length}):`);
  for (const s of allSuites) console.log(`  • ${s}`);
  console.log('');

  const jestResult = runJest(allSuites);
  process.stdout.write(jestResult.stdout);
  if (jestResult.stderr) process.stderr.write(jestResult.stderr);

  console.log('\n──────────────── Feature coverage matrix ────────────────\n');
  console.log(
    'Feature'.padEnd(48) +
      'Unit'.padEnd(8) +
      'Device / notes'
  );
  console.log('─'.repeat(90));

  for (const row of MATRIX) {
    const unit = jestResult.ok ? 'PASS' : 'SEE LOG';
    const device = row.device || '—';
    console.log(
      row.feature.padEnd(48) + unit.padEnd(8) + device
    );
  }

  console.log('\nDevice suite (after `npx expo run:ios`):');
  console.log('  Open example-expo → tap “Run Feature Suite”');
  console.log('  Expect all rows green (Nitro linked + config + toggle + fetch).\n');

  if (!jestResult.ok) {
    console.error('❌ Feature unit suites failed');
    process.exit(jestResult.status || 1);
  }

  console.log('✅ All mapped feature unit suites passed');
  process.exit(0);
}

main();
