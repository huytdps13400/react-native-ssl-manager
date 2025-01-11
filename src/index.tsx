import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-use-ssl-pinning' doesn't seem to be linked. Make sure: \n\n` +
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

export const setUseSSLPinning = (usePinning: boolean): void => {
  UseSslPinning.setUseSSLPinning(usePinning);
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
 * @returns {Promise<any>} A promise that resolves when the SSL pinning is initialized.
 */
export const initializeSslPinning = async (
  configJsonString: string
): Promise<any> => {
  return await UseSslPinning.initializeSslPinning(configJsonString);
};
