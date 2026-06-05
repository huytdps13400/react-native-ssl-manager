---
name: react-native-mmkv
description: Fast synchronous key-value storage for React Native via react-native-mmkv (Nitro-backed). Covers creating and configuring MMKV instances, reading/writing all value types (string, number, boolean, buffer), React hooks for reactive UI, value-change listeners, encryption, AsyncStorage migration, and state-management integrations (zustand, redux-persist, jotai, react-query). Also covers storage limits, multi-process mode, and the V4 upgrade from the class-based API.
license: MIT
metadata:
  author: margelo
  scope: react-native-mmkv
  tags: react-native, mmkv, storage, key-value, encryption, hooks, zustand, redux, jotai, react-query, async-storage, migration, nitro-modules
---

# react-native-mmkv

A focused reference for AI coding assistants working in a project that uses `react-native-mmkv`. Answer using the real APIs from this library — not invented ones — by routing to the matching `references/*.md` file below.

## Mental model

`react-native-mmkv` is a high-performance, synchronous key-value storage library for React Native, backed by Tencent's [MMKV](https://github.com/Tencent/MMKV) C++ engine via Nitro Modules (JSI). It is ~30x faster than AsyncStorage.

The three things that trip people up:

1. **Everything is synchronous.** No `await`, no Promises. `storage.getString('key')` returns the value immediately. This is the whole point — MMKV memory-maps files and reads/writes in-process.
2. **It's a key-value store, not a database.** All data is cached in memory. Keep total size under ~100 MB; for larger datasets use [react-native-nitro-sqlite](https://github.com/margelo/react-native-nitro-sqlite) or WatermelonDB. There is no fixed storage limit — but memory warnings will fire if you go too large.
3. **V4 is a breaking rewrite.** The constructor changed from `new MMKV()` to `createMMKV()`, `.delete()` became `.remove()`, and `react-native-nitro-modules` is now a required peer dependency. See the [upgrade guide](./references/upgrade-v4.md).

> **V4 requires React Native 0.75+.** It works on both the New Architecture and the old architecture (Nitro is backwards compatible).

## Routing table — problem to reference

Load the matching file from `references/` before writing code. Each reference cites real APIs from the library.

| User is asking about… | Read |
|---|---|
| Creating an MMKV instance, configuration options (`id`, `path`, `encryptionKey`, `mode`, `readOnly`, `compareBeforeSet`), the `createMMKV()` factory | [`references/create-instance.md`](./references/create-instance.md) |
| Getting/setting values, all data types (string, number, boolean, buffer, objects via JSON), key management (`contains`, `getAllKeys`, `remove`, `clearAll`), `size`, `trim`, `importAllFrom` | [`references/crud-operations.md`](./references/crud-operations.md) |
| React hooks (`useMMKVString`, `useMMKVNumber`, `useMMKVBoolean`, `useMMKVBuffer`, `useMMKVObject`, `useMMKV`, `useMMKVListener`, `useMMKVKeys`), reactive UI | [`references/hooks.md`](./references/hooks.md) |
| Listening for value changes outside of React, `addOnValueChangedListener`, cleaning up listeners | [`references/listeners.md`](./references/listeners.md) |
| Encryption (`encrypt`, `decrypt`, `recrypt`), AES-128 vs AES-256, `encryptionKey` config | [`references/encryption.md`](./references/encryption.md) |
| Migrating from AsyncStorage, data transfer pattern, completion flag | [`references/migrate-from-async-storage.md`](./references/migrate-from-async-storage.md) |
| zustand persist middleware, redux-persist, jotai `atomWithMMKV`, react-query persister, MobX | [`references/state-management.md`](./references/state-management.md) |
| V4 upgrade, breaking changes from V3, `new MMKV()` → `createMMKV()`, `.delete()` → `.remove()` | [`references/upgrade-v4.md`](./references/upgrade-v4.md) |
| Storage size limits, memory warnings, when to use a database instead | [`references/limits-and-gotchas.md`](./references/limits-and-gotchas.md) |

If the question doesn't match any row, read [`references/create-instance.md`](./references/create-instance.md) first — most setup questions start there.

## Installation

```bash
npm install react-native-mmkv react-native-nitro-modules
cd ios && pod install
```

Expo:
```bash
npx expo install react-native-mmkv react-native-nitro-modules
npx expo prebuild
```

