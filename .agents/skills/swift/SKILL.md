---
name: swift
description: Design, implement, and review Swift APIs and Apple-platform code. Use when working on .swift files, Swift types, Foundation or AVFoundation APIs, DispatchQueue, async/await, Task, actors, MainActor, thread-affine state, or Swift-backed React Native Nitro Module implementations.
---

# Swift

Use this skill for Swift code that needs strong API boundaries, predictable threading, and idiomatic Apple-platform integration. When the code is part of a Nitro Module, pair this with `build-nitro-modules` for generated specs, Promise mapping, and HybridObject constraints.

## Workflow

1. Read the local Swift code, generated protocols, and surrounding API shape before editing.
2. Choose the public type model first: make invalid states unrepresentable where Swift can express them.
3. Choose one concurrency model for the feature before writing implementation code.
4. Keep synchronous properties and methods cheap, local, and nonblocking.
5. Make queue hops, hardware/session negotiation, I/O, and fallible async work explicit in the API.

## Type-Safe API Design

- Represent state variants with types, not nullable clusters. Use protocols plus conforming structs/classes when variants share a public contract, or use `enum` with associated values when the set is closed and value-like.
- Keep related fields nonoptional on the same variant. If `barcode` and `barcodeType` are meaningful only together, put both on `ScannedBarcode`; do not make both optional on a generic scanned-data struct.
- Use optionals only for real domain absence inside one state, not for expressing which state the object is in.
- Prefer compile-time flow over caller-side probing. If callers need repeated `if let` chains to discover valid field combinations, the API shape is probably wrong.

```swift
// Avoid: the valid combinations are implicit and easy to misuse.
struct ScannedData {
  let position: Point
  let text: String?
  let barcode: String?
  let barcodeType: BarcodeType?
  let face: Rect?
}

// Prefer: each state exposes the fields that are valid for that state.
protocol ScannedData {
  var position: Point { get }
}

struct ScannedText: ScannedData {
  let position: Point
  let text: String
}

struct ScannedBarcode: ScannedData {
  let position: Point
  let barcode: String
  let barcodeType: BarcodeType
}

struct ScannedFace: ScannedData {
  let position: Point
  let face: Rect
}
```

## Concurrency Model

- Choose Swift concurrency or DispatchQueue for a feature, not both as interleaved control flow.
- Keep quick, deterministic, local work synchronous. Do not introduce `Task`, `DispatchQueue`, or Promise plumbing for simple value construction, cached metadata, or pure transforms.
- Use Swift `async`/`await`, `Task`, and actors only when the full operation can be represented cleanly in Swift concurrency without queue escape hatches.
- Use a private owned serial `DispatchQueue` when Apple APIs, delegates, callbacks, C++ bridges, JS runtimes, or Nitro thread boundaries already revolve around queues, or when heavier native work must not block the caller.
- Avoid `DispatchQueue.main` unless the platform API requires the main thread, such as UIKit/AppKit/VisionKit presentation or view mutation. Keep main-thread blocks small and move parsing, conversion, I/O, session negotiation, and CPU work to an owned queue or async API.
- Treat repeated `Task`, `DispatchQueue`, actor, or thread hops as an architecture smell. A component should either own the queue/actor it works on, or cross into that owner once at the public async boundary or native callback boundary.
- If a workflow bounces between main, background, JS, and native queues in multiple nested places, stop and redesign the object/lifecycle/API. Excessive hops hide latency, make ordering harder to reason about, and create future performance problems.
- Do not fix races or readiness bugs with `DispatchQueue.asyncAfter`, `Task.sleep`, `Thread.sleep`, timers, extra queue hops, or calling the same method twice. Fix the owner queue, lifecycle state, completion callback, delegate event, or async API boundary instead. Retry only for external nondeterminism such as hardware, OS services, remote services, or network, and keep retries bounded, cancellable, and idempotent.
- Do not use `Task { @MainActor in ... }` as a generic main-thread hop from a nonisolated or Nitro-generated entry point. It creates unstructured Swift concurrency. Use it only when the operation is otherwise Swift-concurrency based and benefits from `async`/`await`, task cancellation, or actor isolation end to end.
- For UIKit, AppKit, VisionKit, and other main-thread callback/delegate APIs, prefer a direct `DispatchQueue.main.async` boundary or an async public method that owns the hop. Direct `DispatchQueue.main.async` is understood by Swift's actor checker for `@MainActor` calls; generic queue wrappers such as `Promise.parallel(.main)` usually are not.
- If a callback can return on an arbitrary queue, normalize it to the chosen owner queue once, close to the callback source, instead of scattering nested `Task { @MainActor }` or `DispatchQueue.main.async` hops through the workflow.
- Do not force `MainActor.assumeIsolated`, `Thread.isMainThread` branches, or queue `.sync` calls to make a Swift-concurrency design compile. That is a signal to choose a queue-based design or change the API boundary.
- Do not call `DispatchQueue.sync`, `DispatchQueue.main.sync`, or equivalent synchronous queue hops. Treat them as bugs, especially in property getters and setters.
- Use `DispatchQueue.async` or a Nitro `Promise` method for queue-bound work that callers must wait for.
- Treat locks as a last-resort synchronization primitive, not a default safety wrapper. Before adding `NSLock`, identify the concrete shared mutable values, the threads/queues that can access them concurrently, and why ownership by `MainActor`, a serial queue, a Nitro runtime/thread, or immutable snapshots is not enough.
- Swift `Array` and `Dictionary` mutations are not thread-safe. If listener add/remove can race with native delegate emission, either serialize every access on one owner queue/thread, or use a tiny lock only to mutate and snapshot the listener registry.
- Never hold a lock while invoking callbacks, calling into JS/Nitro, or calling unknown user code. Snapshot listeners under the lock, unlock, then call them. A listener removed during an in-flight emission may receive that current event; that is acceptable cleanup semantics and does not justify heavier locking.

