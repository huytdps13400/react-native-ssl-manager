---
id: crud-operations
title: Reading and writing values
scope: react-native-mmkv
keywords: set, getString, getNumber, getBoolean, getBuffer, contains, getAllKeys, remove, clearAll, JSON, object, ArrayBuffer, size, trim, importAllFrom
---

# Reading and writing values

## Mental model

All MMKV read/write operations are **synchronous**. No `await`, no Promises. This is possible because MMKV memory-maps its file — reads and writes happen directly against the mmap'd region.

Supported value types: `string`, `number`, `boolean`, `ArrayBuffer`. For objects, serialize to JSON manually.

## Recipes

### Basic set/get

```ts
storage.set('user.name', 'Marc')
storage.set('user.age', 21)
storage.set('is-mmkv-fast-asf', true)

const username = storage.getString('user.name')       // 'Marc'
const age = storage.getNumber('user.age')              // 21
const isFast = storage.getBoolean('is-mmkv-fast-asf') // true
```

### Objects (via JSON)

MMKV does not store objects natively. Serialize with `JSON.stringify` and deserialize with `JSON.parse`:

```ts
const user = { username: 'Marc', age: 21 }
storage.set('user', JSON.stringify(user))

const jsonUser = storage.getString('user')
const userObject = jsonUser ? JSON.parse(jsonUser) : undefined
```

For reactive object access in components, use [`useMMKVObject`](./hooks.md).

### ArrayBuffer

```ts
const buffer = new ArrayBuffer(3)
const view = new Uint8Array(buffer)
view[0] = 1
view[1] = 100
view[2] = 255
storage.set('someToken', buffer)

const retrieved = storage.getBuffer('someToken') // ArrayBuffer
```

### Key management

```ts
const hasKey = storage.contains('user.name')  // boolean
const keys = storage.getAllKeys()              // string[]
const removed = storage.remove('user.name')   // boolean (NOTE: was .delete() till V4)
storage.clearAll()                            // removes all keys
```

### Storage size and maintenance

```ts
const size = storage.byteSize  // total file size in bytes

// Free unused space after many deletes
if (size >= 4096) {
  storage.trim()
}
```

### Import from another instance

```ts
const importedCount = storage.importAllFrom(otherStorage)
```

Copies all key-value pairs from `otherStorage` into this instance. Returns the number of keys imported.

## Read-only properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | The instance identifier |
| `length` | `number` | Number of stored keys |
| `byteSize` | `number` | Total file size in bytes |
| `size` | `number` | Deprecated — use `byteSize` instead |
| `isReadOnly` | `boolean` | Whether the instance is read-only |
| `isEncrypted` | `boolean` | Whether encryption is enabled |

## Gotchas

- **Type must match what you stored.** If you stored a number, use `getNumber`. Reading with the wrong getter (e.g. `getString` on a number key) is incorrect and may result in garbage value
- **`remove()` not `delete()`.** V4 renamed this because `delete` is a C++ reserved keyword in the Nitro binding.
- **`clearAll()` is instant and irreversible.** No confirmation dialog. All keys gone.
- **Object storage = your responsibility.** `JSON.stringify`/`JSON.parse` failures are on your code. Consider `useMMKVObject` hook for type-safe reactive access.
- **`getAllKeys()` returns a snapshot.** It's not reactive — changes after the call aren't reflected.

## Pointers

- Nitro spec: [MMKV.nitro.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKV.nitro.ts)
- Related: [hooks.md](./hooks.md), [create-instance.md](./create-instance.md)
