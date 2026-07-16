import type { SslPinningConfig } from './types/SslPinningConfig';

const PIN_PATTERN = /^sha256\/[A-Za-z0-9+/=]{44}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class SslConfigError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SslConfigError';
    this.code = code;
  }
}

/**
 * Whether a `YYYY-MM-DD` expiration date has passed (fail-open point).
 * The pin-set is considered active through the end of the given day, UTC.
 */
export function isExpired(expirationDate: string, now: number): boolean {
  const endOfDay = Date.parse(`${expirationDate}T23:59:59.999Z`);
  return Number.isFinite(endOfDay) && endOfDay < now;
}

/**
 * Validates an {@link SslPinningConfig} and returns it with defaults left
 * implicit (native sides apply the same defaults). Throws
 * {@link SslConfigError} on structural problems; logs a console warning for
 * risky-but-legal configurations (single pin on an enforced domain, `domains`
 * entries without pins).
 */
export function normalizeSslConfig(config: SslPinningConfig): SslPinningConfig {
  if (
    config == null ||
    typeof config !== 'object' ||
    config.sha256Keys == null ||
    typeof config.sha256Keys !== 'object'
  ) {
    throw new SslConfigError(
      'INVALID_CONFIGURATION',
      'Config must be an object with a sha256Keys map'
    );
  }

  const hosts = Object.keys(config.sha256Keys);
  if (hosts.length === 0) {
    throw new SslConfigError(
      'INVALID_CONFIGURATION',
      'sha256Keys must contain at least one host'
    );
  }

  for (const host of hosts) {
    if (!host.trim()) {
      throw new SslConfigError(
        'INVALID_CONFIGURATION',
        'sha256Keys contains a blank hostname'
      );
    }
    const pins = config.sha256Keys[host];
    if (!Array.isArray(pins) || pins.length === 0) {
      throw new SslConfigError(
        'INVALID_PIN_CONFIGURATION',
        `Host "${host}" must have at least one SHA-256 pin`
      );
    }
    for (const pin of pins) {
      if (typeof pin !== 'string' || !PIN_PATTERN.test(pin.trim())) {
        throw new SslConfigError(
          'INVALID_PIN_CONFIGURATION',
          `Host "${host}" has an invalid pin "${pin}" — expected "sha256/<44-char base64>"`
        );
      }
    }
  }

  if (config.domains != null) {
    if (typeof config.domains !== 'object' || Array.isArray(config.domains)) {
      throw new SslConfigError(
        'INVALID_CONFIGURATION',
        '"domains" must be an object keyed by hostname'
      );
    }
    for (const [host, options] of Object.entries(config.domains)) {
      if (options == null || typeof options !== 'object') {
        throw new SslConfigError(
          'INVALID_CONFIGURATION',
          `domains["${host}"] must be an options object`
        );
      }
      const { enforcePinning, expirationDate, includeSubdomains } = options;
      if (enforcePinning != null && typeof enforcePinning !== 'boolean') {
        throw new SslConfigError(
          'INVALID_CONFIGURATION',
          `domains["${host}"].enforcePinning must be a boolean`
        );
      }
      if (includeSubdomains != null && typeof includeSubdomains !== 'boolean') {
        throw new SslConfigError(
          'INVALID_CONFIGURATION',
          `domains["${host}"].includeSubdomains must be a boolean`
        );
      }
      if (expirationDate != null) {
        if (
          typeof expirationDate !== 'string' ||
          !DATE_PATTERN.test(expirationDate) ||
          !Number.isFinite(Date.parse(`${expirationDate}T00:00:00Z`))
        ) {
          throw new SslConfigError(
            'INVALID_CONFIGURATION',
            `domains["${host}"].expirationDate must be a valid YYYY-MM-DD date`
          );
        }
      }
      if (!(host in config.sha256Keys)) {
        console.warn(
          `[react-native-ssl-manager] domains["${host}"] has no matching sha256Keys entry — it has no effect`
        );
      }
    }
  }

  if (config.reportUris != null) {
    if (
      !Array.isArray(config.reportUris) ||
      config.reportUris.some(
        (u) => typeof u !== 'string' || !/^https:\/\//.test(u)
      )
    ) {
      throw new SslConfigError(
        'INVALID_CONFIGURATION',
        '"reportUris" must be an array of https:// URLs'
      );
    }
  }

  for (const host of hosts) {
    const enforced = config.domains?.[host]?.enforcePinning !== false;
    if (enforced && config.sha256Keys[host]!.length < 2) {
      console.warn(
        `[react-native-ssl-manager] Host "${host}" has a single pin — always configure a backup pin to avoid lockout during certificate rotation`
      );
    }
  }

  return config;
}
