/**
 * SSL Pinning Configuration Interface
 * Defines the structure for SSL pinning configuration
 */
export interface SslPinningConfig {
  domains: {
    development: string;
    production: string;
  };
  sha256Keys: {
    [domain: string]: string[];
  };
}

/**
 * SSL Pinning Result Interface
 * Defines the structure for SSL pinning operation results
 */
export interface SslPinningResult {
  message: string;
  isEnabled: boolean;
  domains?: string[];
}

/**
 * SSL Pinning Plugin Options Interface
 * Defines options for the Expo config plugin
 */
export interface SslPinningPluginOptions {
  enableAndroid?: boolean;
  enableIOS?: boolean;
  configPath?: string;
}

/**
 * SSL Pinning Error Types
 * Defines possible error scenarios
 */
export enum SslPinningErrorType {
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  EXPO_GO_NOT_SUPPORTED = 'EXPO_GO_NOT_SUPPORTED',
}

/**
 * SSL Pinning Error Interface
 * Defines error structure for SSL pinning operations
 */
export interface SslPinningError {
  type: SslPinningErrorType;
  message: string;
  details?: any;
}
