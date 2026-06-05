---
id: prefetching
title: Prefetching with nitro-fetch
scope: react-native-nitro-fetch
keywords: prefetch, cold start, cache, performance, app launch, prefetchKey, POST, JSON, FormData, multipart, registerPrefetch, first launch, prefetchCacheTtlMs, cache ttl, freshness, token refresh, registerTokenRefresh, bodyMappings, formDataMappings
---

# Prefetching with nitro-fetch

## Mental model

Prefetching means: **fire the request before the JS code that consumes it actually runs.** nitro-fetch supports two flavours of this, and they answer different questions.

- *In-session prefetch* — "the user is on the list screen; they're probably about to tap a row." → `prefetch(...)`. Fires now, completes into the native cache, and any later `fetch(sameUrl)` with the same `prefetchKey` returns from cache.
- *Cross-launch prefetch* — "every cold start, before React Native is even loaded, fire this request." → `prefetchOnAppStart(...)`. Persists the request to disk; the native bootstrap replays it on every subsequent launch.

The key idea is the **`prefetchKey`**. It's how the native cache identifies a stored response and how the consuming `fetch()` looks it up. Forget the key and you've just made a wasted request.

## Why prefetch

- Cross-launch prefetches start *before React Native loads*, so the response is usually sitting in cache by the time the first screen mounts. Cold-start time-to-first-render drops by hundreds of milliseconds on real networks.
- In-session prefetches let a list screen warm the next detail screen — taps feel instant.
- It's free for callers: the consuming `fetch()` is the same call you were already making, just with a `prefetchKey` header.
- The native cache is shared across any code path that imports `fetch` from `react-native-nitro-fetch`, so wrappers around that import (e.g. the [axios adapter](./axios-adapter.md)) automatically benefit.

## Setup

### 1. iOS — nothing to do

The iOS bootstrap registers itself via `+load` in `packages/react-native-nitro-fetch/ios/NitroBootstrap.mm` and listens for `UIApplicationDidFinishLaunchingNotification`. You don't wire anything.

### 2. Android — one line in `Application.onCreate`

```kotlin
// android/app/src/main/java/<your-app>/MainApplication.kt
import com.margelo.nitro.nitrofetch.AutoPrefetcher

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    try { AutoPrefetcher.prefetchOnStart(this) } catch (_: Throwable) {}
    loadReactNative(this)
  }
}
```

The `try` is intentional — on a fresh install the prefs file doesn't exist yet, and you don't want a missing key to crash the app. See `example/android/app/src/main/java/nitrofetch/example/MainApplication.kt` for the working example.

If you skip this on Android, `prefetchOnAppStart` will appear to "work" (the entry is written to disk) but nothing will replay it on launch.

## Recipes

### Imports

```ts
import {
  prefetch,
  prefetchOnAppStart,
  removeFromAutoPrefetch,
  removeAllFromAutoprefetch,
} from 'react-native-nitro-fetch';
```

### Prewarm a detail screen from the list screen

```ts
function onListItemFocus(id: string) {
  prefetch(`https://api.example.com/items/${id}`, {
    headers: {
      prefetchKey: `item-${id}`,
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {
    // Non-fatal: if this fails the real fetch() will just go to the network.
  });
}
```

The detail screen consumes it with the same key:

```ts
const res = await fetch(`https://api.example.com/items/${id}`, {
  headers: { prefetchKey: `item-${id}` },
});
```

### Make a screen render from cache on cold start

Call this once after sign-in:

```ts
await prefetchOnAppStart('https://api.example.com/feed', {
  prefetchKey: 'home-feed',
  headers: { Authorization: `Bearer ${token}` },
});
```

On the *next* launch, the request fires while React Native is still booting. By the time `Home` mounts and calls `fetch('https://api.example.com/feed', { headers: { prefetchKey: 'home-feed' } })`, the response is already sitting in the cache.

### Prefetch a POST request (JSON or FormData)

`prefetchOnAppStart` persists `method`, `bodyString` / `bodyBytes` / `bodyFormData`, headers (including `Content-Type`), `timeoutMs`, and `followRedirects`. The native cold-start replay reconstructs the request exactly — a JSON POST is replayed as a JSON POST, a multipart upload is replayed as a multipart upload.

```ts
// JSON body — the Content-Type header is persisted and replayed verbatim
await prefetchOnAppStart('https://api.example.com/open-app', {
  method: 'POST',
  body: JSON.stringify({ appId: 'home', userId: 42 }),
  headers: { 'Content-Type': 'application/json' },
  prefetchKey: 'open-app',
});

