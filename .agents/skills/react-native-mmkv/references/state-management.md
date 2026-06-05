---
id: state-management
title: State management integrations
scope: react-native-mmkv
keywords: zustand, redux, redux-persist, jotai, react-query, tanstack, mobx, persist, middleware, adapter, wrapper, atomWithMMKV, StateStorage
---

# State management integrations

## Mental model

MMKV is synchronous, but most state-management persistence layers expect an async storage interface. The wrappers below bridge that gap — they're thin adapters that map each library's storage contract to MMKV's `set`/`getString`/`remove`.

## Zustand persist middleware

```ts
import { StateStorage } from 'zustand/middleware'
import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV()

export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    return storage.set(name, value)
  },
  getItem: (name) => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: (name) => {
    return storage.remove(name)
  },
}
```

Usage in a zustand store:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from './storage'

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }),
    {
      name: 'my-store',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)
```

## Redux persist

```ts
import { Storage } from 'redux-persist'
import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV()

export const reduxStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value)
    return Promise.resolve(true)
  },
  getItem: (key) => {
    const value = storage.getString(key)
    return Promise.resolve(value)
  },
  removeItem: (key) => {
    storage.remove(key)
    return Promise.resolve()
  },
}
```

Usage:

```ts
import { persistStore, persistReducer } from 'redux-persist'
import { reduxStorage } from './storage'

const persistConfig = {
  key: 'root',
  storage: reduxStorage,
}
```

## Jotai — `atomWithMMKV`

```ts
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV()

function getItem(key: string): string | null {
  const value = storage.getString(key)
  return value ? value : null
}

function setItem(key: string, value: string): void {
  storage.set(key, value)
}

function removeItem(key: string): void {
  storage.remove(key)
}

function subscribe(
  key: string,
  callback: (value: string | null) => void,
): () => void {
  const listener = (changedKey: string) => {
    if (changedKey === key) {
      callback(getItem(key))
    }
  }
  const { remove } = storage.addOnValueChangedListener(listener)
  return () => {
    remove()
  }
}

export const atomWithMMKV = <T>(key: string, initialValue: T) =>
  atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage<T>(() => ({
      getItem,
      setItem,
      removeItem,
      subscribe,
    })),
    { getOnInit: true },
  )
```

Usage:

```ts
const myAtom = atomWithMMKV('my-atom-key', 'default-value')
```

`createJSONStorage` handles `JSON.stringify`/`JSON.parse` automatically. See [Jotai docs](https://jotai.org/docs/utils/atom-with-storage).

## React Query (TanStack Query)

1. Install persist packages:

```bash
yarn add @tanstack/query-async-storage-persister @tanstack/react-query-persist-client
```

2. Create the persister:

```ts
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV()

const clientStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
  getItem: (key: string) => {
    const value = storage.getString(key)
    return value === undefined ? null : value
  },
  removeItem: (key: string) => {
    storage.remove(key)
  },
}

export const clientPersister = createAsyncStoragePersister({
  storage: clientStorage,
})
```

3. Wire it in your root component:

```tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { clientPersister } from './storage'

const App = () => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: clientPersister }}
    >
      {/* your app */}
    </PersistQueryClientProvider>
  )
}
```

## Gotchas

- **All adapters are thin wrappers.** The actual persistence is synchronous — the `Promise.resolve()` wrappers in redux-persist are just satisfying the interface contract.
- **JSON serialization is handled by the state library.** Zustand's `createJSONStorage`, jotai's `createJSONStorage`, and redux-persist all stringify before calling `setItem`. Don't double-stringify.
- **Jotai's `subscribe` is the differentiator.** The jotai adapter is the only one that wires up `addOnValueChangedListener` for live reactivity. The others rely on the state library's own change tracking.
- **One MMKV instance can back multiple stores.** All adapters can share the same `createMMKV()` instance. Keys won't collide as long as each store uses a unique `name`/`key` prefix.

## Pointers

- Official zustand wrapper: [WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE.md)
- Official redux wrapper: [WRAPPER_REDUX.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_REDUX.md)
- Official jotai wrapper: [WRAPPER_JOTAI.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_JOTAI.md)
- Official react-query wrapper: [WRAPPER_REACT_QUERY.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_REACT_QUERY.md)
- Official MobX wrapper: [WRAPPER_MOBX.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_MOBX.md)
- Official Recoil wrapper: [WRAPPER_RECOIL.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_RECOIL.md)
- Official TinyBase wrapper: [WRAPPER_TINYBASE.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_TINYBASE.md)
- Related: [create-instance.md](./create-instance.md), [listeners.md](./listeners.md)
