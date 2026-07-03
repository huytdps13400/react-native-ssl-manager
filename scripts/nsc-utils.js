/**
 * Shared utilities for Network Security Config XML generation.
 * Used by app.plugin.js, postinstall.js, and tests.
 */

// Local development hosts that must stay reachable over cleartext HTTP so the
// Metro bundler / dev server keeps working. Once this config is referenced from
// the manifest it overrides React Native's default debug network security
// config, which otherwise permits cleartext to these hosts. Without this block
// the app can no longer connect to the JS bundle in debug builds (issue #9):
//   - localhost   : physical device via `adb reverse tcp:8081`
//   - 10.0.2.2    : Android emulator loopback to the host machine
//   - 10.0.3.2    : Genymotion emulator loopback to the host machine
const DEV_CLEARTEXT_HOSTS = ['localhost', '10.0.2.2', '10.0.3.2'];

/**
 * Build a <domain-config> that permits cleartext traffic to the local dev hosts.
 */
function generateDevCleartextConfig() {
  let block = '    <domain-config cleartextTrafficPermitted="true">\n';
  for (const host of DEV_CLEARTEXT_HOSTS) {
    block += `        <domain includeSubdomains="false">${host}</domain>\n`;
  }
  block += '    </domain-config>\n';
  return block;
}

/**
 * Whether the given XML already declares a cleartext localhost dev host, so we
 * don't add a duplicate block when merging into an existing config.
 */
function hasDevCleartextConfig(xml) {
  return /<domain[^>]*>\s*localhost\s*<\/domain>/.test(xml);
}

/**
 * Generate network_security_config.xml content from sha256Keys
 */
function generateNscXml(sha256Keys) {
  // Pins do not expire: a `pin-set` expiration would make Android silently stop
  // enforcing pins after the date (a build-time fail-open), so it is omitted.
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<network-security-config>\n';

  // Keep the Metro / dev server reachable over cleartext (issue #9).
  xml += generateDevCleartextConfig();

  for (const [domain, pins] of Object.entries(sha256Keys)) {
    xml += '    <domain-config cleartextTrafficPermitted="false">\n';
    xml += `        <domain includeSubdomains="true">${domain}</domain>\n`;
    xml += `        <pin-set>\n`;
    for (const pin of pins) {
      const cleanPin = pin.replace(/^sha256\//, '');
      xml += `            <pin digest="SHA-256">${cleanPin}</pin>\n`;
    }
    xml += '        </pin-set>\n';
    xml += '    </domain-config>\n';
  }

  xml += '</network-security-config>\n';
  return xml;
}

/**
 * Merge pin-set entries into existing NSC XML string.
 * Preserves existing config, replaces pin-set for matching domains, adds new ones.
 */
function mergeNscXml(existingXml, sha256Keys) {
  // Ensure the local dev hosts stay reachable over cleartext (issue #9) without
  // duplicating a block that RN's debug config (or a previous merge) may already
  // provide.
  if (!hasDevCleartextConfig(existingXml)) {
    existingXml = existingXml.replace(
      '</network-security-config>',
      `${generateDevCleartextConfig()}</network-security-config>`
    );
  }

  for (const [domain, pins] of Object.entries(sha256Keys)) {
    const pinSetXml = pins
      .map((pin) => {
        const cleanPin = pin.replace(/^sha256\//, '');
        return `            <pin digest="SHA-256">${cleanPin}</pin>`;
      })
      .join('\n');

    const domainConfigBlock =
      `    <domain-config cleartextTrafficPermitted="false">\n` +
      `        <domain includeSubdomains="true">${domain}</domain>\n` +
      `        <pin-set>\n` +
      `${pinSetXml}\n` +
      `        </pin-set>\n` +
      `    </domain-config>`;

    // Check if domain already exists in the XML
    const domainRegex = new RegExp(
      `<domain-config[^>]*>\\s*<domain[^>]*>${domain.replace(
        /\./g,
        '\\.'
      )}</domain>[\\s\\S]*?</domain-config>`,
      'g'
    );

    if (domainRegex.test(existingXml)) {
      console.warn(`⚠️  Replacing existing pin-set for domain: ${domain}`);
      // Reset regex lastIndex since test() advanced it
      domainRegex.lastIndex = 0;
      existingXml = existingXml.replace(domainRegex, domainConfigBlock);
    } else {
      // Insert before closing </network-security-config>
      existingXml = existingXml.replace(
        '</network-security-config>',
        `${domainConfigBlock}\n</network-security-config>`
      );
    }
  }

  return existingXml;
}

module.exports = {
  generateNscXml,
  mergeNscXml,
  generateDevCleartextConfig,
  hasDevCleartextConfig,
  DEV_CLEARTEXT_HOSTS,
};