## Properties and Threading

- Use properties only for cheap observed state that can be read or written immediately and safely.
- Do not hide a thread hop, hardware/session query, lock wait, permission check, allocation, or fallible native operation behind a property.
- If a value can only be observed from a specific queue, prefer an event/listener emitted from that queue.
- If a caller truly needs a one-shot read from another queue, expose an async getter method instead of a property.
- In Nitro Modules, represent queue-bound reads and writes as `Promise<T>` methods, usually with `Promise.parallel(queue)`.

```swift
// Avoid: synchronous queue hop hidden in a getter.
var status: SessionStatus {
  queue.sync { session.status }
}

// Prefer: make the async boundary explicit.
func getStatus() throws -> Promise<SessionStatus> {
  return Promise.parallel(queue) {
    return self.session.status
  }
}
```

## Swift Style

- Make classes `final` by default unless subclassing is part of the design.
- Prefer Swift-native types such as `String`, `Array`, `Dictionary`, structs, protocols, and Foundation value types. Avoid Objective-C bridge types unless an Apple API requires them.
- Use `guard` to validate input and state early. Throw specific errors for user-reachable failures.
- Treat a filename as a scope contract. `HybridDataScanner.swift` should implement `HybridDataScanner`; it should not also contain extensions, conversions, `UIViewController` helpers, delegates, or framework adapters.
- Keep one top-level implementation type per file. Do not put secondary structs, classes, enums, protocols, option adapters, coordinators, delegates, or helper types below the primary type. If a helper deserves a type, it deserves its own file.
- Keep one focused extension/conversion per file. Do not collect multiple extensions in one utility file. Put reusable extensions in named files such as `Extensions/UIViewController+topPresentedViewController.swift`, `Extensions/CGPoint+Point.swift`, or `Extensions/Barcode+toScannedCode.swift` with `internal` or `package` visibility where appropriate.
- Never put Swift extensions inside `Hybrid*` implementation files or other primary implementation files, even when the extension is private, tiny, or only used by that file. Put every extension in a separate named `Type+operation.swift` extension/converter file so code splitting, maintainability, and future diffs stay clean.
- Split delegates, framework adapters, converters, native protocols, and helper state into separate files instead of adding them below the main type.
- Extract native preflight checks and platform boilerplate out of `Hybrid*` factories and implementation methods. Permission/status switches, `Bundle.main.object(forInfoDictionaryKey:)` checks, hardware capability checks, Info.plist validation, and similar setup guards belong in focused helper/extension files such as `AVCaptureDevice+CameraAuthorization.swift` or `Bundle+CameraUsageDescription.swift`; the factory call site should stay one or two lines.
- Keep `Hybrid*Factory.swift` as orchestration only: resolve generated options, call preflight helpers, create/start the native session, and return/reject the Promise. Do not define session/coordinator/delegate classes, `Native*Options` adapters, presenter traversal helpers, scanner configuration builders, barcode mappings, permission switches, or Info.plist checks in the factory file.
- If a `Hybrid*` method grows a switch over Apple authorization/status, a multi-line guard for platform setup, view-controller lookup logic, `DataScannerViewController` configuration, or conversion loops, extract it before continuing. The caller should read as a short sequence of named operations, not as the implementation of each operation.
- Do not create broad `Utils.swift` files for these helpers. Name the file after the platform type or domain check and keep each helper focused on one check or conversion.
- Use line count as a review signal: files below roughly 300 lines are usually fine only after the one-type-per-file and no-helpers-in-factory rules are satisfied. Size caused by extensions, conversions, helper types, or platform glue is a design issue.
- Prefer inline shorthand for unambiguous single-expression closures: `targetFormats.flatMap { $0.toVNBarcodeFormat() }`, not a multi-line `flatMap { format in format.toVNBarcodeFormat() }`. Do not use `$0` when a surrounding or nested closure already uses shorthand arguments; name parameters in nested closures or when clarity needs it.
- Put conversions on the element type, not on arrays, when the conversion only reads one element. The element method may still return multiple values; compose callers with `map`, `flatMap`, `reduce`, or `Set(...)`.
- Do not put domain conversions on broad/common receivers such as `Int`, `String`, `Double`, `Any`, `CGPoint`, or `CGRect` unless the conversion is genuinely about that type. Prefer the domain type direction, such as `BarcodeFormat.from(format:)` or `BarcodeFormat(nativeFormat:)`, over `Int.toBarcodeFormat()`.
- Add `Array` or `Collection` extensions only when the collection has real domain behavior, such as validation across elements, deduplication, ordering, batching, caching, nonempty checks, or error aggregation. If the receiver is a concrete `[SomeDomainType]` and the body mostly saves one `map`, keep that map in caller code.
- Break meaningful conversions into named intermediate values instead of long inline expressions.

## Nitro Notes

- Use `Promise.parallel(queue)` for DispatchQueue-based work such as AVFoundation session operations.
- Use `Promise.async` only when wrapping Swift `async`/`await` or Task-native APIs end to end.
- Avoid manually creating or passing around `Promise<T>` instances. Prefer `Promise.parallel`, `Promise.async`, `Promise.resolved`, and `Promise.rejected`; use a manual Promise only for real native completion/delegate/callback bridges and keep it in the smallest scope with exactly-once completion.
- Do not mix `Promise.async` with queue `.sync` calls or actor escape hatches.
- Generated HybridObject properties are synchronous entry points. Redesign them as methods or listeners if they need queue affinity.
