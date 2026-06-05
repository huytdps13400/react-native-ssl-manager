import type { HybridObject } from 'react-native-nitro-modules';
import type { SslPinningConfig } from '../types/SslPinningConfig';

/**
 * Controls SSL certificate pinning enforcement at runtime.
 *
 * Pinning is initialized eagerly at app launch by native bootstrap code
 * (iOS TrustKit via an Objective-C `+load` hook; Android OkHttp + a Network
 * Security Config via an `androidx.startup` initializer), independent of this
 * object. These methods read state and update the configuration at runtime.
 */
export interface SslManager
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Enables or disables SSL pinning.
   *
   * On iOS, disabling at runtime takes effect on the next app launch because
   * TrustKit cannot be deinitialized within a running process.
   */
  setUseSSLPinning(usePinning: boolean): Promise<void>;

  /** Resolves to whether SSL pinning is currently enabled. */
  getUseSSLPinning(): Promise<boolean>;

  /**
   * Updates the active SSL pinning configuration.
   *
   * On Android the change applies to subsequent requests; on iOS it is
   * persisted and applied on the next app launch.
   *
   * @throws if the configuration is invalid (missing/empty `sha256Keys`).
   */
  setSSLConfig(config: SslPinningConfig): Promise<void>;

  /**
   * Resolves to the domains in the active configuration (the runtime
   * configuration if set, otherwise the bundled `ssl_config.json`).
   */
  getPinnedDomains(): Promise<string[]>;
}
