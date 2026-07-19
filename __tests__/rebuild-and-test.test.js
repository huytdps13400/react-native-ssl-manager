/**
 * Contract tests for the rebuild-and-test pipeline (no full Xcode rebuild).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'rebuild-and-test.js');
const config = path.join(root, 'example-expo', 'ssl_config.json');

describe('rebuild-and-test script', () => {
  it('exists and is executable as node script', () => {
    expect(fs.existsSync(script)).toBe(true);
    const src = fs.readFileSync(script, 'utf8');
    expect(src).toContain('stepVerifyPins');
    expect(src).toContain('stepVerifyBundle');
    expect(src).toContain('MITM checklist');
  });

  it('example-expo ssl_config uses demo placeholder hosts only (no customer secrets)', () => {
    const cfg = JSON.parse(fs.readFileSync(config, 'utf8'));
    const hosts = Object.keys(cfg.sha256Keys || {});
    expect(hosts.length).toBeGreaterThan(0);
    // Guard against accidentally committing real customer hosts/pins.
    const joined = JSON.stringify(cfg);
    expect(joined).not.toMatch(/satra\.com/i);
    expect(joined).not.toMatch(/store_\d+/i);
    expect(cfg.sha256Keys['api.example.com'] || cfg.sha256Keys).toBeTruthy();
  });

  it('--no-build --skip-verify works with demo placeholder pins', () => {
    const result = spawnSync(
      process.execPath,
      [script, '--no-build', '--skip-verify'],
      { encoding: 'utf8', cwd: root }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Skip live pin verify|finished/i);
  }, 60000);
});
