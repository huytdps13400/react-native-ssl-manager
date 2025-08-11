/**
 * SSL Pinning Configuration Interface
 * Defines the structure for SSL pinning configuration
 */
export interface SslPinningConfig {
  sha256Keys: {
    [domain: string]: string[];
  };
}

/**
 * SSL Pinning Error Interface
 */
export interface SslPinningError extends Error {
  code?: string;
  message: string;
}
