---
id: upgrade-v4
title: V3 to V4 upgrade guide
scope: react-native-mmkv
keywords: V4, V3, upgrade, migration, breaking changes, createMMKV, new MMKV, delete, remove, nitro-modules, AppGroupIdentifier
---

# V3 to V4 upgrade guide

## Mental model

react-native-mmkv V4 is a complete rewrite using Nitro Modules (instead of raw JSI). The API surface is similar but has breaking changes. The rewrite brings: backwards compatibility with the old architecture, easier community maintenance, and optimized native performance.

## Requirements

- **React Native 0.75.0 or higher**
- `react-native-nitro-modules` as a peer dependency
- Works on **both** the New Architecture and the old architecture (Nitro is backwards compatible)

## Breaking changes

### 1. Install `react-native-nitro-modules`

```bash
npm install react-native-nitro-modules
```

This is now a required peer dependency.

### 2. `new MMKV()` → `createMMKV()`

MMKV is now a purely native HybridObject and cannot be instantiated with `new`.

```ts
// BEFORE (V3)
import { MMKV } from 'react-native-mmkv'
const storage = new MMKV()
const storage = new MMKV({ id: 'my-store', encryptionKey: 'secret' })

// AFTER (V4)
import { createMMKV } from 'react-native-mmkv'
const storage = createMMKV()
const storage = createMMKV({ id: 'my-store', encryptionKey: 'secret' })
```

### 3. `.delete()` → `.remove()`

The method was renamed because `delete` is a reserved keyword in C++ (which Nitro uses for the native binding).

```ts
// BEFORE (V3)
storage.delete('user.name')

// AFTER (V4)
storage.remove('user.name')
```

### 4. `Mode` enum → string literals

The `Mode` enum import no longer exists. Use string literals instead:

```ts
// BEFORE (V3)
import { MMKV, Mode } from 'react-native-mmkv'
const storage = new MMKV({ id: 'shared', mode: Mode.MULTI_PROCESS })

// AFTER (V4)
import { createMMKV } from 'react-native-mmkv'
const storage = createMMKV({ id: 'shared', mode: 'multi-process' })
```

### 5. `AppGroup` → `AppGroupIdentifier`

In your `Info.plist`, the key for iOS App Group sharing was renamed:

```xml
<!-- BEFORE (V3) -->
<key>AppGroup</key>
<string>group.com.myapp</string>

<!-- AFTER (V4) -->
<key>AppGroupIdentifier</key>
<string>group.com.myapp</string>
```

## iOS troubleshooting

If you encounter the Swift pod static library integration error with MMKVCore, ensure you're using MMKVCore v2.2.4 or higher (which includes the necessary module map support). As a workaround, add this to your Podfile:

```ruby
pod 'MMKVCore', :modular_headers => true
```

The latest V4 should include a compatible MMKVCore by default.

## Migration checklist

- [ ] Install `react-native-nitro-modules`
- [ ] Replace all `new MMKV(...)` with `createMMKV(...)`
- [ ] Replace all `.delete(key)` with `.remove(key)`
- [ ] Update `Info.plist` key from `AppGroup` to `AppGroupIdentifier` (if using App Groups)
- [ ] Rebuild native apps (`pod install` + clean build)
- [ ] Run tests — mocked MMKV works automatically with Jest/Vitest

## Gotchas

- **Data is preserved.** V4 reads the same MMKV files as V3. No data migration needed — only API changes.
- **Hooks API is unchanged.** `useMMKVString`, `useMMKVNumber`, etc. work the same way.
- **The `MMKV` type still exists** as the TypeScript interface for the instance. You just can't `new` it anymore.
- **Two V3 APIs are now deprecated** (still work, but should be replaced): `storage.size` → `storage.byteSize`, and `storage.recrypt(key)` → `storage.encrypt(key)` / `storage.decrypt()`.

## Pointers

- Official upgrade guide: [V4_UPGRADE_GUIDE.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/V4_UPGRADE_GUIDE.md)
- V3 README (archived): [README_V3.md](https://github.com/mrousavy/react-native-mmkv/blob/main/README_V3.md)
- Related: [create-instance.md](./create-instance.md)
