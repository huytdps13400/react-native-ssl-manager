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

export function multiply(a: number, b: number): Promise<number> {
  return UseSslPinning.multiply(a, b);
}

export const setUseSSLPinning = (usePinning: boolean) => {
  UseSslPinning.setUseSSLPinning(usePinning);
};

export const getUseSSLPinning = async (): Promise<boolean> => {
  return await UseSslPinning.getUseSSLPinning();
};
