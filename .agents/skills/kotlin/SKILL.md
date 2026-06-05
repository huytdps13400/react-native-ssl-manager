---
name: kotlin
description: Design, implement, and review Kotlin and Android APIs. Use when working on .kt files, Kotlin nullability, sealed classes/interfaces, coroutines, Android threading, Java interop, or Kotlin-backed React Native Nitro Module implementations.
---

# Kotlin

Use this skill for Kotlin code that needs strong type modeling, explicit async boundaries, and idiomatic Android integration. When the code is part of a Nitro Module, pair this with `build-nitro-modules` for generated specs, Promise mapping, annotations, and HybridObject constraints.

## Workflow

1. Read the local Kotlin code, generated abstract classes, and public API shape before editing.
2. Model valid states with Kotlin types before implementing behavior.
3. Choose whether work is synchronous, coroutine-based, or explicitly dispatched.
4. Keep properties cheap and nonblocking.
5. Make thread hops, Android service access, I/O, and fallible work visible in the API.

## Type-Safe API Design

- Represent state variants with sealed interfaces/classes, normal interfaces, or concrete classes. Do not encode variants as one data class with many nullable fields.
- Keep related values non-null on the variant where they are valid. If `barcode` and `barcodeType` must exist together, put them on `ScannedBarcode`.
- Use nullable types for real absence inside one state, not for "maybe this object is a different kind of thing".
- Prefer compile-time narrowing over caller-side null probing. Repeated null checks for related fields usually mean the model is too loose.

```kotlin
// Avoid: related fields are nullable and the valid combinations are implicit.
data class ScannedData(
  val position: Point,
  val text: String?,
  val barcode: String?,
  val barcodeType: BarcodeType?,
  val face: Rect?,
)

// Prefer: each variant exposes only the fields that are valid for it.
sealed interface ScannedData {
  val position: Point
}

data class ScannedText(
  override val position: Point,
  val text: String,
) : ScannedData

data class ScannedBarcode(
  override val position: Point,
  val barcode: String,
  val barcodeType: BarcodeType,
) : ScannedData

data class ScannedFace(
  override val position: Point,
  val face: Rect,
) : ScannedData
```

## Async and Threading

- Use coroutines for naturally suspending APIs and Android I/O that already has coroutine support.
- Keep quick, deterministic, local work synchronous. Do not introduce coroutines, dispatchers, or Promise plumbing for simple value construction, cached metadata, or pure transforms.
- Use explicit owned dispatchers/scopes or Nitro `Promise.parallel` for CPU-bound synchronous work that should not run on the caller thread.
- Avoid the main dispatcher unless the Android API requires it, such as view/UI mutation or lifecycle APIs. Keep main-thread blocks small and move parsing, conversion, I/O, session negotiation, and CPU work to an owned dispatcher or async API.
- Do not use `runBlocking` in library code, property getters, setters, or JS-facing entry points.
- Do not hide a thread hop, service lookup, blocking I/O, permission flow, or fallible native operation behind a property.
- If a value is emitted by a specific Android callback/thread, prefer a listener, Flow, or event API. In Nitro specs, expose a listener or a `Promise<T>` method.
- Treat repeated `launch`, `withContext`, dispatcher, handler, or executor hops as an architecture smell. A component should either own the coroutine scope/dispatcher/lifecycle it works on, or cross into that owner once at the public async boundary or native callback boundary.
- If a workflow bounces between main, IO, default, native, and JS/Nitro contexts in multiple nested places, stop and redesign the object/lifecycle/API. Excessive hops hide latency, make ordering harder to reason about, and create future performance problems.
- Do not fix races or readiness bugs with `delay`, `Thread.sleep`, `Handler.postDelayed`, timers, extra dispatcher hops, or calling the same method twice. Fix the owner dispatcher/lifecycle, state machine, callback/event, Flow, or async API boundary instead. Retry only for external nondeterminism such as hardware, OS services, remote services, or network, and keep retries bounded, cancellable, and idempotent.
- Keep mutable shared state owned by one coroutine scope, dispatcher, lock, or Android component lifecycle. Avoid mixing ownership models without a clear boundary.
- Treat `Mutex`, `synchronized`, and `ReentrantLock` as last-resort synchronization, not default listener or callback plumbing. Before adding one, identify the exact shared mutable values, concurrent callers, and why a single owner dispatcher/lifecycle, channel/Flow, or immutable snapshot is not enough.
- Never hold a lock while invoking callbacks, calling into JS/Nitro, or calling unknown user code. Snapshot listeners under the lock if needed, unlock, then call them. A listener removed during an in-flight emission may receive that current event.

## Properties

- Use `val` and `var` for cheap in-memory state or derived values.
- Use methods for side effects, I/O, Android service calls, permission checks, allocation, blocking work, or operations that can fail.
- If a property would need to wait for another thread, redesign it as an async method or event.

```kotlin
// Avoid: blocking work hidden in a getter.
val status: SessionStatus
  get() = runBlocking { session.status() }

// Prefer: make the async boundary explicit.
fun getStatus(): Promise<SessionStatus> {
  return Promise.async {
    session.status()
  }
}
```

## Kotlin Style

