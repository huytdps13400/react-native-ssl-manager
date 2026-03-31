/**
 * Shared utilities for Network Security Config XML generation.
 * Used by app.plugin.js, postinstall.js, and tests.
 */

/**
 * Generate network_security_config.xml content from sha256Keys
 */
function generateNscXml(sha256Keys) {
  // Default expiration: 1 year from now
  const expDate = new Date();
  expDate.setFullYear(expDate.getFullYear() + 1);
  const expiration = expDate.toISOString().split('T')[0]; // YYYY-MM-DD

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<network-security-config>\n';

  for (const [domain, pins] of Object.entries(sha256Keys)) {
    xml += '    <domain-config cleartextTrafficPermitted="false">\n';
    xml += `        <domain includeSubdomains="true">${domain}</domain>\n`;
    xml += `        <pin-set expiration="${expiration}">\n`;
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
  const expDate = new Date();
  expDate.setFullYear(expDate.getFullYear() + 1);
  const expiration = expDate.toISOString().split('T')[0];

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
      `        <pin-set expiration="${expiration}">\n` +
      `${pinSetXml}\n` +
      `        </pin-set>\n` +
      `    </domain-config>`;

    // Check if domain already exists in the XML
    const domainRegex = new RegExp(
      `<domain-config[^>]*>\\s*<domain[^>]*>${domain.replace(/\./g, '\\.')}</domain>[\\s\\S]*?</domain-config>`,
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

module.exports = { generateNscXml, mergeNscXml };