// FormData — string fields and React Native file refs ({ uri, type, name })
const fd = new FormData();
fd.append('user', 'alice');
fd.append('avatar', { uri: avatarUri, type: 'image/jpeg', name: 'a.jpg' } as any);
await prefetchOnAppStart('https://api.example.com/upload', {
  method: 'POST',
  body: fd,
  prefetchKey: 'upload-avatar',
});
```

The consuming `fetch()` must use the same `method` + `body` shape (the server has to actually receive a matching request) and reference the entry by `prefetchKey`:

```ts
const res = await fetch('https://api.example.com/open-app', {
  method: 'POST',
  body: JSON.stringify({ appId: 'home', userId: 42 }),
  headers: {
    'Content-Type': 'application/json',
    prefetchKey: 'open-app',
  },
});
// res.headers.get('nitroPrefetched') === 'true' on the second cold launch onward
```

**FormData file URIs:** the URI is stored verbatim. A transient `content://` or `file://` captured at scheduling time may not be valid on the next cold launch — the multipart builder throws and the entry is skipped. Prefer bundled assets or persistent app-data paths.

**Storage format:** defaults are omitted so the JSON queue stays compact and backward-compatible. A body-less GET keeps the original `{ url, prefetchKey, headers }` shape; older binaries simply ignore the new fields when present.

### First-launch prefetches via native registration

`prefetchOnAppStart` runs from JS, so its earliest possible firing is the *second* cold launch after install (JS has to run once to seed the queue). To prefetch on the very first launch, register URLs from native code. Both APIs share the same persistent queue, so JS-side `removeFromAutoPrefetch()` works on natively-registered entries too.

**Android** — `AutoPrefetcher.registerPrefetch` is `@JvmOverloads`, so the existing 4-arg call keeps compiling and the new args slot in by name:

```kotlin
// android/app/src/main/java/.../MainApplication.kt
import com.margelo.nitro.nitrofetch.AutoPrefetcher

override fun onCreate() {
  super.onCreate()

  // GET (existing form)
  AutoPrefetcher.registerPrefetch(
    this,
    "https://api.example.com/feed",
    "feed",
    mapOf("Accept" to "application/json"),
  )

  // POST + FormData (extended form)
  AutoPrefetcher.registerPrefetch(
    context = this,
    url = "https://api.example.com/open-app",
    prefetchKey = "open-app",
    headers = mapOf("X-App" to "demo"),
    method = "POST",
    bodyFormData = listOf(
      mapOf("name" to "appId", "value" to "home"),
      mapOf("name" to "userId", "value" to "42"),
    ),
  )

  AutoPrefetcher.prefetchOnStart(this) // existing — drains the queue
  loadReactNative(this)
}
```

Other extended params: `bodyString: String? = null`, `bodyBytes: String? = null`, `timeoutMs: Double? = null`, `followRedirects: Boolean? = null`.

**iOS** — Swift `@objc` can't expose default args, so the extended API is a separate selector (`registerPrefetchWithURL:prefetchKey:headers:method:bodyString:bodyBytes:bodyFormData:timeoutMs:followRedirects:`):

```swift
// AppDelegate.swift — in application(_:didFinishLaunchingWithOptions:)

// GET (existing 3-arg form)
NitroAutoPrefetcher.registerPrefetch(
  withUrl: "https://api.example.com/feed",
  prefetchKey: "feed",
  headers: ["Accept": "application/json"]
)

// POST + JSON (extended form)
NitroAutoPrefetcher.registerPrefetch(
  withURL: "https://api.example.com/open-app",
  prefetchKey: "open-app",
  headers: ["Content-Type": "application/json"],
  method: "POST",
  bodyString: #"{"appId":"home","userId":42}"#,
  bodyBytes: nil,
  bodyFormData: nil,
  timeoutMs: nil,
  followRedirects: nil
)
```

