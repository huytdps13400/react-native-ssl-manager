import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  readonly setUseSSLPinning: (usePinning: boolean) => Promise<void>;
  readonly getUseSSLPinning: () => Promise<boolean>;
  readonly setSSLConfig: (config: string) => Promise<void>;
  readonly getPinnedDomains: () => Promise<string[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UseSslPinning');
