import { NitroModules } from 'react-native-nitro-modules';
import type { SslManager } from './specs/SslManager.nitro';
import type { SslPinningConfig } from './types/SslPinningConfig';

/**
 * The SSL pinning HybridObject. Pinning itself is initialized eagerly at app
 * launch by native bootstrap code (iOS TrustKit, Android OkHttp + Network
 * Security Config), independent of this object — these methods are the runtime
 * control surface.
 *
 * Resolves to `null` only if the native module is not linked (e.g. the app was
 * not rebuilt). In that case the functions below throw rather than silently
 * pretending pinning is active.
 */
let nativeSslManager: SslManager | null = null;
try {
  nativeSslManager = NitroModules.createHybridObject<SslManager>('SslManager');
} catch {
  nativeSslManager = null;
}

function requireNative(): SslManager {
  if (nativeSslManager == null) {
    throw new Error(
      '[react-native-ssl-manager] Native module is not available — SSL pinning ' +
        'is NOT active. Rebuild the app (pod install / gradle sync, or Expo ' +
        'prebuild) so the Nitro module is linked.'
    );
  }
  return nativeSslManager;
}

/**
 * Whether the native SSL pinning module is linked and available. When `false`,
 * the functions below throw and pinning is NOT enforced via this API.
 */
export const isSSLManagerAvailable = (): boolean => nativeSslManager != null;

/**
 * Enables or disables SSL pinning.
 *
 * On iOS, disabling at runtime takes effect on the next app launch because
 * TrustKit cannot be deinitialized within a running process.
 */
export const setUseSSLPinning = (usePinning: boolean): Promise<void> =>
  requireNative().setUseSSLPinning(usePinning);

/** Resolves to whether SSL pinning is currently enabled. */
export const getUseSSLPinning = (): Promise<boolean> =>
  requireNative().getUseSSLPinning();

/**
 * Updates the SSL pinning configuration at runtime.
 *
 * Accepts a {@link SslPinningConfig} object (a pre-serialized JSON string is
 * also accepted for backwards compatibility and parsed before crossing the
 * native boundary). On Android the change applies to subsequent requests; on
 * iOS it is persisted and applied on the next app launch.
 */
export const setSSLConfig = (
  config: SslPinningConfig | string
): Promise<void> => {
  const parsed: SslPinningConfig =
    typeof config === 'string'
      ? (JSON.parse(config) as SslPinningConfig)
      : config;
  return requireNative().setSSLConfig(parsed);
};

/**
 * Resolves to the list of domains in the active SSL pinning configuration
 * (runtime configuration if set, otherwise the bundled `ssl_config.json`).
 */
export const getPinnedDomains = (): Promise<string[]> =>
  requireNative().getPinnedDomains();

/** Direct access to the underlying HybridObject (or `null` if not linked). */
export const SslPinning = nativeSslManager;

export type { SslManager } from './specs/SslManager.nitro';
export type { SslPinningConfig } from './types/SslPinningConfig';
export type { SslPinningError } from './UseSslPinning.types';
