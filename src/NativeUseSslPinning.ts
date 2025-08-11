import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  setUseSSLPinning(usePinning: boolean): Promise<void>;
  getUseSSLPinning(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UseSslPinning');
