// Export types from the library
export type { SslPinningConfig, SslPinningError } from './UseSslPinning.types';

import type { SslPinningConfig } from './UseSslPinning.types';

// New Architecture and Legacy Architecture support
let UseSslPinning: any;
let isNativeModuleAvailable = false;

try {
  // Try Legacy NativeModules first (more reliable)
  const { NativeModules } = require('react-native');

  // Look for our universal module (works in both CLI and Expo)
  UseSslPinning = NativeModules.UseSslPinning;

  if (UseSslPinning) {
    isNativeModuleAvailable = true;
  } else {
    // Fallback to TurboModule if available
    try {
      UseSslPinning = require('./NativeUseSslPinning').default;
      isNativeModuleAvailable = !!UseSslPinning;
    } catch (turboModuleError) {
      console.log(
        '❌ TurboModule failed:',
        (turboModuleError as Error).message
      );
      UseSslPinning = null;
    }
  }
} catch (error) {
  console.log('❌ Overall module loading failed:', (error as Error).message);
  UseSslPinning = null;
}

// Fallback implementation if native module is not available.
// IMPORTANT: this is a no-op shim. It does NOT perform any SSL pinning, so we
// warn loudly to avoid a false sense of security.
if (!UseSslPinning) {
  const warnMissing = () => {
    console.warn(
      '[react-native-ssl-manager] Native module is not available — SSL pinning ' +
        'is NOT active. Calls resolve as no-ops. Rebuild the app (and run ' +
        '`pod install` / Expo prebuild) so the native module is linked.'
    );
  };

  UseSslPinning = {
    setUseSSLPinning: (_usePinning: boolean) => {
      warnMissing();
      return Promise.resolve();
    },
    getUseSSLPinning: () => {
      warnMissing();
      // Reflect reality: nothing is being pinned.
      return Promise.resolve(false);
    },
    setSSLConfig: (_config: string) => {
      warnMissing();
      return Promise.resolve();
    },
    getPinnedDomains: () => {
      warnMissing();
      return Promise.resolve([] as string[]);
    },
  };
}

/**
 * Whether the native SSL pinning module is linked and available.
 * When false, all functions below are no-ops and pinning is NOT enforced.
 */
export const isSSLManagerAvailable = (): boolean => isNativeModuleAvailable;

/**
 * Sets whether SSL pinning should be used.
 *
 * Note: on iOS, disabling at runtime takes effect on the next app launch
 * because TrustKit cannot be un-initialized within a running process.
 *
 * @param {boolean} usePinning - Whether to enable SSL pinning
 * @returns {Promise<void>} A promise that resolves when the setting is saved
 */
export const setUseSSLPinning = (usePinning: boolean): Promise<void> => {
  return UseSslPinning.setUseSSLPinning(usePinning);
};

/**
 * Retrieves the current state of SSL pinning usage.
 *
 * @returns A promise that resolves to a boolean indicating whether SSL pinning is being used.
 */
export const getUseSSLPinning = async (): Promise<boolean> => {
  return await UseSslPinning.getUseSSLPinning();
};

/**
 * Updates the SSL pinning configuration at runtime.
 *
 * Accepts either a {@link SslPinningConfig} object or a pre-serialized JSON
 * string. On Android the change applies to subsequent requests immediately; on
 * iOS the change is persisted and applied on the next app launch (TrustKit can
 * only be initialized once per process).
 *
 * @param config - The SSL pinning configuration (object or JSON string)
 * @returns A promise that resolves when the configuration is saved
 */
export const setSSLConfig = (
  config: SslPinningConfig | string
): Promise<void> => {
  const serialized = typeof config === 'string' ? config : JSON.stringify(config);
  return UseSslPinning.setSSLConfig(serialized);
};

/**
 * Retrieves the list of domains in the active SSL pinning configuration
 * (runtime configuration if set, otherwise the bundled `ssl_config.json`).
 *
 * @returns A promise that resolves to the configured domain names
 */
export const getPinnedDomains = async (): Promise<string[]> => {
  return await UseSslPinning.getPinnedDomains();
};