After install, rebuild the app. No additional native wiring is required.

## Quick reference — full MMKV instance API

```ts
import { createMMKV, existsMMKV, deleteMMKV } from 'react-native-mmkv'

const storage = createMMKV({ id: 'my-store' })

// Properties (read-only)
storage.id          // string
storage.length      // number of keys
storage.byteSize    // total file size in bytes
storage.size        // (deprecated — use byteSize)
storage.isReadOnly  // boolean
storage.isEncrypted // boolean

// Write
storage.set('key', 'string' | 42 | true | arrayBuffer)

// Read
storage.getString('key')   // string | undefined
storage.getNumber('key')   // number | undefined
storage.getBoolean('key')  // boolean | undefined
storage.getBuffer('key')   // ArrayBuffer | undefined

// Keys
storage.contains('key')    // boolean
storage.getAllKeys()        // string[]
storage.remove('key')      // boolean  (NOTE: was .delete() in V3)
storage.clearAll()         // void

// Encryption
storage.encrypt('password')
storage.encrypt('password', 'AES-256')
storage.decrypt()
storage.recrypt('newPassword' | undefined)  // (deprecated — use encrypt()/decrypt())

// Maintenance
storage.trim()                       // free unused space
storage.importAllFrom(otherStorage)  // returns count imported

// Listeners
const sub = storage.addOnValueChangedListener((key) => { ... })
sub.remove()

// Static helpers
existsMMKV('my-store')   // boolean
deleteMMKV('my-store')   // boolean
```

## Testing

A mocked MMKV instance is automatically used when testing with Jest or Vitest. Use `createMMKV()` as normal in tests — no manual mocking needed.

## Verifying the skill is loaded

Good test questions:

- *"How do I persist zustand state with MMKV?"* → should produce a `StateStorage` adapter using `storage.set`, `storage.getString`, `storage.remove` — not AsyncStorage wrappers.
- *"How do I migrate from AsyncStorage to MMKV?"* → should show the batch-copy pattern with a completion flag, not a drop-in replacement.
- *"What's the storage limit?"* → should explain there's no fixed limit, but data is memory-mapped so keep it under ~100 MB; use SQLite for larger datasets.

## References

| File | Description |
|------|-------------|
| [create-instance.md](./references/create-instance.md) | `createMMKV()` factory, all configuration options |
| [crud-operations.md](./references/crud-operations.md) | Set/get all types, key management, objects, buffers |
| [hooks.md](./references/hooks.md) | All React hooks for reactive MMKV usage |
| [listeners.md](./references/listeners.md) | `addOnValueChangedListener`, cleanup |
| [encryption.md](./references/encryption.md) | Encrypt/decrypt instances, AES options |
| [migrate-from-async-storage.md](./references/migrate-from-async-storage.md) | Full migration pattern from AsyncStorage |
| [state-management.md](./references/state-management.md) | zustand, redux-persist, jotai, react-query, MobX |
| [upgrade-v4.md](./references/upgrade-v4.md) | V3 → V4 breaking changes and migration |
| [limits-and-gotchas.md](./references/limits-and-gotchas.md) | Storage limits, multi-process, logging, common pitfalls |

## Problem → Reference Mapping

| Problem | Reference | Action |
|---------|-----------|--------|
| Don't know where to start | [create-instance.md](./references/create-instance.md) | Create instance with `createMMKV()` |
| Need reactive UI updates | [hooks.md](./references/hooks.md) | Use `useMMKVString` / `useMMKVObject` etc. |
| Encrypting sensitive data | [encryption.md](./references/encryption.md) | Call `storage.encrypt(key)` |
| App uses AsyncStorage, want to switch | [migrate-from-async-storage.md](./references/migrate-from-async-storage.md) | Batch migrate then swap calls |
| Zustand/Redux/Jotai persistence | [state-management.md](./references/state-management.md) | Wire adapter for your state lib |
| Upgrading from V3 to V4 | [upgrade-v4.md](./references/upgrade-v4.md) | `new MMKV()` → `createMMKV()`, `.delete()` → `.remove()` |
| Storage growing too large | [limits-and-gotchas.md](./references/limits-and-gotchas.md) | Trim or move to SQLite |
| Multi-process data sharing | [limits-and-gotchas.md](./references/limits-and-gotchas.md) | Set `mode: 'multi-process'` |
