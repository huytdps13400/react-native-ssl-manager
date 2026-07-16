import nacl from 'tweetnacl';
import type { SslPinningConfig } from './types/SslPinningConfig';
import { normalizeSslConfig } from './config';

/** A signed over-the-air pin bundle as served over HTTPS. */
export interface SignedPinBundle {
  /** base64 of the UTF-8 JSON {@link OtaPayload}. */
  payload: string;
  /** base64 Ed25519 signature over the decoded payload bytes. */
  signature: string;
}

export interface OtaPayload {
  version: number;
  /** ISO-8601 time the bundle was signed. */
  issuedAt: string;
  /** Optional ISO-8601 time after which the bundle must be rejected. */
  expiresAt?: string;
  config: SslPinningConfig;
}

export interface OtaVerifyOptions {
  /** base64 raw Ed25519 public key (32 bytes) — from `ssl-manager keygen`. */
  publicKey: string;
  /** Reject bundles whose `issuedAt` is older than this many milliseconds. */
  maxAgeMs?: number;
  /**
   * Reject bundles issued before this epoch-ms (session anti-rollback).
   * Callers normally pass the `issuedAt` of the last applied bundle.
   */
  minIssuedAt?: number;
}

export interface OtaResult {
  version: number;
  issuedAt: string;
  domains: string[];
  config: SslPinningConfig;
}

export class OtaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OtaError';
    this.code = code;
  }
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 → bytes without relying on `atob` (not present on all RN runtimes). */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[\s=]+$/g, '').replace(/\s/g, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) {
    throw new OtaError('OTA_INVALID_BUNDLE', 'Invalid base64 input');
  }
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

/** Minimal UTF-8 decoder (TextDecoder is unavailable on some RN runtimes). */
export function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i]!;
    let codePoint: number;
    if (byte < 0x80) {
      codePoint = byte;
      i += 1;
    } else if (byte < 0xe0) {
      codePoint = ((byte & 0x1f) << 6) | (bytes[i + 1]! & 0x3f);
      i += 2;
    } else if (byte < 0xf0) {
      codePoint =
        ((byte & 0x0f) << 12) |
        ((bytes[i + 1]! & 0x3f) << 6) |
        (bytes[i + 2]! & 0x3f);
      i += 3;
    } else {
      codePoint =
        ((byte & 0x07) << 18) |
        ((bytes[i + 1]! & 0x3f) << 12) |
        ((bytes[i + 2]! & 0x3f) << 6) |
        (bytes[i + 3]! & 0x3f);
      i += 4;
    }
    result += String.fromCodePoint(codePoint);
  }
  return result;
}

/**
 * Verifies a signed pin bundle: Ed25519 signature, freshness, rollback, and
 * config validity. Pure — performs no I/O and never mutates pinning state.
 * Returns the verified payload; throws {@link OtaError} on any failure.
 */
export function verifyOtaBundle(
  bundle: SignedPinBundle,
  options: OtaVerifyOptions,
  now: number = Date.now()
): OtaResult {
  if (
    bundle == null ||
    typeof bundle.payload !== 'string' ||
    typeof bundle.signature !== 'string'
  ) {
    throw new OtaError(
      'OTA_INVALID_BUNDLE',
      'Bundle must be JSON with base64 "payload" and "signature" fields'
    );
  }

  const publicKey = base64ToBytes(options.publicKey);
  if (publicKey.length !== nacl.sign.publicKeyLength) {
    throw new OtaError(
      'OTA_INVALID_PUBLIC_KEY',
      `publicKey must be ${nacl.sign.publicKeyLength} raw Ed25519 bytes (base64)`
    );
  }

  const payloadBytes = base64ToBytes(bundle.payload);
  const signature = base64ToBytes(bundle.signature);
  if (!nacl.sign.detached.verify(payloadBytes, signature, publicKey)) {
    throw new OtaError(
      'OTA_INVALID_SIGNATURE',
      'Bundle signature does not verify against the provided public key'
    );
  }

  let payload: OtaPayload;
  try {
    payload = JSON.parse(utf8Decode(payloadBytes)) as OtaPayload;
  } catch {
    throw new OtaError('OTA_INVALID_BUNDLE', 'Payload is not valid JSON');
  }

  const issuedAt = Date.parse(payload.issuedAt);
  if (!Number.isFinite(issuedAt)) {
    throw new OtaError('OTA_INVALID_BUNDLE', 'Payload has no valid issuedAt');
  }
  if (payload.expiresAt != null) {
    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt < now) {
      throw new OtaError('OTA_EXPIRED', 'Bundle expiresAt has passed');
    }
  }
  if (options.maxAgeMs != null && now - issuedAt > options.maxAgeMs) {
    throw new OtaError(
      'OTA_EXPIRED',
      `Bundle issuedAt is older than maxAgeMs (${options.maxAgeMs})`
    );
  }
  if (options.minIssuedAt != null && issuedAt < options.minIssuedAt) {
    throw new OtaError(
      'OTA_ROLLBACK',
      'Bundle is older than the last applied bundle'
    );
  }

  const config = normalizeSslConfig(payload.config);

  return {
    version: payload.version,
    issuedAt: payload.issuedAt,
    domains: Object.keys(config.sha256Keys),
    config,
  };
}
