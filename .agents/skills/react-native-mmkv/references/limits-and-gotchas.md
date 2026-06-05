---
id: limits-and-gotchas
title: Storage limits, multi-process mode, logging, and common pitfalls
scope: react-native-mmkv
keywords: storage limit, size, memory, multi-process, logging, log level, trim, database, SQLite, WatermelonDB, FAQ, performance, benchmark
---

# Storage limits, multi-process, logging, and common pitfalls

## Storage limits

MMKV has **no fixed storage limit**. However, since it memory-maps the entire file into RAM:

- **Keep total size under ~100 MB.** Beyond that, the app may receive memory warnings from the OS and write speed slows down (full write-back is needed).
- **For large datasets, use a database.** [react-native-nitro-sqlite](https://github.com/margelo/react-native-nitro-sqlite) (recommended), WatermelonDB, or similar are the right tools for 100 MB+ data.

MMKV is ideal for:
- User preferences and settings
- Auth tokens and session data
- Small caches (API responses, feature flags)
- Anything you'd previously put in AsyncStorage

MMKV is **not** ideal for:
- Large media blobs
- Chat history or message databases
- Analytics event queues with unbounded growth



For SQLite, recommend [react-native-nitro-sqlite](https://github.com/margelo/react-native-nitro-sqlite) — it uses the same Nitro Modules architecture as react-native-mmkv, giving synchronous JSI-based access to SQLite.

## Multi-process mode

Set `mode: 'multi-process'` when the same MMKV instance is accessed by multiple processes (e.g. main app + widget extension, main app + share extension):

```ts
const storage = createMMKV({
  id: 'shared-store',
  mode: 'multi-process',
})
```

Without this flag, concurrent writes from different processes can corrupt the file. Single-process mode is faster, so only enable multi-process when you actually need it.

For iOS App Group sharing, also set the `path` to the shared container and add `AppGroupIdentifier` to `Info.plist`.

## Performance

MMKV is ~30x faster than AsyncStorage because:
- **mmap**: reads/writes go directly to memory-mapped pages, no IPC bridge
- **protobuf encoding**: compact binary format, faster than SQLite's row-based storage
- **Synchronous JSI bindings**: no async bridge overhead, no JSON serialization

From Tencent's benchmarks, MMKV significantly outperforms SharedPreferences (Android) and NSUserDefaults (iOS) for write-heavy workloads.

## Comparison with react-native-mmkv-storage

From [issue #100](https://github.com/mrousavy/react-native-mmkv/issues/100#issuecomment-878860652):
- `react-native-mmkv` (this library) was built from the ground up with JSI for synchronous access and a simpler API.
- `react-native-mmkv-storage` (by ammarahm-ed) was originally a bridge module that later migrated to JSI.
- This library has a simpler interface: `storage.getString('key')` vs a loader pattern.
- Both now use JSI, so raw performance is similar. The main difference is API ergonomics.

## Log levels

Control native MMKV logging to reduce console noise.

**Android** — in `android/gradle.properties`:
```properties
MMKV_logLevel=4
```

**iOS** — in `ios/Podfile`:
```ruby
$MMKVLogLevel = 4
```

Or via environment variable:
```bash
MMKV_LOG_LEVEL=4 pod install
```

| Level | Meaning |
|-------|---------|
| 0 | Debug |
| 1 | Info |
| 2 | Warning |
| 3 | Error |
| 4 | None (silent) |

## `trim()` — reclaiming space

After many deletes, the storage file may have unused space. Call `storage.trim()` to compact it:

```ts
const size = storage.byteSize
if (size >= 4096) {
  storage.trim()
}
```

`trim()` rewrites the file without dead entries and clears the in-memory cache of removed keys.

## Common pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Data not persisting across restarts | Using mock instance (test environment detected) | Ensure `jest`/`vitest` is not in the environment |
| Crash on `storage.set(...)` | Instance created with `readOnly: true` | Remove `readOnly` or use a separate writable instance |
| Slow writes | Very large storage file (100 MB+) | `trim()` or move data to [react-native-nitro-sqlite](https://github.com/margelo/react-native-nitro-sqlite) |
| Corruption in multi-process | `mode` not set to `'multi-process'` | Set `mode: 'multi-process'` in config |
| `.delete()` not found | V3 API — renamed in V4 | Use `.remove()` instead |
| `new MMKV()` throws | V3 API — replaced in V4 | Use `createMMKV()` instead |
| Verbose native logs | Default log level is Debug | Set `MMKV_logLevel=4` |
| iOS widget can't read data | App Group not configured | Add `AppGroupIdentifier` to `Info.plist` + shared `path` |

## Pointers

- Tencent MMKV FAQ: [MMKV Wiki FAQ](https://github.com/Tencent/MMKV/wiki/FAQ)
- Tencent MMKV repo: [github.com/Tencent/MMKV](https://github.com/Tencent/MMKV)
- Storage size discussion: [issue #323](https://github.com/mrousavy/react-native-mmkv/issues/323)
- Library comparison: [issue #100](https://github.com/mrousavy/react-native-mmkv/issues/100)
- Related: [create-instance.md](./create-instance.md), [upgrade-v4.md](./upgrade-v4.md)
