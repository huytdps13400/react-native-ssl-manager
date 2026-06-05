# Migration guide

## v1.x → v2.0 (Nitro Modules)

v2 rebuilds `react-native-ssl-manager` as a [Nitro Module](https://nitro.margelo.com).
The **public JavaScript API is unchanged in name and behavior** — most apps only
need to update dependencies and rebuild.

### 1. Requirements

- **React Native 0.75+** with the **New Architecture** enabled.
- Build tooling: Xcode 16.4+, Android `compileSdk` 34+, NDK 27+.

### 2. Install the new peer dependency

```bash
npm install react-native-ssl-manager react-native-nitro-modules
# or
yarn add react-native-ssl-manager react-native-nitro-modules
```

Then rebuild the native projects:

```bash
cd ios && pod install   # iOS
# Android: a normal Gradle sync / rebuild
# Expo: npx expo prebuild --clean
```

### 3. API changes

The exported functions are the same:

```ts
import {
  setUseSSLPinning,
  getUseSSLPinning,
  setSSLConfig,
  getPinnedDomains,
  isSSLManagerAvailable,
} from 'react-native-ssl-manager';
```

Two behavioral changes to be aware of:

- **`setSSLConfig` takes an object.** Passing a `SslPinningConfig` object is
  preferred. A pre-serialized JSON string still works (it is parsed before
  crossing the native boundary), so existing string callers keep working.
- **No more silent no-op fallback.** If the native module is not linked (e.g.
  the app was not rebuilt), the functions now **throw** a clear error instead of
  resolving as no-ops, and `isSSLManagerAvailable()` returns `false`. Guard with
  `isSSLManagerAvailable()` if you need to handle that case. (A silent no-op
  could be mistaken for active pinning.)

### 4. Certificate rotation / expiration

The Android Network Security Config no longer sets a `pin-set expiration`. In v1
pins defaulted to expiring one year after build, after which Android **silently
stopped enforcing** them (a fail-open). In v2 **pins never expire and are always
enforced**, so make sure your pin-rotation process updates the app's pins
(ship a backup pin per domain) before certificates change.

### 5. Removed options

These v1.1.x options were removed (they enabled fail-open behavior that weakened
the pinning guarantee):

- the `expiration` and `enforcePinning` fields in `ssl_config.json`
- the `pinExpiration` Expo plugin option, the `sslPinExpiration` Gradle
  property, and the `SSL_PIN_EXPIRATION` environment variable
