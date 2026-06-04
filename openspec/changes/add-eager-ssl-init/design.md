## Context

React Native instantiates native modules lazily. Under the New Architecture
(TurboModules) and on iOS generally, a module's constructor does not run until
JS first accesses the module. Today both platforms perform pinning setup inside
that constructor:

- iOS `UseSslPinningModule.swift` `init()` calls `initializeSslPinningFromBundle()`.
- Android `UseSslPinningModule` `init {}` calls `UseSslPinningModuleImpl.initialize()`.

Therefore, configuration delivered purely at build time (Expo plugin, bundled
`ssl_config.json`, generated Network Security Config) does not produce runtime
enforcement until a JS call wakes the module. iOS has no build-time pinning at
all, so it is fully unprotected until then.

## Goals / Non-Goals

- Goals: enforce pinning at app launch with no required JS call; keep the JS
  toggle API working; expose runtime config; fail loudly; keep config defaults
  safe and configurable.
- Non-Goals: changing the pin format; removing the Network Security Config path
  (it remains the OS-level Android enforcement); supporting per-request pinning.

## Decisions

- iOS eager init via Objective-C `+load`. `+load` runs at image load, before
  `main()`, which is early enough to initialize TrustKit before any URLSession
  is created. We call into Swift via `NSClassFromString("SharedLogic")` +
  `objc_msgSend` to avoid depending on the generated `-Swift.h` header name,
  which varies by module name. The Swift class is annotated `@objc(SharedLogic)`
  so the runtime name is stable. The module constructor keeps its init call as a
  redundant safety net.
  - Alternative considered: injecting code into AppDelegate via the Expo plugin.
    Rejected as version-fragile (ObjC vs Swift AppDelegate across SDKs) and
    useless for bare React Native.

- Android eager init via `androidx.startup.Initializer`. Its `create()` runs
  from a ContentProvider before `Application.onCreate`, which is before the RN
  bridge is built — early enough to install the `OkHttpClientFactory`.
  - Alternative considered: requiring users to call `initialize()` in
    `MainApplication.onCreate`. Rejected: not automatic, easy to forget.

- TrustKit can only be initialized once per process. We guard
  `initSharedInstance` behind a static flag. Disabling pinning at runtime on iOS
  therefore cannot un-swizzle URLSession; it takes effect on next launch. This
  is documented.

- Runtime config is passed as a JSON string across the bridge to keep codegen
  simple and avoid complex object marshaling. iOS persists it in `UserDefaults`;
  Android persists it in `SharedPreferences` (the existing factory already reads
  this key) and invalidates the cached `PinnedOkHttpClient`.

## Risks / Trade-offs

- `+load` requires the translation unit to be linked. The bootstrap lives in the
  same `.mm` that React Native compiles for the pod, and the module constructor
  remains as a fallback, so worst case behavior is unchanged from today.
- Changing the TurboModule spec signature requires consumers to re-run codegen
  on their next build. This is expected for a native library upgrade.
- iOS runtime-disable semantics change from "appears to disable" to "disables on
  next launch". Documented; safer than a false sense of toggling.

## Migration Plan

No API removals. New methods are additive. Existing `setUseSSLPinning` /
`getUseSSLPinning` behavior is preserved. Consumers rebuild as normal.

## Open Questions

- None blocking. Future work could add a TrustKit report URI option.
