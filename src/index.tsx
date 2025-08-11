import { Platform } from 'react-native';

// Export types from the library
export type { SslPinningConfig, SslPinningError } from './UseSslPinning.types';

// New Architecture and Legacy Architecture support
let UseSslPinning: any;

try {
  // Try New Architecture first (TurboModule)
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      UseSslPinning = require('./NativeUseSslPinning').default;
    } catch (turboModuleError) {
      // Fallback to Legacy Architecture
      try {
        const { NativeModules } = require('react-native');
        UseSslPinning = NativeModules.UseSslPinning;
      } catch (legacyError) {
        UseSslPinning = null;
      }
    }
  }
} catch (error) {
  UseSslPinning = null;
}

// Fallback implementation if native module is not available
if (!UseSslPinning) {
  UseSslPinning = {
    setUseSSLPinning: (_usePinning: boolean) => {
      return Promise.resolve();
    },
    getUseSSLPinning: () => {
      return Promise.resolve(true);
    },
  };
}

/**
 * Sets whether SSL pinning should be used.
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
