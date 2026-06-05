---
id: encryption
title: Encryption and decryption
scope: react-native-mmkv
keywords: encrypt, decrypt, recrypt, AES-128, AES-256, encryptionKey, encryptionType, isEncrypted, secure storage
---

# Encryption and decryption

## Mental model

MMKV supports AES encryption at the instance level. You can either create an instance with encryption from the start (via `encryptionKey` in config), or encrypt/decrypt an existing instance at runtime. Encryption applies to the entire storage file — not per-key.

The underlying engine is Tencent's MMKV C++ library, which handles AES-128 (default) and AES-256.

## Recipes

### Create an encrypted instance

```ts
import { createMMKV } from 'react-native-mmkv'

const secureStorage = createMMKV({
  id: 'secure-store',
  encryptionKey: 'my-secret-key',
  encryptionType: 'AES-256',
})
```

### Encrypt an existing unencrypted instance

```ts
storage.encrypt('my-secret-key')
// or with explicit algorithm:
storage.encrypt('my-secret-key', 'AES-256')
```

### Decrypt (remove encryption)

```ts
storage.decrypt()
```

After decrypting, the storage file is rewritten without encryption. All data remains accessible.

### Re-encrypt with a new key

```ts
storage.recrypt('new-secret-key')
// or remove encryption entirely:
storage.recrypt(undefined)
```

`recrypt` is equivalent to decrypt + encrypt, but done atomically.

> **Deprecated:** `recrypt()` is marked `@deprecated` in V4 — prefer `encrypt(key)` and `decrypt()` for new code.

### Check encryption status

```ts
if (storage.isEncrypted) {
  console.log('Storage is encrypted')
}
```

## Encryption types

| Type | Max key length | Description |
|------|----------------|-------------|
| `'AES-128'` | 16 bytes | Default. Faster, sufficient for most use cases. |
| `'AES-256'` | 32 bytes | Stronger encryption. Slightly slower. |

## Gotchas

- **Key length limits.** Encryption keys can be at most **16 bytes** with AES-128 and **32 bytes** with AES-256. Longer keys throw a runtime error.
- **Encryption is not supported on Web.** `encrypt()`, `decrypt()`, and `recrypt()` all throw on the web platform (localStorage backend).
- **Encryption key is not stored by MMKV.** You must provide the same key every time you open the instance. If you lose the key, the data is unrecoverable.
- **Encrypting affects all references.** If two parts of your code hold references to the same instance (same `id`), encrypting from one affects both.
- **Encryption ≠ Keychain.** MMKV encryption protects data at rest on disk. If you need to securely store the encryption key itself, use the platform keychain (e.g. `react-native-keychain` or `expo-secure-store`).
- **Performance impact is minimal.** AES encryption/decryption happens at the C++ level and is negligible for typical key-value workloads.

## Pointers

- Nitro spec: [MMKV.nitro.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKV.nitro.ts) — see `encrypt`, `decrypt`, `recrypt`
- Config types: [MMKVFactory.nitro.ts](https://github.com/mrousavy/react-native-mmkv/blob/main/packages/react-native-mmkv/src/specs/MMKVFactory.nitro.ts) — see `EncryptionType`
- Tencent MMKV encryption docs: [MMKV Wiki](https://github.com/Tencent/MMKV/wiki/android_advance#encryption)
- Related: [create-instance.md](./create-instance.md)
