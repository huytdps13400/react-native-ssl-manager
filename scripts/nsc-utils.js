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
 * Per-domain options for a domain, with legacy-compatible defaults.
 * `domains` is the optional extended-config map from ssl_config.json.
 */
function domainOptions(domains, domain) {
  const options = (domains && domains[domain]) || {};
  return {
    enforcePinning: options.enforcePinning !== false,
    expirationDate: options.expirationDate || null,
    includeSubdomains: options.includeSubdomains !== false,
  };
}

/**
 * Build the `<domain-config>` block for one pinned domain, or null when the
 * domain must not be enforced by NSC (audit mode — NSC has no report-only
 * mode; audit validation happens in the OkHttp layer instead).
 */
function buildDomainConfigBlock(domain, pins, domains) {
  const options = domainOptions(domains, domain);
  if (!options.enforcePinning) {
    return null;
  }

  // A configured expirationDate becomes the pin-set `expiration` attribute
  // (Android fails open after that date). Without one, the pin-set carries no
  // expiration: pins never silently stop being enforced.
  const expirationAttr = options.expirationDate
    ? ` expiration="${options.expirationDate}"`
    : '';

  let block = '    <domain-config cleartextTrafficPermitted="false">\n';
  block += `        <domain includeSubdomains="${options.includeSubdomains}">${domain}</domain>\n`;
  block += `        <pin-set${expirationAttr}>\n`;
  for (const pin of pins) {
    const cleanPin = pin.replace(/^sha256\//, '');
    block += `            <pin digest="SHA-256">${cleanPin}</pin>\n`;
  }
  block += '        </pin-set>\n';
  block += '    </domain-config>';
  return block;
}

/**
 * Generate network_security_config.xml content from sha256Keys and the
 * optional per-domain `domains` metadata.
 */
function generateNscXml(sha256Keys, domains) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<network-security-config>\n';

  // Keep the Metro / dev server reachable over cleartext (issue #9).
  xml += generateDevCleartextConfig();

  for (const [domain, pins] of Object.entries(sha256Keys)) {
    const block = buildDomainConfigBlock(domain, pins, domains);
    if (block) {
      xml += `${block}\n`;
    }
  }

  xml += '</network-security-config>\n';
  return xml;
}

/**
 * Merge pin-set entries into existing NSC XML string.
 * Preserves existing config, replaces pin-set for matching domains, adds new ones.
 */
function mergeNscXml(existingXml, sha256Keys, domains) {
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
    const domainConfigBlock = buildDomainConfigBlock(domain, pins, domains);

    // Check if domain already exists in the XML.
    // The block's leading indentation (`[^\S\r\n]*`) is part of the match so it
    // is replaced by the canonical block's own indentation (and fully removed in
    // audit mode). Without it the replacement re-adds indentation on top of the
    // existing indentation, so the block drifts right by 4 spaces on every merge
    // — a non-idempotent rewrite that churns the file on each build.
    const domainRegex = new RegExp(
      `[^\\S\\r\\n]*<domain-config[^>]*>\\s*<domain[^>]*>${domain.replace(
        /\./g,
        '\\.'
      )}</domain>[\\s\\S]*?</domain-config>`,
      'g'
    );

    if (!domainConfigBlock) {
      // Audit-mode domain: NSC must not enforce it. Remove a pre-existing
      // pinned block for this domain so a mode change takes effect on rebuild.
      if (domainRegex.test(existingXml)) {
        console.warn(
          `⚠️  Removing NSC pin-set for audit-mode domain: ${domain}`
        );
        domainRegex.lastIndex = 0;
        existingXml = existingXml.replace(domainRegex, '');
      }
      continue;
    }

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
