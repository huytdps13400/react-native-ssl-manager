import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  readonly setUseSSLPinning: (usePinning: boolean) => Promise<void>;
  readonly getUseSSLPinning: () => Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UseSslPinning');
