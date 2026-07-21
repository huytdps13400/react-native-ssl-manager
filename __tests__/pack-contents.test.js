/**
 * Guards the published tarball contents: only runtime scripts should ship,
 * never dev/test/maintainer tooling or fixtures. Prevents the package from
 * quietly re-bloating (see issue #18 feedback).
 */
const { execSync } = require('child_process');
const path = require('path');

function packedFiles() {
  const cwd = path.join(__dirname, '..');
  // --ignore-scripts keeps lifecycle scripts (e.g. `prepare`) from writing to
  // stdout and corrupting the JSON payload.
  const raw = execSync('npm pack --dry-run --json --ignore-scripts', {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const json = raw.slice(raw.indexOf('['));
  return JSON.parse(json)[0].files.map((f) => f.path);
}

describe('published package contents', () => {
  let files;
  beforeAll(() => {
    files = packedFiles();
  });

  const shouldShip = [
    'scripts/cli.js',
    'scripts/cli-utils.js',
    'scripts/postinstall.js',
    'scripts/postinstall-lib.js',
    'scripts/bun-postinstall.js',
    'scripts/nsc-utils.js',
  ];

  it.each(shouldShip)('ships runtime script %s', (p) => {
    expect(files).toContain(p);
  });

  it('does not ship dev/test/maintainer scripts', () => {
    const dev = files.filter(
      (f) =>
        f.startsWith('scripts/dev/') ||
        /rebuild-and-test|run-feature-tests|test-bun|deprecate-v1|build\.sh/.test(
          f
        )
    );
    expect(dev).toEqual([]);
  });

  it('does not ship monorepo tooling or fixtures', () => {
    const junk = files.filter(
      (f) => /monorepo-(setup|utils)/.test(f) || f.startsWith('fixtures/')
    );
    expect(junk).toEqual([]);
  });
});
