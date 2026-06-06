/**
 * SSL Pinning Error Interface
 */
export interface SslPinningError extends Error {
  code?: string;
  message: string;
}
