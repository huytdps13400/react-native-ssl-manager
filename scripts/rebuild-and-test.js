#!/usr/bin/env node
/**
 * Rebuild + verify SSL pin testing pipeline for example-expo.
 *
 * Steps:
 *  1. Verify ssl_config.json pins against live TLS (CLI verify)
 *  2. Sync config into ios/ app group if present
 *  3. Optionally rebuild & install on iOS simulator
 *  4. Assert the built .app embeds the expected hosts/pins
 *  5. Print Proxyman ON/OFF checklist
 *
 * Usage (from library root):
 *   node scripts/rebuild-and-test.js
 *   node scripts/rebuild-and-test.js --no-build      # verify + sync only
 *   node scripts/rebuild-and-test.js --platform ios
 *   npm run test:rebuild
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const exampleExpo = path.join(root, 'example-expo');
const configPath = path.join(exampleExpo, 'ssl_config.json');

function parseArgs(argv) {
  const args = {
    build: true,
    verifyPins: true,
    platform: 'ios',
    device: process.env.IOS_DEVICE || 'iPhone 17 Pro',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-build') args.build = false;
    if (argv[i] === '--skip-verify') args.verifyPins = false;
    if (argv[i] === '--platform' && argv[i + 1]) args.platform = argv[++i];
    if (argv[i] === '--device' && argv[i + 1]) args.device = argv[++i];
    if (argv[i] === '--config' && argv[i + 1]) args.config = path.resolve(argv[++i]);
  }
  return args;
}

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    stdio: opts.stdio || 'inherit',
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0 && !opts.allowFail) {
    throw new Error(`Command failed (${result.status}): ${cmd}`);
  }
  return result;
}

function loadConfig(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`ssl_config not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stepVerifyPins(configFile) {
  console.log('\n═══ 1) Live pin verify ═══');
  const cli = path.join(root, 'scripts', 'cli.js');
  const result = spawnSync(
    process.execPath,
    [cli, 'verify', '--config', configFile],
    { encoding: 'utf8' }
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    throw new Error(
      'Pin verify failed — fix ssl_config.json before rebuild (clients would be locked out)'
    );
  }
  console.log('✔ All configured hosts match live chains');
}

function stepSyncIosConfig(configFile) {
  console.log('\n═══ 2) Sync ssl_config into ios/ ═══');
  const iosDir = path.join(exampleExpo, 'ios');
  if (!fs.existsSync(iosDir)) {
    console.log('ℹ️  No ios/ yet — run prebuild first or use --build (expo run generates it)');
    return;
  }
  const targets = [path.join(iosDir, 'ssl_config.json')];
  const appGroup = path.join(iosDir, 'exampleexpo', 'ssl_config.json');
  if (fs.existsSync(path.dirname(appGroup))) {
    targets.push(appGroup);
  }
  // Also any *expo* group folder
  for (const name of fs.readdirSync(iosDir)) {
    const candidate = path.join(iosDir, name, 'ssl_config.json');
    if (name.endsWith('expo') || name === 'exampleexpo') {
      if (fs.existsSync(path.dirname(candidate))) {
        targets.push(candidate);
      }
    }
  }
  const unique = [...new Set(targets)];
  for (const t of unique) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.copyFileSync(configFile, t);
    console.log(`  → ${path.relative(exampleExpo, t)}`);
  }
}

function stepRebuild(platform, device) {
  console.log(`\n═══ 3) Rebuild ${platform} ═══`);
  if (platform === 'ios') {
    run(
      'npx',
      ['expo', 'run:ios', '--device', device],
      { cwd: exampleExpo }
    );
  } else if (platform === 'android') {
    run('npx', ['expo', 'run:android'], { cwd: exampleExpo });
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }
}

function findBuiltIosApp() {
  const home = process.env.HOME || '';
  const derived = path.join(home, 'Library/Developer/Xcode/DerivedData');
  if (!fs.existsSync(derived)) return null;

  /** @type {string[]} */
  const apps = [];
  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'exampleexpo.app' && full.includes('iphonesimulator')) {
          apps.push(full);
        } else if (
          !ent.name.startsWith('.') &&
          ent.name !== 'Index.noindex' &&
          ent.name !== 'SDKStatCaches.noindex'
        ) {
          walk(full, depth + 1);
        }
      }
    }
  }
  walk(derived, 0);
  if (apps.length === 0) return null;
  // Newest mtime
  apps.sort(
    (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
  );
  return apps[0];
}

