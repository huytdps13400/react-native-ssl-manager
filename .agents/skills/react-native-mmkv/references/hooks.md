---
id: hooks
title: React hooks for MMKV
scope: react-native-mmkv
keywords: useMMKVString, useMMKVNumber, useMMKVBoolean, useMMKVBuffer, useMMKVObject, useMMKV, useMMKVListener, useMMKVKeys, hooks, reactive
---

# React hooks for MMKV

## Mental model

MMKV provides React hooks that behave like `useState` — they return `[value, setter]` tuples and automatically re-render the component when the underlying MMKV value changes. This means if one component writes to a key, every other component using a hook on that key re-renders.

All hooks accept an optional second argument: a specific MMKV instance. If omitted, they use the default instance.

## Available hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useMMKVString(key, instance?)` | `[string \| undefined, (v: string \| undefined) => void]` | Reactive string value |
| `useMMKVNumber(key, instance?)` | `[number \| undefined, (v: number \| undefined) => void]` | Reactive number value |
| `useMMKVBoolean(key, instance?)` | `[boolean \| undefined, (v: boolean \| undefined) => void]` | Reactive boolean value |
| `useMMKVBuffer(key, instance?)` | `[ArrayBuffer \| undefined, (v: ArrayBuffer \| undefined) => void]` | Reactive buffer value |
| `useMMKVObject<T>(key, instance?)` | `[T \| undefined, (v: T \| undefined) => void]` | Reactive JSON object (auto stringify/parse) |
| `useMMKV(config?)` | `MMKV` | Creates/returns an MMKV instance reactively |
| `useMMKVListener(callback, instance?)` | `void` | Fires callback on any key change |
| `useMMKVKeys(instance?)` | `string[]` | Reactive list of all keys |

All value-hook setters also accept a **functional update** (like `useState`): `setValue(prev => ...)`.

## Recipes

### Basic typed hooks

```tsx
function App() {
  const [username, setUsername] = useMMKVString('user.name')
  const [age, setAge] = useMMKVNumber('user.age')
  const [isPremium, setIsPremium] = useMMKVBoolean('user.isPremium')
  const [privateKey, setPrivateKey] = useMMKVBuffer('user.privateKey')

  return <Text>{username} is {age} years old</Text>
}
```

### Functional updates

Setters accept a function of the previous value, just like `useState`:

```tsx
const [age, setAge] = useMMKVNumber('user.age')

const onBirthday = useCallback(() => {
  setAge((prev) => (prev ?? 0) + 1)
}, [setAge])
```

### Clearing a key

Pass `undefined` to the setter to remove the key:

```tsx
const [username, setUsername] = useMMKVString('user.name')

const onLogout = useCallback(() => {
  setUsername(undefined) // removes 'user.name' from storage
}, [setUsername])
```

### Typed objects

```tsx
type User = {
  id: string
  username: string
  age: number
}

function App() {
  const [user, setUser] = useMMKVObject<User>('user')

  if (user == null) return <Text>Loading...</Text>
  return <Text>{user.username}</Text>
}
```

`useMMKVObject` handles `JSON.stringify`/`JSON.parse` internally.

### Getting an MMKV instance in a component

```tsx
function App() {
  const storage = useMMKV()

  const onLogin = useCallback((username: string) => {
    storage.set('user.name', username)
  }, [storage])
}
```

### Using a custom instance

```tsx
function App() {
  const userStorage = useMMKV({ id: `${userId}.storage` })
  const [username, setUsername] = useMMKVString('user.name', userStorage)

  return <Text>{username}</Text>
}
```

### Listening for changes

```tsx
function App() {
  useMMKVListener((key) => {
    console.log(`Value for "${key}" changed!`)
  })
}
```

With a specific instance:

```tsx
function App() {
  const storage = useMMKV({ id: `${userId}.storage` })

  useMMKVListener((key) => {
    console.log(`Value for "${key}" changed in user storage!`)
  }, storage)
}
```

### Tracking all keys

```tsx
function App() {
  const storage = useMMKV()
  const keys = useMMKVKeys(storage)

  return <Text>Stored keys: {keys.join(', ')}</Text>
}
```

## Gotchas

- **Setter with `undefined` deletes the key.** This is intentional — it maps to `storage.remove(key)`.
- **Hooks re-render on every change to that key.** If you write to a key very frequently (e.g. every frame), the component will re-render on every write. Consider throttling or using `storage.set()` directly instead of the hook setter.
- **`useMMKVObject` re-parses when the stored value changes.** Parsing is memoized on the underlying JSON string, so it does not re-parse on every render — but every write to that key triggers a `JSON.parse`. For large objects written frequently, this can cause noticeable performance issue.
- **`useMMKV()` without arguments returns the default instance.** Pass `{ id: '...' }` to get a specific one.

## Pointers

- Source: [hooks/](https://github.com/mrousavy/react-native-mmkv/tree/main/packages/react-native-mmkv/src/hooks)
- Hooks: [useMMKVString.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVString.ts), [useMMKVNumber.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVNumber.ts), [useMMKVBoolean.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVBoolean.ts), [useMMKVBuffer.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVBuffer.ts), [useMMKVObject.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVObject.ts), [useMMKV.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKV.ts), [useMMKVListener.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVListener.ts), [useMMKVKeys.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/hooks/useMMKVKeys.ts)
- Tests: [hooks.test.tsx](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/__tests__/hooks.test.tsx)
- Related: [listeners.md](./listeners.md), [crud-operations.md](./crud-operations.md)