- Make classes final by default. Kotlin classes already are final unless marked `open`; keep them that way unless inheritance is intentional.
- Prefer `data class` for plain values and regular classes for owned resources or lifecycle.
- Prefer `sealed interface` or `sealed class` for closed result families.
- Use `require`, `check`, or specific exceptions for invalid inputs and invalid state. Do not silently no-op user-reachable failures.
- Keep Java interop explicit. Convert platform types into Kotlin types before exposing them through the public API where practical.
- Avoid `!!` except at narrow boundaries where a prior check makes the invariant obvious. Prefer early returns, `requireNotNull`, or typed state.
- Prefer explicit `return` statements inside multi-line control flow. Do not lift the return outside a multi-line `try`/`catch`, `if`, `when`, or lambda just to make it expression-like; use `try { return value } catch (...) { return fallback }`.
- In multi-line lambdas, use labeled returns such as `return@map value` for the result. Omit the label only for true single-expression lambdas like `items.map { it.toString() }`; do not write `items.map { return@map it.toString() }`.
- Prefer inline shorthand for unambiguous single-expression lambdas: `formats.map { it.toMLKitFormat() }`, not a multi-line `map { format -> format.toMLKitFormat() }`. Do not use `it` when a surrounding or nested lambda already uses `it`; name parameters in nested lambdas or when clarity needs it.
- Treat a filename as a scope contract. `HybridDataScanner.kt` should implement `HybridDataScanner`; it should not also contain Android helpers, geometry conversions, listeners, or extension utilities.
- Keep one top-level implementation type per file. Do not put secondary classes, interfaces, enums, option adapters, coordinators, delegates, or helper types below the primary type. If a helper deserves a type, it deserves its own file.
- Keep one focused extension/conversion per file. Do not create a catch-all extension file just because every helper is an extension. Split conversions into named files such as `Barcode+toScannedCode.kt`, `TargetBarcodeFormat+toMLKitFormat.kt`, and `BarcodeFormat+fromMLKitBarcodeFormat.kt` with `internal` visibility where appropriate.
- Never put extension `fun`, `val`, or `var` declarations inside `Hybrid*` implementation files or other primary implementation files, even when they are private, tiny, or only used by that file. Put every extension in a separate named `Type+operation.kt` extension/converter file so code splitting, maintainability, and future diffs stay clean.
- Do not place private top-level extension properties/functions below a primary class just because Kotlin allows it. Companion extensions, enum/platform mappings, barcode format conversions, and ML Kit/CameraX adapters belong in their own named files.
- Use private top-level helpers in the same file only when they are tiny, non-extension functions/properties, and exist solely to support that file's primary type.
- Extract Android preflight checks and platform boilerplate out of `Hybrid*` factories and implementation methods. Permission checks, manifest feature/permission validation, `PackageManager` capability checks, service availability checks, and similar setup guards belong in focused helper files; the HybridObject call site should stay one or two lines.
- Do not create broad `Utils.kt` files for these helpers. Name the file after the platform type or domain check and keep each helper focused on one behavior.
- Use line count as a review signal: files below roughly 300 lines are usually fine only after the one-type-per-file and no-helpers-in-factory rules are satisfied. Size caused by helpers, conversions, or Android glue is a design issue.
- Put conversions on the element type, not on `List` or array types, when the conversion only reads one element. Prefer `TargetBarcodeFormat.toMLKitFormat()` plus `formats.map { it.toMLKitFormat() }` at the call site over `Array<TargetBarcodeFormat>.toMLKitFormats()`.
- Do not put domain conversions on broad/common receivers such as `Int`, `String`, `Double`, or `Any`, even privately. Prefer the domain type's companion/factory direction, such as `BarcodeFormat.Companion.fromFormat(format: Int)`, over `Int.toBarcodeFormat()`.
- Add collection extension functions only when the collection has real domain behavior, such as validation across elements, deduplication, ordering, batching, caching, nonempty checks, or error aggregation. If the receiver is a concrete `Array<SomeDomainType>` or `List<SomeDomainType>` and the body is mostly `map { ... }`, keep it in caller code.
- When a Kotlin converter returns or accepts Android platform `Int` constants, apply the matching AndroidX/Java/Kotlin annotation where the API supports it, such as a CameraX `@ImageCapture.FlashMode`-style annotation on the function, return value, or parameter. Check the annotation target and retention before placing it; do not annotate blindly when the platform API exposes only a plain `Int`.
- When converting from an annotated platform `Int`, put the annotation on the `format: Int` parameter if the annotation target supports parameters. For example, prefer `BarcodeFormat.Companion.fromFormat(@SomeBarcodeFormat format: Int)` over an untyped primitive input.

## Nitro Notes

- Kotlin HybridObject implementations must extend the generated `Hybrid*Spec` class and include `@Keep` plus `@DoNotStrip`.
- Use `Promise.async` for suspending or I/O work and `Promise.parallel` for CPU-bound synchronous work.
- Avoid manually creating or passing around `Promise<T>` instances. Prefer `Promise.async`, `Promise.parallel`, `Promise.resolved`, and `Promise.rejected`; use a manual Promise only for real native completion/listener/callback bridges that cannot be wrapped as suspend APIs.
- For general callback APIs such as Google `Task<T>`, first write a generic suspend adapter in its own extension file, such as `Task+await.kt`, then call it from `Promise.async { task.await() }`. Do not hand-wire `addOnSuccessListener`/`addOnFailureListener`/`addOnCanceledListener` into public HybridObject methods.
- Use `Promise<Unit>` for `Promise<void>`.
- Access `NitroModules.applicationContext` lazily and fail explicitly if it is unavailable.
- Generated properties are synchronous JS entry points. Redesign them as methods or listeners if they need Android thread affinity or async work.