No explicit `prefetchOnStart()` call is needed on iOS — the `+load` bootstrap in `NitroBootstrap.mm` fires after launch automatically.

ObjC callers can `#import <NitroFetch/NitroAutoPrefetcher.h>` from a bridging header; both selectors are declared there.

### Pass the key two ways

The skill code accepts the key in either place — pick whichever is convenient at the call site:

```ts
// As a header (it also goes on the wire)
prefetch(url, { headers: { prefetchKey: 'home-feed' } });

// As a non-standard init field (added to headers under the hood)
prefetchOnAppStart(url, { prefetchKey: 'home-feed' });
```

The header name is case-insensitive — `prefetchKey`, `prefetchkey`, and `PrefetchKey` are all the same thing.

### Tear down on logout

The persisted queue survives app restarts, which is exactly the problem on logout. Always purge it:

```ts
async function onLogout() {
  await removeAllFromAutoprefetch();
  // ...rest of your logout flow
}

// Or, if you only want to drop one entry:
await removeFromAutoPrefetch('home-feed');
```

If you don't, the next cold start will fire the prefetch with stale credentials.

### Configuring cache TTL

A cached prefetch is fresh for **5 seconds** by default. The lookup is at *read time* — `fetch()` evicts and skips any entry older than the TTL. Five seconds is fine for "user is about to tap this row," but too short for a cross-launch prefetch that has to survive the JS bundle boot or a list screen reached via a slow route.

Pass `prefetchCacheTtlMs` on **both** the prefetch and the consuming `fetch()` (each call brings its own TTL — there is no global default to set):

```ts
// In-session: warm a screen up to 60s before it's mounted.
await prefetch('https://api.example.com/items/42', {
  headers: { prefetchKey: 'item-42' },
  prefetchCacheTtlMs: 60_000,
});

// Consume — same TTL so the cache hit doesn't get skipped.
const res = await fetch('https://api.example.com/items/42', {
  headers: { prefetchKey: 'item-42' },
  prefetchCacheTtlMs: 60_000,
});
```

For cross-launch prefetches, the TTL is persisted alongside the request in the MMKV queue, so the next cold start honors it:

```ts
await prefetchOnAppStart('https://api.example.com/feed', {
  prefetchKey: 'home-feed',
  prefetchCacheTtlMs: 5 * 60_000, // 5 minutes
});
```

For native-side registration, both platforms accept the TTL as a named arg:

```kotlin
// Android — registerPrefetch is @JvmOverloads
AutoPrefetcher.registerPrefetch(
  context = this,
  url = "https://api.example.com/feed",
  prefetchKey = "feed",
  headers = mapOf("Accept" to "application/json"),
  prefetchCacheTtlMs = 300_000.0, // Double, in ms
)
```

```swift
// iOS — use the extended @objc selector with the trailing prefetchCacheTtlMs:
NitroAutoPrefetcher.registerPrefetch(
  withURL: "https://api.example.com/feed",
  prefetchKey: "feed",
  headers: ["Accept": "application/json"],
  method: nil, bodyString: nil, bodyBytes: nil, bodyFormData: nil,
  timeoutMs: nil, followRedirects: nil,
  prefetchCacheTtlMs: NSNumber(value: 300_000)
)
```

Notes:
- Omitting the option keeps the historical 5-second behavior. There's no backward-incompat.
- A long TTL amplifies the "Stale prefetches after deploys" risk below — bump `prefetchKey` on schema changes regardless of TTL.
- A value `<= 0` disables cache hits for that key — `getResultIfFresh`/`hasFreshResult` check `age <= maxAgeMs`, so any positive age fails.

### Fetching tokens for cross-start prefetches

