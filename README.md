# react-native-ssl-manager

[![npm version](https://img.shields.io/npm/v/react-native-ssl-manager.svg)](https://www.npmjs.com/package/react-native-ssl-manager)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ssl-manager.svg)](https://www.npmjs.com/package/react-native-ssl-manager)
[![license](https://img.shields.io/npm/l/react-native-ssl-manager.svg)](./LICENSE)

### SSL certificate pinning for React Native & Expo.

Pin your API certificates so the app refuses connections that don’t match — including traffic through Charles, Proxyman, or other MITM proxies.

```ts
// After install + ssl_config.json + native rebuild:
// fetch / axios to pinned hosts are protected automatically.
import { isSSLManagerAvailable } from 'react-native-ssl-manager'

console.log(isSSLManagerAvailable()) // true after a native rebuild
```

## Features

* 🔒 **Certificate / public-key pinning** for your API hosts  
* ⚡ **Zero JS required for normal traffic** — pins apply at **app launch**  
* 📱 **iOS** (TrustKit) + **Android** (Network Security Config + OkHttp)  
* 🧩 **Expo config plugin** — prebuild copies config into native projects  
* 🛠️ **CLI** — extract pins, verify drift in CI, monorepo helpers  
* 🛰️ **Optional OTA pin updates** (signed Ed25519 bundles)  
* 🧪 **Audit mode** — report mismatches without blocking (safe rollout)  
* ⚙️ Built as a **[Nitro Module](https://nitro.margelo.com)** (New Architecture)

> [!IMPORTANT]
> **v2 requires the New Architecture** and peer dependency  
> [`react-native-nitro-modules`](https://www.npmjs.com/package/react-native-nitro-modules) (≥ 0.35).  
> Changing `ssl_config.json` always needs a **native rebuild** — Metro reload is not enough.  
> Coming from v1? JS API is unchanged → [`MIGRATION.md`](./MIGRATION.md).

## Requirements

| | Minimum |
|---|---|
| React Native | **0.75+** (New Architecture) |
| `react-native-nitro-modules` | **≥ 0.35** |
| Expo | **SDK 52+** (New Architecture) |
| iOS | 13+ |
| Android | API 21+ |
| Node | 18+ |

---

## Installation

### React Native (CLI)

```sh
npm install react-native-ssl-manager react-native-nitro-modules
cd ios && pod install
```

### Expo

```sh
npx expo install react-native-ssl-manager react-native-nitro-modules
```

Add the config plugin to `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      ["react-native-ssl-manager", { "sslConfigPath": "./ssl_config.json" }]
    ]
  }
}
```

Then generate native projects and run a **development build** (not Expo Go):

```sh
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

> **pnpm / monorepos:** install in the **app package** (the one that builds the binary), not only the workspace root. See [Monorepo & pnpm](#monorepo--pnpm).

---

## Setup

### 1. Create `ssl_config.json`

In your app root (next to `package.json` / `app.json`):

```sh
npx react-native-ssl-manager pins api.example.com
```

Paste the output into **`ssl_config.json`**:

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

**Rules**

* Host only: `api.example.com` — not `https://…`  
* **At least two pins per domain** (current + backup) so a cert rotation doesn’t lock users out  
* Use real pins from the CLI for production — placeholders won’t protect anything  

### 2. Rebuild

```sh
# Expo
npx expo prebuild
npx expo run:ios   # or run:android

# Bare RN
cd ios && pod install && cd ..
npx react-native run-ios
```

After that, pinning is **on at launch** for `fetch` / `axios` and other covered stacks. You don’t wrap each request.

### 3. Verify

```sh
# Pins still match the live server? (great for CI)
npx react-native-ssl-manager verify
```

```ts
import { isSSLManagerAvailable, getPinnedDomains } from 'react-native-ssl-manager'

isSSLManagerAvailable()     // must be true after native rebuild
await getPinnedDomains()    // e.g. ['api.example.com']
```

**Sanity check with Proxyman / Charles**

| Pinning | MITM proxy | Your API |
|---------|------------|----------|
| ON (default) | On | Should **fail** TLS |
| OFF | On | May **succeed** (proxy can inspect) |
| ON | Off | Should **succeed** if pins match |

On **iOS**, after `setUseSSLPinning(…)`, **force-quit and reopen** the app so TrustKit fully applies.

---

## Usage (optional JS API)

Most apps never call the JS API for day-to-day traffic. Use it for debug toggles, listeners, or runtime config.

```ts
import {
  isSSLManagerAvailable,
  setUseSSLPinning,
  getUseSSLPinning,
  setSSLConfig,
  getPinnedDomains,
  addPinningFailureListener,
} from 'react-native-ssl-manager'

if (!isSSLManagerAvailable()) {
  // Native module not linked → rebuild the app
}

await setUseSSLPinning(true)          // default is already true
const on = await getUseSSLPinning()
const domains = await getPinnedDomains()

const stop = addPinningFailureListener((event) => {
  // { host, enforced, servedPins, message, timestamp }
  console.warn('pin failure', event)
})
// later: stop()
```

### Audit mode (safe rollout)

Report mismatches without blocking:

```json
{
  "sha256Keys": {
    "api.example.com": ["sha256/CURRENT...=", "sha256/BACKUP...="]
  },
  "domains": {
    "api.example.com": { "enforcePinning": false }
  }
}
```

Switch `"enforcePinning": true` when ready.

### Config reference

```json
{
  "sha256Keys": {
    "api.example.com": ["sha256/AAAA...=", "sha256/BBBB...="]
  },
  "domains": {
    "api.example.com": {
      "enforcePinning": true,
      "expirationDate": "2027-12-31",
      "includeSubdomains": true
    }
  },
  "reportUris": ["https://example.com/pin-failures"]
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enforcePinning` | `true` | `false` = audit only |
| `expirationDate` | — | `YYYY-MM-DD`; after this date, pin fails open |
| `includeSubdomains` | `true` | Apply pins to subdomains |
| `reportUris` | — | Optional HTTPS failure report endpoints |

### Plugin options (Expo)

| Option | Default | Description |
|--------|---------|-------------|
| `sslConfigPath` | `ssl_config.json` | Path relative to app root |
| `enableAndroid` | `true` | NSC + assets |
| `enableIOS` | `true` | Bundle config into the iOS app |

---

## CLI

```sh
npx react-native-ssl-manager <command>
# alias: ssl-manager
```

| Command | Purpose |
|---------|---------|
| `pins <host>` | Print live SPKI pins + config snippet |
| `pins --pem cert.pem` | Pin from a local PEM |
| `verify [--config …]` | Fail CI when live chain matches none of the pins |
| `monorepo-setup` | Validate monorepo / pnpm layout + Gradle snippet |
| `keygen` / `sign` | Author signed OTA pin bundles |

---

## What’s covered?

| Stack | Platform | Covered |
|-------|----------|---------|
| `fetch` / `axios` | iOS | ✅ TrustKit |
| `URLSession` libs | iOS | ✅ |
| `fetch` / `axios` | Android | ✅ OkHttp + NSC |
| Coil / Glide / Ktor (OkHttp) | Android | ✅ |
| Android WebView | Android | ✅ NSC |
| Cronet | Android | ⚠️ Best-effort |
| Custom `TrustManager` / Ktor CIO | Android | ❌ |

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Only Metro reload after editing pins | **Rebuild** native app |
| Missing `react-native-nitro-modules` | Install peer + rebuild |
| New Architecture disabled | Enable New Arch (v2 requirement) |
| Single pin per host | Always ship **≥ 2** pins |
| `https://` in domain key | Use host only: `api.example.com` |
| Expo without config plugin | Add plugin → `prebuild` → run |
| pnpm: installed only at monorepo root | Install in the **app** package |
| iOS toggle seems ignored | Force-quit and reopen |

---

## Monorepo & pnpm

Install into the package that **builds the native app**:

```sh
pnpm add react-native-ssl-manager react-native-nitro-modules --filter your-app
cd apps/your-app
# ssl_config.json + Expo plugin live here
npx expo prebuild --clean
```

```sh
# Recommended in monorepos / pnpm isolated installs
export SSL_MANAGER_SKIP_POSTINSTALL=1
```

```sh
npx react-native-ssl-manager monorepo-setup
```

Bare Android (no Expo): use the Gradle snippet from `monorepo-setup` (Node `require.resolve` works with pnpm).

Fixture: [`fixtures/pnpm-monorepo`](./fixtures/pnpm-monorepo).

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `isSSLManagerAvailable()` is `false` | Link Nitro, enable New Arch, **rebuild** |
| All pinned calls fail after cert rotate | `pins` + update config + **rebuild** (or OTA) |
| iOS pin toggle does nothing | Kill app and relaunch |
| Expo Xcode error adding `ssl_config.json` | Upgrade library; `npx expo prebuild --clean` |
| Metro fails on Android debug | Keep localhost / `10.0.2.2` cleartext in NSC |
| pnpm Android path issues | Expo plugin or `monorepo-setup`; skip postinstall |

---

## API

| API | Description |
|-----|-------------|
| `isSSLManagerAvailable(): boolean` | Native module linked? |
| `setUseSSLPinning(boolean): Promise<void>` | On/off (iOS: next launch) |
| `getUseSSLPinning(): Promise<boolean>` | Current flag (default `true`) |
| `setSSLConfig(config \| string): Promise<void>` | Runtime config (iOS: next launch) |
| `getPinnedDomains(): Promise<string[]>` | Active domains |
| `addPinningFailureListener(fn): () => void` | Subscribe; returns unsubscribe |
| `updatePinsFromUrl(url, { publicKey }): Promise<OtaResult>` | Apply signed OTA bundle |

<details>
<summary><strong>TypeScript types</strong></summary>

```ts
interface SslPinningConfig {
  sha256Keys: { [domain: string]: string[] }
  domains?: {
    [domain: string]: {
      enforcePinning?: boolean
      expirationDate?: string // YYYY-MM-DD
      includeSubdomains?: boolean
    }
  }
  reportUris?: string[]
}

interface PinningFailureEvent {
  host: string
  enforced: boolean
  servedPins: string[]
  message: string
  timestamp: number
}
```

</details>

---

## Advanced

<details>
<summary><strong>OTA pin rotation</strong></summary>

```sh
npx react-native-ssl-manager keygen
npx react-native-ssl-manager sign \
  --config ssl_config.json \
  --key ssl-manager-ota.key.pem \
  --expires-in 30d \
  --out ssl-pins-bundle.json
```

```ts
import { updatePinsFromUrl } from 'react-native-ssl-manager'

await updatePinsFromUrl('https://cdn.example.com/ssl-pins-bundle.json', {
  publicKey: '…', // from keygen — safe to ship in the app
  maxAgeMs: 7 * 24 * 3600 * 1000,
})
```

Tampered / expired / rolled-back bundles are rejected; the active config is unchanged.

</details>

<details>
<summary><strong>How it works</strong></summary>

* **iOS:** TrustKit initializes at launch (`+load`) and swizzles `URLSession`.
* **Android:** Network Security Config (build-time XML) + OkHttp `CertificatePinner` via early startup.
* Config is **bundled at build time** (Expo plugin / Gradle / pod scripts) → always rebuild after pin changes.

</details>

<details>
<summary><strong>Android: Glide / Coil / Ktor</strong></summary>

```kotlin
import com.usesslpinning.PinnedOkHttpClient

val client = PinnedOkHttpClient.getInstance(context)
```

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

Ktor **CIO** is not covered (own TLS stack).

</details>

<details>
<summary><strong>E2E / Detox (disable TrustKit before launch on iOS)</strong></summary>

JS `setUseSSLPinning(false)` is too late if TrustKit already started.

```js
await device.launchApp({
  newInstance: true,
  launchArgs: { RNSSLManagerDisabled: true },
})
```

Also: `Info.plist` `RNSSLManagerDisabled`, env `RN_SSL_MANAGER_DISABLED=1`.

</details>

<details>
<summary><strong>Manual pin with openssl</strong></summary>

```sh
openssl s_client -connect api.example.com:443 -servername api.example.com < /dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
```

Prefix with `sha256/`.

</details>

<details>
<summary><strong>Known limitations</strong></summary>

* **Cronet** may use its own TLS stack; prefer `CronetEngine.Builder.addPublicKeyPins()` for hard guarantees.
* **Custom TrustManager** bypasses Android Network Security Config.
* Complex **custom URLSessionDelegate** / other swizzlers on iOS may conflict with TrustKit.

</details>

---

## Demo

| iOS | Android |
|-----|---------|
| [![iOS Demo](https://vumbnail.com/1109299210.jpg)](https://vimeo.com/1109299210) | [![Android Demo](https://vumbnail.com/1109299632.jpg)](https://vimeo.com/1109299632) |

## Contributing

```sh
git clone https://github.com/huytdps13400/react-native-ssl-manager.git
cd react-native-ssl-manager
yarn install
yarn test
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
