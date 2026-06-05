---
id: create-instance
title: Creating and configuring MMKV instances
scope: react-native-mmkv
keywords: createMMKV, configuration, id, path, encryptionKey, encryptionType, mode, readOnly, compareBeforeSet, multi-process, existsMMKV, deleteMMKV
---

# Creating and configuring MMKV instances

## Mental model

MMKV instances are created with the `createMMKV()` factory function. Each instance maps to a single file on disk identified by its `id`. The default instance uses `'mmkv.default'`. Multiple instances can coexist — a common pattern is one global instance and one per-user instance.

> **V4 change:** `new MMKV()` was replaced by `createMMKV()`. See [upgrade-v4.md](./upgrade-v4.md).

## Imports

```ts
import { createMMKV, existsMMKV, deleteMMKV } from 'react-native-mmkv'
```

## Recipes

### Default instance (simplest)

```ts
export const storage = createMMKV()
```

### Customized instance

```ts
export const storage = createMMKV({
  id: `user-${userId}-storage`,
  path: `${USER_DIRECTORY}/storage`,
  encryptionKey: 'hunter2',
  encryptionType: 'AES-256',
  mode: 'multi-process',
  readOnly: false,
  compareBeforeSet: false,
})
```

### Per-user storage pattern

```ts
function createUserStorage(userId: string) {
  return createMMKV({
    id: `user-${userId}-storage`,
    encryptionKey: userEncryptionKey,
  })
}
```

### Check if an instance exists on disk

```ts
const exists = existsMMKV('my-instance')
```

### Delete an instance from disk

```ts
const wasDeleted = deleteMMKV('my-instance')
```

## Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | `'mmkv.default'` | Unique identifier for this instance. Maps to a file on disk. |
| `path` | `string` | `undefined` | Custom root directory for the storage file. When unset, MMKV uses `$(Documents)/mmkv/` (or the App Group directory on iOS if configured). |
| `encryptionKey` | `string` | `undefined` | Encryption key. Enables AES encryption when set. |
| `encryptionType` | `'AES-128' \| 'AES-256'` | `'AES-128'` | Encryption algorithm. Only used when `encryptionKey` is set. |
| `mode` | `'single-process' \| 'multi-process'` | `'single-process'` | Set to `'multi-process'` if another process (e.g. a widget or app extension) reads/writes the same instance. |
| `readOnly` | `boolean` | `false` | When `true`, all write operations throw. |
| `compareBeforeSet` | `boolean` | `false` | When `true`, compares the new value with the existing one before writing. Avoids unnecessary disk writes. |

## iOS App Groups

To share MMKV data between your main app and an extension (widget, share extension, etc.), configure an App Group:

1. Add the `AppGroupIdentifier` key to your `Info.plist` with the group ID (e.g. `group.com.myapp`).
2. Set `path` to the shared container directory.

> **V4 change:** The key was renamed from `AppGroup` to `AppGroupIdentifier`.

## Rule of Thumb — how many instances?

| App size | Recommended instances |
|----------|----------------------|
| Small / simple | 1 (default) |
| Medium | 2–3 (e.g., usercache, auth, session) |
| Large / multi-module | 3–5, grouped by domain |

**Why not more?** Each MMKV instance memory-maps its own file. More instances means more mmap'd regions held open simultaneously, which increases the app's resident memory footprint. On memory-constrained devices this can trigger OS memory warnings or even OOM kills — especially if several instances are large. Consolidating related keys into fewer instances keeps the mmap count low and makes `trim()` / `clearAll()` operations simpler. Only split into a separate instance when you have a clear reason (different encryption keys, different lifecycle like per-user vs global, or App Group sharing).

## Gotchas

- **Same `id` = same file.** Two `createMMKV({ id: 'foo' })` calls return instances pointing to the same underlying file. This is fine — but encrypting one will affect all references.
- **`path` must exist.** MMKV does not create intermediate directories. Ensure the path exists before creating the instance.
- **`readOnly` + write = throw.** If you set `readOnly: true`, calling `set()`, `remove()`, or `clearAll()` will throw an error.
- **`compareBeforeSet` has a cost.** It reads the current value before every write. For high-frequency writes, this can be slower than just writing.

## Pointers

- Source: [createMMKV.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/createMMKV/createMMKV.ts)
- Mock: [createMockMMKV.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/createMMKV/createMockMMKV.ts) (used in tests)
- Nitro spec: [MMKVFactory.nitro.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKVFactory.nitro.ts)
- Related: [crud-operations.md](./crud-operations.md), [encryption.md](./encryption.md)
