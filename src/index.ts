import { NitroModules } from 'react-native-nitro-modules';
import type { PinningFailureEvent, SslManager } from './specs/SslManager.nitro';
import type { SslPinningConfig } from './types/SslPinningConfig';
import { normalizeSslConfig } from './config';
import { OtaError, verifyOtaBundle } from './ota';
import type { OtaResult, OtaVerifyOptions, SignedPinBundle } from './ota';

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
 * also accepted for backwards compatibility). Supports the extended options:
 * per-domain `domains` metadata (`enforcePinning`, `expirationDate`,
 * `includeSubdomains`) and `reportUris`. On Android the change applies to
 * subsequent requests; on iOS it is persisted and applied on the next app
 * launch.
 */
export const setSSLConfig = (
  config: SslPinningConfig | string
): Promise<void> => {
  const parsed: SslPinningConfig =
    typeof config === 'string'
      ? (JSON.parse(config) as SslPinningConfig)
      : config;
  const normalized = normalizeSslConfig(parsed);
  return requireNative().setSSLConfigJson(JSON.stringify(normalized));
};

/**
 * Resolves to the list of domains in the active SSL pinning configuration
 * (runtime configuration if set, otherwise the bundled `ssl_config.json`).
 */
export const getPinnedDomains = (): Promise<string[]> =>
  requireNative().getPinnedDomains();

// --- Pin-failure events ----------------------------------------------------

export type PinningFailureListener = (event: PinningFailureEvent) => void;

const failureListeners = new Set<PinningFailureListener>();
let nativeCallbackRegistered = false;

/**
 * Registers a listener for pin-validation failures (both enforced blocks and
 * audit-mode observations). Returns an unsubscribe function.
 *
 * The native layer holds a single callback; this fan-out supports any number
 * of JS listeners. A listener throwing never affects other listeners.
 */
export const addPinningFailureListener = (
  listener: PinningFailureListener
): (() => void) => {
  const native = requireNative();
  failureListeners.add(listener);
  if (!nativeCallbackRegistered) {
    native.setPinningFailureCallback((event) => {
      for (const registered of failureListeners) {
        try {
          registered(event);
        } catch (error) {
          console.error(
            '[react-native-ssl-manager] pinning failure listener threw:',
            error
          );
        }
      }
    });
    nativeCallbackRegistered = true;
  }
  return () => {
    failureListeners.delete(listener);
  };
};

// --- Over-the-air pin updates ----------------------------------------------

export interface OtaUpdateOptions extends OtaVerifyOptions {
  /** Override the fetch implementation (testing / custom networking). */
  fetchFn?: typeof fetch;
}

/** `issuedAt` (epoch ms) of the last bundle applied in this session. */
let lastAppliedIssuedAt: number | null = null;

/**
 * Fetches an Ed25519-signed pin bundle (authored with
 * `npx react-native-ssl-manager sign`) and applies its configuration.
 *
 * The signature is verified against `options.publicKey` before anything is
 * applied; expired (`expiresAt` / `maxAgeMs`) and older-than-last-applied
 * bundles are rejected. On ANY failure the active configuration is untouched
 * and the promise rejects with an {@link OtaError} carrying a `code`
 * (`OTA_FETCH_FAILED`, `OTA_INVALID_SIGNATURE`, `OTA_EXPIRED`,
 * `OTA_ROLLBACK`, ...).
 */
export const updatePinsFromUrl = async (
  url: string,
  options: OtaUpdateOptions
): Promise<OtaResult> => {
  const native = requireNative();

  const fetchFn = options.fetchFn ?? fetch;
  let bundle: SignedPinBundle;
  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      throw new OtaError(
        'OTA_FETCH_FAILED',
        `Pin bundle fetch failed with HTTP ${response.status}`
      );
    }
    bundle = (await response.json()) as SignedPinBundle;
  } catch (error) {
    if (error instanceof OtaError) throw error;
    throw new OtaError(
      'OTA_FETCH_FAILED',
      `Pin bundle fetch failed: ${String(error)}`
    );
  }

  const result = verifyOtaBundle(bundle, {
    ...options,
    minIssuedAt: options.minIssuedAt ?? lastAppliedIssuedAt ?? undefined,
  });

  await native.setSSLConfigJson(JSON.stringify(result.config));
  lastAppliedIssuedAt = Date.parse(result.issuedAt);
  return result;
};

/** Direct access to the underlying HybridObject (or `null` if not linked). */
export const SslPinning = nativeSslManager;

export { normalizeSslConfig, SslConfigError, isExpired } from './config';
export { OtaError, verifyOtaBundle } from './ota';
export type {
  OtaResult,
  OtaVerifyOptions,
  OtaPayload,
  SignedPinBundle,
} from './ota';
export type { SslManager, PinningFailureEvent } from './specs/SslManager.nitro';
export type {
  SslPinningConfig,
  SslDomainOptions,
} from './types/SslPinningConfig';
export type { SslPinningError } from './UseSslPinning.types';
