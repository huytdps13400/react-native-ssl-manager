/**
 * SSL Pinning Configuration Interface
 * Defines the structure for SSL pinning configuration
 */
export interface SslPinningConfig {
  sha256Keys: {
    [domain: string]: string[];
  };
  /**
   * Optional global pin expiration date (`YYYY-MM-DD`). After this date pinning
   * stops being enforced (fail-open) on both platforms, preventing a permanent
   * lockout when certificates rotate.
   */
  expiration?: string;
  /**
   * Whether to enforce pinning (default `true`). When `false`, pinning runs in
   * monitor mode: iOS uses TrustKit report-only mode and Android does not apply
   * a CertificatePinner / generate a Network Security Config pin-set, so a
   * mismatch does not block the connection.
   */
  enforcePinning?: boolean;
}

/**
 * SSL Pinning Error Interface
 */
export interface SslPinningError extends Error {
  code?: string;
  message: string;
}
