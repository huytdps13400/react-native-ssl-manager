---
id: migrate-from-async-storage
title: Migrating from AsyncStorage to MMKV
scope: react-native-mmkv
keywords: AsyncStorage, migration, migrate, transfer, data, switch, upgrade, batch
---

# Migrating from AsyncStorage to MMKV

## Mental model

AsyncStorage is async and slow; MMKV is sync and fast. But you can't just swap the import — existing data lives in AsyncStorage's SQLite database and needs to be copied over. The migration is a one-time batch operation at app startup.

The pattern: read all keys from AsyncStorage, write them into MMKV, delete from AsyncStorage, then set a "migration done" flag so it never runs again.

## Recipe

### `storage.ts` — MMKV instance + migration function

```ts
import { createMMKV } from 'react-native-mmkv'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = createMMKV()

const MIGRATION_KEY = 'mmkv_migration_complete'

export async function migrateFromAsyncStorage(): Promise<void> {
  if (storage.getBoolean(MIGRATION_KEY)) return

  console.log('Migrating from AsyncStorage to MMKV...')
  const start = Date.now()

  try {
    const keys = await AsyncStorage.getAllKeys()
    if (keys.length === 0) {
      storage.set(MIGRATION_KEY, true)
      return
    }

    const entries = await AsyncStorage.multiGet(keys)

    for (const [key, value] of entries) {
      if (key == null || value == null) continue

      // Handle booleans stored as strings (common AsyncStorage pattern)
      if (value === 'true' || value === 'false') {
        storage.set(key, value === 'true')
      } else {
        storage.set(key, value)
      }
    }

    // Remove migrated data from AsyncStorage
    await AsyncStorage.multiRemove(keys)

    storage.set(MIGRATION_KEY, true)
    console.log(`Migration complete in ${Date.now() - start}ms (${keys.length} keys)`)
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}
```

### `App.tsx` — run migration before app renders

```tsx
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { InteractionManager } from 'react-native'
import { migrateFromAsyncStorage } from './storage'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        await migrateFromAsyncStorage()
      } catch {
        // TODO: decide on fallback — retry, ignore, or crash
      } finally {
        setReady(true)
      }
    })
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return <MainApp />
}
```

### Swapping calls throughout the codebase

After migration, replace all AsyncStorage usage:

```ts
// BEFORE
const value = await AsyncStorage.getItem('user.name')
await AsyncStorage.setItem('user.name', 'Marc')

// AFTER
const value = storage.getString('user.name')
storage.set('user.name', 'Marc')
```

Key differences:
- No `await` — everything is synchronous
- `getItem` → `getString` / `getNumber` / `getBoolean` (type-specific)
- `setItem` → `set` (accepts string, number, boolean, ArrayBuffer)
- `removeItem` → `remove`
- `multiGet` / `multiSet` → loop with `set` / `getString` (still fast because synchronous)
- `clear` → `clearAll`

## Gotchas

- **AsyncStorage stores everything as strings.** Numbers come back as `"42"`, booleans as `"true"`. Parse them during migration if you want typed values in MMKV.
- **`null` vs `undefined`.** AsyncStorage's `getItem` returns `null` for missing keys; MMKV's getters return `undefined`. Update any `value === null` checks to `value === undefined`.
- **Remove migration code eventually.** Once all users have upgraded, the migration path is dead code. Add a TODO to remove it.
- **Don't migrate on every launch.** The `MIGRATION_KEY` flag is critical — without it, you'll re-run the (now empty) migration on every cold start.
- **Error handling is your decision.** If migration fails partway, some keys are in MMKV and some are still in AsyncStorage. Decide whether to retry, crash, or continue.

## Pointers

- Official migration guide: [MIGRATE_FROM_ASYNC_STORAGE.md](https://github.com/mrousavy/react-native-mmkv/blob/main/docs/MIGRATE_FROM_ASYNC_STORAGE.md)
- Related: [create-instance.md](./create-instance.md), [crud-operations.md](./crud-operations.md)
