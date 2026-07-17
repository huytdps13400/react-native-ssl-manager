import type { HybridObject } from 'react-native-nitro-modules';

/**
 * The narrow, struct-typed configuration crossing the Nitro bridge.
 *
 * Extended options (`domains`, `reportUris`) cross as a JSON string via
 * {@link SslManager.setSSLConfigJson} instead — both native sides persist and
 * parse the configuration as JSON, and a string avoids nested-struct codegen
 * for optional metadata.
 */
export interface SslPinningConfig {
  sha256Keys: Record<string, string[]>;
}

/** A pin-validation failure observed by the native layer. */
export interface PinningFailureEvent {
  /** Hostname whose served chain failed pin validation. */
  host: string;
  /** Whether pinning was enforced (`true`) or in audit mode (`false`). */
  enforced: boolean;
  /**
   * SPKI pins (`sha256/...`) of the served certificate chain, when the
   * platform can provide them (Android). May be empty on iOS.
   */
  servedPins: string[];
  /** Human-readable description of the failure. */
  message: string;
  /** Epoch milliseconds at which the failure was observed. */
  timestamp: number;
}

/**
 * Controls SSL certificate pinning enforcement at runtime.
 *
 * Pinning is initialized eagerly at app launch by native bootstrap code
 * (iOS TrustKit via an Objective-C `+load` hook; Android OkHttp + a Network
 * Security Config via an `androidx.startup` initializer), independent of this
 * object. These methods read state and update the configuration at runtime.
 */
export interface SslManager
  extends HybridObject<{
    ios: 'swift';
    android: 'kotlin';
  }> {
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
   * Updates the active SSL pinning configuration from a full JSON string,
   * including extended per-domain options (`domains`) and `reportUris`.
   * Validates before persisting; rejects on malformed input.
   */
  setSSLConfigJson(configJson: string): Promise<void>;

  /**
   * Resolves to the domains in the active configuration (the runtime
   * configuration if set, otherwise the bundled `ssl_config.json`).
   */
  getPinnedDomains(): Promise<string[]>;

  /**
   * Registers THE native pin-failure callback (a single slot; the JS layer
   * fans out to multiple listeners). Replaces any previous callback.
   */
  setPinningFailureCallback(
    callback: (event: PinningFailureEvent) => void
  ): void;

  /** Clears the native pin-failure callback. */
  clearPinningFailureCallback(): void;
}
