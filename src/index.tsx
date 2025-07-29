import { NativeModules, Platform } from 'react-native';
import type { SslPinningResult } from './UseSslPinning.types';

// Export types from the library
export type {
  SslPinningConfig,
  SslPinningResult,
  SslPinningPluginOptions,
  SslPinningError,
} from './UseSslPinning.types';
export { SslPinningErrorType } from './UseSslPinning.types';

const LINKING_ERROR =
  `The package 'react-native-ssl-manager' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const UseSslPinning = NativeModules.UseSslPinning
  ? NativeModules.UseSslPinning
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

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
 * Initializes SSL pinning with the provided configuration.
 *
 * @param {string} configJsonString - The JSON string containing the SSL pinning configuration.
 * @returns {Promise<SslPinningResult>} A promise that resolves when the SSL pinning is initialized.
 */
export const initializeSslPinning = async (
  configJsonString: string
): Promise<SslPinningResult> => {
  return await UseSslPinning.initializeSslPinning(configJsonString);
};
