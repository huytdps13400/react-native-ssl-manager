---
id: listeners
title: Value-change listeners
scope: react-native-mmkv
keywords: addOnValueChangedListener, listener, observer, remove, cleanup, onChange
---

# Value-change listeners

## Mental model

Every MMKV instance has a built-in observer registry. When any key's value changes (set, remove, clearAll), all registered listeners fire with the changed key. This is the non-React way to observe changes — for React components, prefer [`useMMKVListener`](./hooks.md).

## Recipe

### Register a listener

```ts
const storage = createMMKV()

const listener = storage.addOnValueChangedListener((changedKey) => {
  const newValue = storage.getString(changedKey)
  console.log(`"${changedKey}" new value: ${newValue}`)
})
```

### Remove a listener

Always clean up when no longer needed:

```ts
function onLogout() {
  listener.remove()
}
```

The `.remove()` call is on the returned `Listener` object — not on the storage instance.

### Common pattern: cleanup on unmount (non-hook)

```ts
class SettingsManager {
  private listener: Listener

  constructor(storage: MMKV) {
    this.listener = storage.addOnValueChangedListener((key) => {
      this.handleChange(key)
    })
  }

  destroy() {
    this.listener.remove()
  }

  private handleChange(key: string) {
    // react to change
  }
}
```

## Listener type

```ts
interface Listener {
  remove: () => void
}
```

## Gotchas

- **Listeners fire for every key change.** There's no per-key filtering at the native level. Filter in your callback if you only care about specific keys.
- **`clearAll()` fires once per key removed.** Not once for the entire clear operation.
- **Memory leaks.** If you register listeners without removing them, they accumulate. Always pair `addOnValueChangedListener` with `.remove()`.
- **For React components, use `useMMKVListener` instead.** It handles cleanup automatically on unmount.

## Pointers

- Nitro spec: [MMKV.nitro.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKV.nitro.ts) — see `addOnValueChangedListener`
- Hook equivalent: [useMMKVListener.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVListener.ts)
- Related: [hooks.md](./hooks.md)
