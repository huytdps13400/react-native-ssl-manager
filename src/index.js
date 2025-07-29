const { NativeModules, Platform } = require('react-native');
const { SslPinningErrorType } = require('./UseSslPinning.types');
const LINKING_ERROR =
  `The package 'react-native-ssl-manager' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';
// Try to get the module from NativeModules
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
/**
 * Sets whether SSL pinning should be used.
 *
 * @param {boolean} usePinning - Whether to enable SSL pinning
 * @returns {Promise<void>} A promise that resolves when the setting is saved
 */
const setUseSSLPinning = (usePinning) => {
  return UseSslPinning.setUseSSLPinning(usePinning);
};
/**
 * Retrieves the current state of SSL pinning usage.
 *
 * @returns A promise that resolves to a boolean indicating whether SSL pinning is being used.
 */
const getUseSSLPinning = async () => {
  return await UseSslPinning.getUseSSLPinning();
};
/**
 * Initializes SSL pinning with the provided configuration.
 *
 * @param {string} configJsonString - The JSON string containing the SSL pinning configuration.
 * @returns {Promise<SslPinningResult>} A promise that resolves when the SSL pinning is initialized.
 */
const initializeSslPinning = async (configJsonString) => {
  return await UseSslPinning.initializeSslPinning(configJsonString);
};

module.exports = {
  SslPinningErrorType,
  setUseSSLPinning,
  getUseSSLPinning,
  initializeSslPinning,
};