function stepVerifyBundle(config, { strict = true } = {}) {
  console.log('\n═══ 4) Verify pins embedded in built app ═══');
  const app = findBuiltIosApp();
  if (!app) {
    console.log('⚠️  No exampleexpo.app found in DerivedData — skip bundle assert');
    return { ok: !strict, app: null };
  }
  const bundled = path.join(app, 'ssl_config.json');
  if (!fs.existsSync(bundled)) {
    const msg = `ssl_config.json missing inside ${app}`;
    if (strict) throw new Error(msg);
    console.log(`⚠️  ${msg}`);
    return { ok: false, app };
  }
  const embedded = JSON.parse(fs.readFileSync(bundled, 'utf8'));
  const expectedHosts = Object.keys(config.sha256Keys || {});
  const embeddedHosts = Object.keys(embedded.sha256Keys || {});
  console.log(`  app: ${app}`);
  console.log(`  expected hosts: ${expectedHosts.join(', ')}`);
  console.log(`  embedded hosts: ${embeddedHosts.join(', ')}`);

  for (const host of expectedHosts) {
    if (!embedded.sha256Keys || !embedded.sha256Keys[host]) {
      const msg = `Host ${host} missing from embedded ssl_config.json — run a full rebuild`;
      if (strict) throw new Error(msg);
      console.log(`⚠️  ${msg}`);
      return { ok: false, app, embedded };
    }
    const exp = config.sha256Keys[host];
    const got = embedded.sha256Keys[host];
    if (JSON.stringify(exp) !== JSON.stringify(got)) {
      const msg = `Pins for ${host} differ between project ssl_config.json and app bundle`;
      if (strict) throw new Error(msg);
      console.log(`⚠️  ${msg}`);
      return { ok: false, app, embedded };
    }
  }
  console.log('✔ Embedded ssl_config.json matches project config');
  return { ok: true, app, embedded };
}

function printMitmChecklist(hosts) {
  console.log(`
═══ 5) Manual MITM checklist (Proxyman / Charles) ═══

Hosts under test:
${hosts.map((h) => `  • https://${h}`).join('\n')}

A) Pin OFF (proxy should SEE traffic)
   1. In app: turn SSL Pinning OFF
   2. iOS: force-quit app and reopen (required)
   3. Enable SSL Proxying for the hosts above
   4. Tap "UAT Categories GraphQL"
   5. Expect HTTP 200 + full request body visible in Proxyman

B) Pin ON (proxy should be BLOCKED)
   1. Turn SSL Pinning ON
   2. iOS: force-quit + reopen
   3. Keep SSL Proxying enabled
   4. Tap "UAT Categories GraphQL"
   5. Expect network/TLS failure; Proxyman cannot decrypt

C) Pin ON, no proxy (happy path)
   1. Disable SSL Proxying / quit Proxyman
   2. Pin ON + restart
   3. Tap GraphQL → Expect HTTP 200 + Satra Foods

In-app helper: open example-expo → "MITM checklist" section.
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configFile = args.config || configPath;

  console.log('🔧 rebuild-and-test');
  console.log(`   config:   ${configFile}`);
  console.log(`   example:  ${exampleExpo}`);
  console.log(`   build:    ${args.build} (${args.platform})`);

  const config = loadConfig(configFile);
  if (!config.sha256Keys || Object.keys(config.sha256Keys).length === 0) {
    throw new Error('ssl_config.json has no sha256Keys');
  }

  if (args.verifyPins) {
    stepVerifyPins(configFile);
  } else {
    console.log('\n═══ 1) Skip live pin verify (--skip-verify) ═══');
    console.log('   Use this for demo/placeholder ssl_config.json only.');
  }
  stepSyncIosConfig(configFile);

  if (args.build) {
    stepRebuild(args.platform, args.device);
  } else {
    console.log('\n═══ 3) Skip rebuild (--no-build) ═══');
  }

  // Strict bundle check only when we also verify live pins (real configs).
  const bundle = stepVerifyBundle(config, { strict: args.verifyPins });
  printMitmChecklist(Object.keys(config.sha256Keys));

  if (args.build && args.verifyPins && !bundle.ok) {
    process.exit(2);
  }
  console.log('✅ rebuild-and-test finished');
}

try {
  main();
} catch (error) {
  console.error(`\n✖ ${error.message || error}`);
  process.exit(1);
}
