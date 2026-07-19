# react-native-ssl-manager

[![npm version](https://img.shields.io/npm/v/react-native-ssl-manager.svg)](https://www.npmjs.com/package/react-native-ssl-manager)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ssl-manager.svg)](https://www.npmjs.com/package/react-native-ssl-manager)
[![license](https://img.shields.io/npm/l/react-native-ssl-manager.svg)](./LICENSE)

SSL **certificate pinning** for React Native and Expo, enforced by the platform's
own networking layer — TrustKit on iOS and Network Security Config on Android.

## What is certificate pinning (and do I need it)?

When your app talks to your API over HTTPS, the OS trusts *any* certificate
signed by a trusted authority. Someone who can install their own trusted
certificate — a corporate proxy, a compromised device, or a tool like Charles or
Proxyman — can then read and modify your traffic. That's a
**man-in-the-middle (MITM)** attack.

**Pinning** tells your app to trust only *specific* certificates (yours). If the
certificate doesn't match, the connection is refused. This library sets that up
on both platforms from a single config file.

> Handling logins, payments, or other sensitive data? Pinning is a strong extra
> layer. Building a hobby app that only hits public APIs? You probably don't
> need it.

## Requirements

This is **v2**, built as a [Nitro Module](https://nitro.margelo.com). It runs on
the **New Architecture** only.

| | Minimum |
|---|---|
| React Native | **0.75+** with the New Architecture enabled |
| `react-native-nitro-modules` | 0.35.0 (peer dependency) |
| Expo | **SDK 52+** (New Architecture) |
| iOS | 13.0 |
| Android | API 21 (Android 5.0) |
| Node | 18+ |

> Upgrading from v1? The JavaScript API is unchanged — see
> [`MIGRATION.md`](./MIGRATION.md).

---

## Get started

You only need three things: install the package, add a config file, rebuild.
Pinning then turns on **automatically at app launch** — no JavaScript required.

### 1. Install

```bash
npm install react-native-ssl-manager react-native-nitro-modules
# or
yarn add react-native-ssl-manager react-native-nitro-modules
# or
pnpm add react-native-ssl-manager react-native-nitro-modules
# or
bun add react-native-ssl-manager react-native-nitro-modules
```

Then follow **either** the Expo path or the bare React Native path.

#### Expo

Add the plugin to `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "plugins": [
      ["react-native-ssl-manager", { "sslConfigPath": "./ssl_config.json" }]
    ]
  }
}
```

Then regenerate the native projects with `npx expo prebuild --clean` (EAS Build
does this for you). The plugin copies `ssl_config.json` into the iOS app group,
adds it to **Copy Bundle Resources**, copies it into Android `assets/`, and
generates Network Security Config — no `postinstall` mutation required.

Plugin options:

| Option | Default | Description |
|--------|---------|-------------|
| `sslConfigPath` | `"ssl_config.json"` | Path to your config, relative to the project root |
| `enableAndroid` | `true` | Generate the Android Network Security Config + patch the manifest |
| `enableIOS` | `true` | Bundle the config into the iOS app |

#### Bare React Native (CLI)

Install the iOS pods, then rebuild:

```bash
cd ios && pod install
```

On a classic hoisted layout (npm / yarn classic / bun default), the optional
`postinstall` script can wire Android's `ssl-pinning-setup.gradle` for you.
On **pnpm** or **monorepos**, that script **does not mutate** your
`build.gradle` (isolated `node_modules` make hardcoded paths wrong). Either:

1. **Expo prebuild path** (recommended if you use Expo), or
2. Manually apply the Gradle script once (see [Monorepo & pnpm](#monorepo--pnpm)
   below), or
3. Set `SSL_MANAGER_SKIP_POSTINSTALL=1` if you manage native wiring yourself.

### 2. Create `ssl_config.json`

Create a file named exactly **`ssl_config.json`** in your project root. The
bundled CLI prints the pins for a live domain (no openssl needed):

```bash
npx react-native-ssl-manager pins api.example.com
```

Paste the result into your config:

```json
{
  "sha256Keys": {
    "api.example.com": [
      "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
    ]
  }
}
```

- The key is the domain (subdomains are included by default).
- The value is a list of **public-key pins** (base64 SHA-256 of the certificate's
  public key), each prefixed with `sha256/`.

> **Always list at least two pins per domain** — your current certificate plus a
> **backup**. If you pin only one and that certificate is rotated or revoked,
> every installed app locks itself out of your API until users update. The backup
> pin is your safety net.

<details>
<summary>Prefer openssl to get a pin manually?</summary>

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com < /dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
```

</details>

### 3. That's it — pinning is active at launch

Once `ssl_config.json` is bundled, **SSL pinning is enforced automatically at app
launch — no JavaScript call is required.** On iOS this is wired up through an
Objective-C `+load` bootstrap; on Android through an `androidx.startup`
initializer that installs the pinned OkHttp client before React Native's
networking stack starts.

### 4. Verify it's working

**Android** (bare RN), after a build:

```bash
cd android && ./gradlew checkSslConfig
```

**Any project** — check for drift against the live certificates:

```bash
npx react-native-ssl-manager verify
```

**The real test:** open a proxy tool (Charles / Proxyman) with its root
certificate installed and try to intercept your app's traffic. With pinning
active, requests to your pinned domains should **fail** the TLS handshake;
non-pinned domains are unaffected. On iOS you can also watch the launch log
(`xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "RNSSLManager"'`)
for `SSL pinning ACTIVE …` or `BLOCKED connection to <host> …`.

---

## Monorepo & pnpm

This library is a **Nitro Module**. It must be present in the app package that
builds native code, and the app must use the **New Architecture**.

### Why pnpm “isolated” installs look different from bun “hoisted”

| Manager | Default layout | What breaks a naive `postinstall` |
|---------|----------------|-----------------------------------|
| **bun** / yarn classic | Hoisted flat `node_modules` | Rarely — `../../node_modules/pkg` often works |
| **pnpm** | Content-addressable store + symlinks under `node_modules/.pnpm` | Hardcoded `../../node_modules/react-native-ssl-manager/...` often points at nothing |
| **npm workspaces / pnpm monorepo** | Package may live under `apps/mobile`, deps at root | Walking up to the first `node_modules` can pick the wrong root |

Because of that, **`postinstall` is intentionally non-mutating on monorepo and
pnpm-isolated installs**. Prefer the Expo config plugin, or apply the Gradle
script yourself with a path resolved via Node (not a guessed relative path).

### Disable postinstall entirely

```bash
# one-shot
SSL_MANAGER_SKIP_POSTINSTALL=1 pnpm install

# or in the app package.json
"scripts": {
  "preinstall": "echo skip",
  "postinstall": "echo 'managed manually'"
}
```

You can also set `SSL_MANAGER_SKIP_POSTINSTALL=1` in CI / `.npmrc` env so the
library never touches `android/app/build.gradle` or the manifest.

### Expo in a monorepo

1. Install in the **app** package (not only the workspace root):

   ```bash
   pnpm add react-native-ssl-manager react-native-nitro-modules --filter your-app
   ```

2. Put `ssl_config.json` next to that app’s `app.json` (or set `sslConfigPath`
   relative to the app root).

3. Register the plugin and prebuild from the app directory:

   ```bash
   cd apps/your-app
   npx expo prebuild --clean
   ```

4. Confirm after prebuild:

   - iOS: `ios/<AppName>/ssl_config.json` exists and is listed under the app
     target’s **Copy Bundle Resources** in Xcode
   - Android: `android/app/src/main/assets/ssl_config.json` and
     `res/xml/network_security_config.xml`

### Bare RN + pnpm (no Expo)

In `android/app/build.gradle`, apply the setup script with a path that works
under pnpm (relative from the resolved package, or a path you control):

```gradle
// Example: if the package is linked into this app's node_modules
apply from: new File([
  "node", "--print",
  "require('path').join(require('path').dirname(require.resolve('react-native-ssl-manager/package.json')), 'android/ssl-pinning-setup.gradle')"
].execute(null, rootDir).text.trim())
```

iOS does not need that script: the podspec copies `ssl_config.json` at build
time by searching common monorepo locations under `SRCROOT`.

### Testing this library (maintainers & integrators)

From the repo root:

```bash
# Unit + contract tests (plugin Xcode wiring, NSC, OTA, Nitro surface, monorepo helpers)
yarn test
# or
./node_modules/.bin/jest

# Typecheck the public TS / Nitro spec
yarn typecheck

# Regenerate Nitro bindings after editing src/specs/*.nitro.ts
yarn specs
```

**Expo prebuild smoke (example app):**

```bash
cd example-expo
# ensure peer is present
yarn add react-native-nitro-modules
npx expo prebuild --clean --platform ios
# expect: no "Failed to add ssl_config.json to Xcode project"
# expect: ios/<Project>/ssl_config.json present
```

**Nitro runtime (device/simulator):** rebuild a host app that depends on both
`react-native-ssl-manager` and `react-native-nitro-modules`, then:

```ts
import { isSSLManagerAvailable, getPinnedDomains } from 'react-native-ssl-manager';

console.log(isSSLManagerAvailable()); // must be true after a native rebuild
console.log(await getPinnedDomains());
```

If `isSSLManagerAvailable()` is `false`, the Nitro module is not linked — fix
autolinking / pods / New Architecture before debugging pins.

---

## Going further (all optional)

The basics above are all most apps need. Everything below is optional.

### Control pinning from JavaScript

```typescript
import {
  isSSLManagerAvailable,
  setUseSSLPinning,
  getUseSSLPinning,
  setSSLConfig,
  getPinnedDomains,
} from 'react-native-ssl-manager';

// Is the native module linked? If false, the calls below throw and pinning is
// NOT active — you probably need to rebuild the app.
isSSLManagerAvailable();

await setUseSSLPinning(false);          // turn pinning off/on
const enabled = await getUseSSLPinning();
await setSSLConfig({ sha256Keys: { 'api.example.com': ['sha256/AAAA...=', 'sha256/BBBB...='] } });
const domains = await getPinnedDomains();
```

> **iOS caveat:** TrustKit can only be initialized once per process, so
> **disabling or changing pins at runtime only takes full effect on the next app
> launch**. On **Android** the change applies to the next request immediately.

```typescript
import { setUseSSLPinning } from 'react-native-ssl-manager';
import RNRestart from 'react-native-restart'; // optional helper

await setUseSSLPinning(false);
RNRestart.Restart(); // needed on iOS to apply the change now
```

Pinning is **enabled by default**. The on/off state is persisted in
`UserDefaults` (iOS) and `SharedPreferences` (Android, `AppSettings` /
`useSSLPinning`).

### Per-domain options and audit mode

Beyond the flat `sha256Keys` map, you can set per-domain options and a reporting
endpoint:

```json
{
  "sha256Keys": {
    "api.example.com": ["sha256/AAAA...=", "sha256/BBBB...="],
    "staging.example.com": ["sha256/CCCC...=", "sha256/DDDD...="]
  },
  "domains": {
    "api.example.com": { "expirationDate": "2027-06-30" },
    "staging.example.com": { "enforcePinning": false, "includeSubdomains": false }
  },
  "reportUris": ["https://reports.example.com/pin-failures"]
}
```

| Option | Default | Effect |
|--------|---------|--------|
| `enforcePinning` | `true` | `false` = **audit mode**: mismatches are reported but never block the connection — the safe way to roll pinning out |
| `expirationDate` | none | `YYYY-MM-DD`; after this date pinning for the domain **fails open** on both platforms (a circuit breaker for abandoned installs) |
| `includeSubdomains` | `true` | Whether pins apply to subdomains |
| `reportUris` (top-level) | none | HTTPS endpoints that receive an HPKP-style JSON POST on every pin failure (deduplicated, best-effort) |

### Observe pin failures

```typescript
import { addPinningFailureListener } from 'react-native-ssl-manager';

const unsubscribe = addPinningFailureListener((event) => {
  // { host, enforced, servedPins, message, timestamp }
  analytics.track('ssl_pin_failure', event);
});
```

Fires for enforced blocks **and** audit-mode (`enforcePinning: false`)
mismatches. Set `reportUris` to also receive server-side JSON reports with the
served-chain pins (Android) for fleet-wide monitoring.

### Rotate pins over the air (OTA)

Rotate pins without shipping an app update. Author a signed bundle on CI or a
maintainer machine (keep the private key offline):

```bash
npx react-native-ssl-manager keygen                     # once; prints the public key
npx react-native-ssl-manager sign --config ssl_config.json \
  --key ssl-manager-ota.key.pem --expires-in 30d --out ssl-pins-bundle.json
# host ssl-pins-bundle.json anywhere (CDN, S3, your API)
```

Apply it from the app — the Ed25519 signature is verified before anything
changes:

```typescript
import { updatePinsFromUrl } from 'react-native-ssl-manager';

await updatePinsFromUrl('https://cdn.example.com/ssl-pins-bundle.json', {
  publicKey: 'Z8S8T6o...=', // from keygen — safe to embed in the app
  maxAgeMs: 7 * 24 * 3600 * 1000,
});
```

Tampered, expired, or rolled-back bundles are rejected (`OTA_INVALID_SIGNATURE`,
`OTA_EXPIRED`, `OTA_ROLLBACK`) and the active config stays untouched.

### Catch pin drift in CI

```bash
npx react-native-ssl-manager verify   # exit 1 when an enforced domain's live
                                       # chain matches none of its pins
```

Run it on a schedule (cron / CI). It warns 30 days before a configured
`expirationDate` and prints the served pins whenever a domain drifts — so a
certificate rotation never silently strands your installed base.

---

## CLI

The package ships a CLI (`npx react-native-ssl-manager <command>`, alias
`ssl-manager`) built on Node built-ins — no openssl required:

| Command | Purpose |
|---------|---------|
| `pins <host> [--port 443] [--json]` | Print SPKI pins for the live chain + a ready-to-paste config snippet |
| `pins --pem cert.pem` | Pin from a local PEM certificate (offline) |
| `verify [--config ssl_config.json]` | Diff live chains against configured pins; exit 1 on enforced drift (CI-friendly); warns 30 days before expiration |
| `keygen [--out dir]` | Generate an Ed25519 keypair for OTA bundles |
| `sign --config <path> --key <pem> [--expires-in 30d]` | Author a signed OTA pin bundle for `updatePinsFromUrl` |

## API reference

### `isSSLManagerAvailable(): boolean`

Whether the native module is linked. When `false`, every other function below
**throws** (pinning is not active) — rebuild the app so the native module links.

### `setUseSSLPinning(usePinning: boolean): Promise<void>`

Enable or disable pinning. On iOS the change applies on the next app launch; on
Android it applies to subsequent requests immediately.

### `getUseSSLPinning(): Promise<boolean>`

The current pinning state. Defaults to `true` if never changed.

### `setSSLConfig(config: SslPinningConfig | string): Promise<void>`

Replace the configuration at runtime. Accepts a config object (preferred) or a
pre-serialized JSON string. Rejects with a coded error on malformed input. iOS
applies it on the next launch; Android applies it to subsequent requests.

### `getPinnedDomains(): Promise<string[]>`

The domains in the active configuration (runtime config if set, otherwise the
bundled `ssl_config.json`).

### `addPinningFailureListener(listener): () => void`

Register a listener for pin-validation failures (enforced blocks and audit-mode
mismatches). Returns an unsubscribe function. Any number of listeners can be
registered; a listener throwing never affects the others.

### `updatePinsFromUrl(url, options): Promise<OtaResult>`

Fetch an Ed25519-signed pin bundle (authored with the `sign` CLI command),
verify it against `options.publicKey`, and apply the contained configuration.
Rejects with a coded `OtaError` on any failure — the active configuration is
never touched by an invalid bundle. Options: `publicKey` (base64, required),
`maxAgeMs`, `minIssuedAt`, `fetchFn`.

### Types

```typescript
interface SslPinningConfig {
  sha256Keys: { [domain: string]: string[] }; // each pin prefixed with "sha256/"
  domains?: {
    [domain: string]: {
      enforcePinning?: boolean;    // default true; false = audit/report-only
      expirationDate?: string;     // YYYY-MM-DD, fail-open after this date
      includeSubdomains?: boolean; // default true
    };
  };
  reportUris?: string[];           // https:// endpoints for failure reports
}

interface PinningFailureEvent {
  host: string;
  enforced: boolean;    // false = audit-mode observation
  servedPins: string[]; // SPKI pins the server presented (Android; empty on iOS)
  message: string;
  timestamp: number;    // epoch ms
}

interface SslPinningError extends Error {
  code?: string;
  message: string;
}
```

## Which networking libraries are covered?

| Stack | Platform | Covered | Via |
|-------|----------|---------|-----|
| `fetch` / `axios` | iOS | ✅ | TrustKit swizzling |
| `URLSession` | iOS | ✅ | TrustKit swizzling |
| `SDWebImage`, `Alamofire`, other `URLSession` libs | iOS | ✅ | TrustKit swizzling |
| `fetch` / `axios` | Android | ✅ | OkHttp factory + NSC |
| OkHttp (direct) | Android | ✅ | NSC + `CertificatePinner` |
| Android WebView | Android | ✅ | NSC |
| Coil, Glide, Ktor (OkHttp engine) | Android | ✅ | NSC |
| `HttpURLConnection` | Android | ✅ | NSC |
| Cronet | Android | ⚠️ best-effort | NSC (only if it uses the platform TrustManager) |

### Known limitations

- **iOS custom `URLSessionDelegate`:** apps with complex custom delegates or
  other swizzling libraries may conflict with TrustKit (its swizzling is designed
  for simple delegate setups).
- **Android Cronet:** no authoritative docs confirm Cronet always respects NSC
  `<pin-set>`; it may use its own TLS stack. For guaranteed enforcement use
  `CronetEngine.Builder.addPublicKeyPins()`.
- **Custom `TrustManager`:** any client that builds its own TrustManager bypasses
  NSC.
- **Non-`URLSession` iOS stacks** (e.g. OpenSSL bindings) and **Ktor CIO** are
  not covered — see [Ktor CIO](#ktor-cio-engine) below.

---

## Advanced

<details>
<summary><strong>How it works under the hood</strong></summary>

### iOS — TrustKit swizzling

TrustKit is initialized with `kTSKSwizzleNetworkDelegates: true`, which swizzles
`URLSession` delegates at the OS level. Most libraries built on `URLSession` are
covered automatically. Each domain is configured with `IncludeSubdomains`,
`EnforcePinning`, and its SHA-256 public-key hashes.

### Android — Network Security Config + OkHttp CertificatePinner

Two layers:

1. **OkHttp factory** — intercepts React Native's HTTP client creation and
   applies a `CertificatePinner` from `ssl_config.json`. Covers `fetch`/`axios`.
2. **Network Security Config** — a `network_security_config.xml` generated at
   build time and enforced by the OS for every stack that uses the default
   `TrustManager`.

```xml
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
    <domain includeSubdomains="false">10.0.3.2</domain>
  </domain-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">api.example.com</domain>
    <pin-set>
      <pin digest="SHA-256">AAAA…=</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

The first block keeps local dev hosts (`localhost`, emulator loopbacks
`10.0.2.2` / `10.0.3.2`) reachable over cleartext so the Metro bundler still
connects in debug builds. Pins carry no `pin-set` expiration (an expired one
would silently stop enforcing — expiration is handled by this library's own
`expirationDate` instead). If your app already has a
`network_security_config.xml`, the library **merges** its pin-set entries and
preserves your existing configuration.

### How the config reaches each platform

| Platform | Bare RN (CLI) | Expo |
|----------|---------------|------|
| iOS | Podspec script phase copies it into the app bundle | Plugin copies it to `ios/` and adds it to the Xcode project |
| Android (OkHttp) | Postinstall copies it to `assets/` | Plugin copies it to `app/src/main/assets/` |
| Android (NSC) | Gradle task generates the XML in `res/xml/` | Plugin generates the XML in `res/xml/` |
| Android (manifest) | Gradle task patches the manifest | Plugin patches the manifest |

Pin format: `sha256/` prefix + base64-encoded SHA-256 of the certificate's
Subject Public Key Info (SPKI). The `sha256/` prefix is stripped automatically
when generating the NSC XML.

</details>

<details>
<summary><strong>Pinning native image loaders on Android (Glide, Coil, Ktor)</strong></summary>

A pinned `OkHttpClient` is available for native code that lives outside React
Native's networking layer:

```kotlin
import com.usesslpinning.PinnedOkHttpClient

val client = PinnedOkHttpClient.getInstance(context)
```

It's a singleton (double-checked locking) that reads `ssl_config.json`, applies a
`CertificatePinner` when pinning is enabled (and returns a plain client when
disabled), and invalidates itself when `setUseSSLPinning` changes the state.

**Glide:**

```kotlin
@GlideModule
class MyAppGlideModule : AppGlideModule() {
    override fun registerComponents(context: Context, glide: Glide, registry: Registry) {
        val client = PinnedOkHttpClient.getInstance(context)
        registry.replace(GlideUrl::class.java, InputStream::class.java, OkHttpUrlLoader.Factory(client))
    }
}
```

**Coil:**

```kotlin
val imageLoader = ImageLoader.Builder(context)
    .okHttpClient { PinnedOkHttpClient.getInstance(context) }
    .build()
```

**Ktor (OkHttp engine):**

```kotlin
val httpClient = HttpClient(OkHttp) {
    engine { preconfigured = PinnedOkHttpClient.getInstance(context) }
}
```

#### Ktor CIO engine

CIO uses its own TLS stack — **not covered** by NSC or `PinnedOkHttpClient`. You
must supply a manual `TrustManager`:

```kotlin
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

val httpClient = HttpClient(CIO) {
    engine {
        https {
            trustManager = object : X509TrustManager {
                override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
                override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                    val hash = MessageDigest.getInstance("SHA-256").digest(chain[0].publicKey.encoded)
                    val pin = android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP)
                    val expectedPins = listOf("YOUR_PIN_HERE") // from ssl_config.json
                    if (pin !in expectedPins) throw javax.net.ssl.SSLPeerUnverifiedException("Certificate pin mismatch")
                }
                override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
            }
        }
    }
}
```

</details>

<details>
<summary><strong>Disabling pinning for e2e tests (Detox, mocked backends)</strong></summary>

On iOS, TrustKit installs at launch (before any JS) and swizzles `NSURLSession`
process-wide, and it can't be undone within a running process. So calling
`setUseSSLPinning(false)` from JS is **too late** for an e2e run — a mocked
backend whose certificate doesn't match your pins gets blocked (requests hang).

Use one of these **before-launch** off-switches. They also prevent the swizzling
so mocked traffic flows normally, and have **no effect on production** unless you
set them there.

**Detox, per launch (no separate build):**

```js
await device.launchApp({
  newInstance: true,
  launchArgs: { RNSSLManagerDisabled: true },
});
```

**Other channels (all equivalent):**
- `Info.plist` boolean `RNSSLManagerDisabled = YES` (a dedicated test build)
- Launch argument `--disable-ssl-pinning` (e.g. `xcodebuild` test args)
- Environment variable `RN_SSL_MANAGER_DISABLED=1` (Xcode scheme / CI)

The flag accepts a real boolean (`<true/>`) or a truthy string (`YES` / `true` /
`1`). Confirm via the launch log line `SSL pinning DISABLED for this launch via
<channel>`.

> Android doesn't have this problem: pinning applies per request, so
> `setUseSSLPinning(false)` takes effect immediately, and the generated Network
> Security Config already permits `localhost`, `10.0.2.2` and `10.0.3.2` for
> local mock servers.

</details>

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Every request to a pinned domain fails after a cert change | You rotated to a certificate whose pin isn't in `ssl_config.json`. Ship an update that adds the new pin (this is why you keep a backup pin), or use OTA rotation. |
| `isSSLManagerAvailable()` returns `false` / JS calls throw | The native module isn't linked — rebuild (`pod install` / Gradle sync, or `expo prebuild --clean`). |
| Pins not applied on Android | Confirm the build ran the setup: `./gradlew checkSslConfig`. |
| Metro won't connect in a debug build | You likely removed the localhost/emulator cleartext block from a custom `network_security_config.xml`. |

## Roadmap

- `react-native-ssl-manager-glide` — optional artifact with a pre-configured `AppGlideModule`
- React Native Web support
- WebView pinning on iOS (`react-native-webview` challenge handling)
- Certificate Transparency option (Android 16+ `<certificateTransparency>`)

## Demo

| iOS | Android |
|-----|---------|
| [![iOS Demo](https://vumbnail.com/1109299210.jpg)](https://vimeo.com/1109299210) | [![Android Demo](https://vumbnail.com/1109299632.jpg)](https://vimeo.com/1109299632) |

## Contributing

```bash
git clone https://github.com/huytdps13400/react-native-ssl-manager.git
cd react-native-ssl-manager
yarn install
npm run build

# Example apps
npm run example:ios
npm run example:android
npm run example-expo:ios
npm run example-expo:android
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