A `prefetchOnAppStart` entry is replayed by **native code, before JS runs**. That's the whole point — but it means there's no JS runtime around to mint a fresh access token. The package solves this with `registerTokenRefresh`: you describe a refresh endpoint and how to map its response into headers, and the native bootstrap calls it on cold start before replaying the queue.

```ts
import {
  registerTokenRefresh,
  prefetchOnAppStart,
} from 'react-native-nitro-fetch';

// 1. Tell nitro how to mint a fresh token at cold start.
registerTokenRefresh({
  target: 'fetch',                            // or 'all' to also cover WebSockets
  url:    'https://api.example.com/oauth/token',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body:   JSON.stringify({ grant_type: 'refresh_token', refresh_token: longLived }),
  responseType: 'json',
  mappings: [
    { jsonPath: 'access_token', header: 'Authorization', valueTemplate: 'Bearer {{value}}' },
  ],
  onFailure: 'useStoredHeaders', // fall back to last-known good headers if refresh fails
});

// 2. Schedule the prefetches that need that header.
await prefetchOnAppStart('https://api.example.com/feed', {
  prefetchKey: 'home-feed',
  // No Authorization here — it'll be injected by the token refresh response.
});
```

On every subsequent cold start, the native bootstrap will:

1. Read the refresh config from encrypted prefs (`NitroFetchSecureAtRest`).
2. Call the refresh URL on a background thread.
3. Map the JSON response into headers (`Authorization: Bearer ey...`) and, if configured, into the request body / form-data.
4. Merge those values into every queued prefetch and fire them.

#### Inject the token into the JSON body or form-data

Headers are the default destination, but the same refresh response can also be written into a prefetch's **JSON body** or a **multipart form-data field**. Add `bodyMappings` / `formDataMappings` alongside `mappings` — each is independent, so one refreshed value can land in a header, the body, and a form field at once. This is the **`fetch`** prefetch path only.

```ts
registerTokenRefresh({
  target: 'fetch',
  url:    'https://api.example.com/oauth/token',
  method: 'POST',
  body:   JSON.stringify({ grant_type: 'refresh_token', refresh_token: longLived }),
  responseType: 'json',
  mappings: [
    { jsonPath: 'access_token', header: 'Authorization', valueTemplate: 'Bearer {{value}}' },
  ],
  // JSON body: sets a (possibly nested) dot-path key in the prefetch's bodyString
  bodyMappings: [
    { jsonPath: 'access_token', bodyPath: 'auth.token' },
  ],
  // form-data: replaces (or appends) a part by name
  formDataMappings: [
    { jsonPath: 'access_token', field: 'token' },
  ],
});
```

A JSON-body prefetch of `{ "deviceId": "d-1" }` is then replayed as `{ "deviceId": "d-1", "auth": { "token": "ey..." } }`, and a form-data prefetch gains/overwrites a `token` part. Caveats:

- `bodyMappings` only rewrites a prefetch that **already has a JSON-object body** — it won't synthesize a body on a GET or form-data request, and a non-JSON body is left untouched.
- `formDataMappings` only applies to prefetches that already send form-data — it won't turn a JSON/GET request into a multipart one.
- Mappings are matched per-prefetch by body shape, so a single shared config fans out across a JSON prefetch and a form-data prefetch without cross-contaminating them.
- For `responseType: 'text'`, the body/form equivalents of `textHeader` are `bodyTextPath` / `formDataTextField`.

### Putting the token in the URL

The native auto-prefetcher merges refreshed values into **headers** (and, via `bodyMappings` / `formDataMappings`, into the JSON body or form-data — see above), but never into the URL. The stored URL is replayed verbatim. If your backend requires the token in the URL (e.g. a signed query string), you have two options:

**Option A — store the URL with the token already in it.** The token will be the one captured at scheduling time. Re-call `prefetchOnAppStart` whenever it rotates:

