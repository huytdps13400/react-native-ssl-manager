/**
 * SSL pinning configuration: a map of domain name to its SHA-256 public-key
 * pins (each pin prefixed with `sha256/`).
 *
 * @see {@linkcode SslManager.setSSLConfig}
 */
export interface SslPinningConfig {
  sha256Keys: Record<string, string[]>;
}
