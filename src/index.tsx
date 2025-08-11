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
        console.warn(
          'react-native-ssl-manager: Could not load native module in both New and Legacy architecture'
        );
        UseSslPinning = null;
      }
    }
  }
} catch (error) {
  console.warn(
    'react-native-ssl-manager: Could not import react-native, using fallback'
  );
  UseSslPinning = null;
}

// Fallback implementation if native module is not available
if (!UseSslPinning) {
  UseSslPinning = {
    setUseSSLPinning: (usePinning: boolean) => {
      console.warn(
        'react-native-ssl-manager: Native module not available, SSL pinning will work via TrustKit/OkHttp auto-initialization'
      );
      console.log('react-native-ssl-manager: SSL pinning setting:', usePinning);
      return Promise.resolve();
    },
    getUseSSLPinning: () => {
      console.warn(
        'react-native-ssl-manager: Native module not available, returning default true'
      );
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