```ts
function refreshHomeFeedPrefetch(token: string) {
  return prefetchOnAppStart(
    `https://api.example.com/feed?token=${encodeURIComponent(token)}`,
    { prefetchKey: 'home-feed' },
  );
}
```

This is fine for tokens with multi-day TTLs. It's the wrong fit for short-lived ones because the *next* cold start will replay the *previous* token.

**Option B — use a `compositeHeaders` mapping and have the backend accept the header form.** If you can change the server to read the token from a header instead of the query string, you keep the cold-start refresh path working without any JS code on launch.

```ts
registerTokenRefresh({
  target: 'fetch',
  url:    'https://api.example.com/oauth/token',
  method: 'POST',
  body:   JSON.stringify({ grant_type: 'refresh_token', refresh_token: longLived }),
  mappings: [
    { jsonPath: 'access_token', header: 'X-Token', valueTemplate: '{{value}}' },
  ],
});
```

If neither option works for you (the URL itself must contain a fresh value, e.g. an HMAC of a fresh nonce), then the request fundamentally cannot be prefetched on cold start — there's no JS runtime to compute the new URL. Use an in-session prefetch from your splash screen instead.

### Without token refresh

If you don't register a refresh config, the bootstrap reuses whatever headers were stored at `prefetchOnAppStart` time. That works fine for tokens that outlive the app's typical kill/restart cycle. See [`docs-website/docs/token-refresh.md`](https://github.com/margelo/react-native-nitro-fetch/tree/main/docs-website/docs/token-refresh.md) for the full reference (composite headers, plain-text response bodies, `onFailure` modes).

## Gotchas

- **No `prefetchKey` → throws.** The error is literal: `prefetch requires a "prefetchKey" header`. Both `prefetch` and `prefetchOnAppStart` enforce this.
- **Mismatched keys → cold cache.** A prefetch with `prefetchKey: 'home'` and a fetch with `prefetchKey: 'home-feed'` are unrelated. The URL alone is *not* the cache key.
- **Android wiring missing.** `prefetchOnAppStart` writes silently; only the missing `Application.onCreate` line gives it away. Double-check it.
- **Prefetch loops.** The native side doesn't throttle. Don't call `prefetchOnAppStart` for fifty endpoints — you're just slowing down boot.
- **POST/PUT prefetches.** Fully supported — `method` and body (`string`, `bodyBytes`, FormData) are persisted alongside the URL and replayed exactly. The cache lookup is still by `prefetchKey`, not by request body, so only schedule POST prefetches for endpoints where replaying the same payload returns the same response (idempotent or read-modeled-as-write).
- **Stale prefetches after deploys.** If your backend changes shape, old cached responses can hit the new client. Bump the `prefetchKey` (e.g. include a schema version). The default 5-second TTL limits the blast radius; raising it via `prefetchCacheTtlMs` (see "Configuring cache TTL" above) widens the window and makes a `prefetchKey` bump more important.

## Pointers

- Source: [`packages/react-native-nitro-fetch/src/fetch.ts`](https://github.com/margelo/react-native-nitro-fetch/tree/main/packages/react-native-nitro-fetch/src/fetch.ts), search for `prefetch`
- Android bootstrap: [`packages/react-native-nitro-fetch/android/src/main/java/com/margelo/nitro/nitrofetch/AutoPrefetcher.kt`](https://github.com/margelo/react-native-nitro-fetch/tree/main/packages/react-native-nitro-fetch/android/src/main/java/com/margelo/nitro/nitrofetch/AutoPrefetcher.kt)
- iOS bootstrap: [`packages/react-native-nitro-fetch/ios/NitroBootstrap.mm`](https://github.com/margelo/react-native-nitro-fetch/tree/main/packages/react-native-nitro-fetch/ios/NitroBootstrap.mm)
- End-to-end example: [`example/src/screens/PrefetchScreen.tsx`](https://github.com/margelo/react-native-nitro-fetch/tree/main/example/src/screens/PrefetchScreen.tsx)
- Long-form docs: [`docs-website/docs/prefetch.md`](https://github.com/margelo/react-native-nitro-fetch/tree/main/docs-website/docs/prefetch.md)
- Related: [`axios-adapter.md`](./axios-adapter.md), [`network-inspector.md`](./network-inspector.md)
