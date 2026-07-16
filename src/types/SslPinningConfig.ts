/**
 * Per-domain pinning options. All fields are optional; defaults preserve the
 * legacy behavior (enforced, no expiration, subdomains included).
 */
export interface SslDomainOptions {
  /**
   * When `false`, pin validation runs in report-only (audit) mode: mismatches
   * emit pin-failure events / reports but never block the connection.
   * Default `true`.
   */
  enforcePinning?: boolean;
  /**
   * `YYYY-MM-DD`. After this date, pinning for the domain is disabled
   * (fail-open) on both platforms — a circuit breaker for abandoned installs.
   * Omit for pins that never expire.
   */
  expirationDate?: string;
  /** Whether pins apply to subdomains. Default `true`. */
  includeSubdomains?: boolean;
}

/**
 * SSL pinning configuration: a map of domain name to its SHA-256 public-key
 * pins (each pin prefixed with `sha256/`), plus optional per-domain options
 * and pin-failure report URIs.
 *
 * @see {@linkcode SslManager.setSSLConfig}
 */
export interface SslPinningConfig {
  sha256Keys: Record<string, string[]>;
  /** Optional per-domain options, keyed by the same hostnames as `sha256Keys`. */
  domains?: Record<string, SslDomainOptions>;
  /**
   * HTTPS endpoints that receive an HPKP-style JSON POST when pin validation
   * fails. Delivery is best-effort and never affects app requests.
   */
  reportUris?: string[];
}
