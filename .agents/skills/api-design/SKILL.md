---
name: api-design
description: Design and review predictable public APIs for TypeScript, JavaScript, React, and React Native libraries. Use when shaping exported functions, classes, hooks, options objects, event and listener APIs, error behavior, naming, cross-platform abstractions, or JS-only packages. Pair with build-nitro-modules when the library is backed by Nitro.
---

# API Design

Use this skill before implementation or when reviewing a public API surface. Target explicit types, stable semantics, and no irrelevant internals in the public contract.

If the library is a Nitro Module, use this skill for the public TypeScript and React API shape first, then use `build-nitro-modules` for Nitro-specific spec, native-state, and binding constraints. If the library is JS-only, React-only, or React Native JS-only, stay in this skill.

## Workflow

1. Sketch the user-facing TypeScript API before implementing internals.
2. Write 2-3 realistic call-site examples, including error and cleanup paths.
3. Check the surface against the rules below.
4. Verify the exported TypeScript with the repo's typecheck/lint/docs tooling before treating the API as done.
5. Implement only after the public shape is coherent and verified.

## API Freshness

Before choosing public API shape, dependency APIs, platform capabilities, or implementation strategy, verify current official sources instead of relying on trained memory. Library, React, React Native, platform, and tooling APIs evolve quickly.

- Prefer official docs, source repositories, release notes, changelogs, package READMEs, and current package metadata.
- Look for `llms.txt` or `llms-full.txt` on official docs sites when available, and use those as compact current context.
- Treat remembered API details as a starting hypothesis only. If current docs or source disagree, follow the current docs/source and mention the change when relevant.
- Avoid designing against stale blog posts, old snippets, or outdated trained assumptions when an official current source is available.

## API Shape Rules

- Prefer a single source of truth. Do not split related state across booleans and dependent values when one typed value can express the state. Prefer `timeoutMs?: number` over `enableTimeout: boolean` plus `timeoutMs?: number`.
- Use option objects or named structs once a function has 3 or more parameters, parameters of the same primitive type, or values that are likely to grow.
- Keep APIs specific instead of accepting every possible input shape. A millisecond timeout should be a `number`, not `number | string | bigint | object | null`.
- Avoid giant "does everything" objects. Split by domain or lifecycle when responsibilities differ.
- Before simplifying or redesigning an API, inventory the workflows the feature is supposed to support. Do not silently drop a workflow, such as a live session API, because a one-shot path is easier to implement. Split workflows into separate APIs when needed.
- Prefer literal unions, discriminated unions, interfaces, and typed option groups when the valid states are known. In TypeScript libraries, prefer string literal unions over runtime `enum`s unless consumers need a runtime value.
- Avoid untyped dictionaries, boolean clusters, stringly typed commands, and loosely shaped events when the valid states are known.
- Do not model a binary option as an optional two-case string union such as `'enabled' | 'disabled'`. If omitted means "use the default" and provided means true/false, use an optional boolean and document the default.
- Do not represent multiple object states as one interface full of optional fields. Use a discriminated union, inheritance, or separate variant interfaces so impossible field combinations are unrepresentable.
- Keep related fields together on the variant where they are required. If `barcode` and `barcodeType` only make sense together, both should be nonoptional on `ScannedBarcode`, not optional on a generic `ScannedData`.
- If you create variant interfaces, use them in the actual public type. Do not define `RecognizedTextDataType` and `RecognizedBarcodeDataType` but keep `recognizedDataTypes: RecognizedDataType[]` where `RecognizedDataType` still contains every variant field as optional.
- Use `undefined` or optional fields for absence. Use `null` only when "explicit none" means something different from "not provided".
- Prefer discriminated unions for state machines, loading states, and result variants.
- Model user intent separately from resolved state when negotiation is involved. For example, an ordered array of constraint objects can express priorities, while a resolved config object reports what the platform actually selected.
- For complex negotiation, prefer ranked constraints or preference objects over exposing a combinatorial support matrix. Let callers describe intent, resolve the closest working configuration internally, and expose the resolved configuration through a return value, callback, or explicit resolver method.
- Expose common presets as `as const satisfies Record<string, Type>` objects. Keep the accepted type structural so users can provide their own values.
- Do not expose ambient facts the caller already knows, such as a `platform` field that only repeats `Platform.OS`, unless the API can return data produced by a different platform than the current runtime.
- Do not freeze today's platform support matrix into the type shape. Prefer runtime capability fields such as `availableTextTypes: []` or `supportedFormats: []` over separate platform-specific types or static exclusions. This lets newer native capabilities become available without redesigning the JS API.
- Prefer one unified options object. Avoid `ios`/`android` option bags and platform-prefixed methods unless the concepts are genuinely platform-only and cannot be described as a cross-platform capability or no-op.
- Classify configuration fields as either requirements or preferences. Throw when a requirement cannot be met. Treat preferences as best-effort when the feature can still perform its core job, such as quality, guidance UI, high-frame-rate tracking, auto-zoom, or a wider scan area. Document best-effort fields and expose capabilities or resolved configuration when callers need to know what was applied.
- Split by stable semantic capability when capabilities have different options, results, or futures. For example, barcode scanning and text scanning may deserve separate `BarcodeScanner` and `TextScanner` APIs even when one native API happens to implement both today. A platform that lacks text scanning should fail `createTextScanner()` or report `isTextScannerAvailable: false`, not force text-specific fields to be nullable on a generic scanner used for barcode scanning.
- Runtime availability should describe whether a stable capability exists today, not permanently restrict the API shape to the current platform matrix. If Android gains text scanning later, the existing `TextScanner` capability should become available without changing barcode APIs or broadening nullable result types.
- Keep capability discovery separate from object contracts. Use capability fields to decide whether a workflow can be created or which optional preferences may apply. Once a factory returns a specific session/resource object, its baseline methods should be guaranteed by construction; otherwise return a narrower type or fail creation instead of making callers check `can*` before every normal method.
- Splitting workflows should reduce runtime capability checks. Do not keep broad capability flags only to compensate for one oversized object. For example, a one-shot scanner and an app-owned live scanner can be separate APIs; if the live scanner implementation guarantees zoom, photo capture, or region control, those can be part of the live scanner contract instead of nullable properties plus `can*` checks inherited from a one-shot backend.
- Encode lifecycle transitions in the API object graph. If commands are valid only after `configure`, `connect`, `start`, or another lifecycle transition, expose those commands on a handle returned by that transition, not on the parent object with "maybe active" checks. For example, `session.configure(device, outputs)` can return a `Controller` that owns `setZoom(...)` and `focusTo(...)`; the `Session` owns graph configuration and start/stop.
- Avoid stale-state APIs. If reconfiguration changes the native resource a command targets, return a new handle and invalidate or dispose the old one. Callers should not be able to accidentally call a command on a parent object that no longer knows which configured device/output it applies to.
- Use callbacks or returned resolved objects for post-negotiation facts. If an output, controller, or session config becomes meaningful only after connection, provide `onConfigured`, a returned controller/config, or an explicit `resolve...(...)` method rather than forcing callers to poll nullable properties.
- For Nitro-backed imperative APIs, treat the public HybridObject as the API by default. Do not add JS wrappers that pre-parse inputs, translate enum/string shapes, normalize one public format into another, or otherwise make JS call a different API than the generated Nitro spec. Put the intended public shape directly in the Nitro spec and native implementation.
- When "all" is a meaningful requested value, model it explicitly instead of using `undefined` as a hidden command. For example, prefer `targetFormats: 'all' | BarcodeFormat[]` or `TargetBarcodeFormat = BarcodeFormat | 'all'` when the implementation benefits from a concrete value.
- Do not return half-initialized objects that require a separate `prepare()`, `initialize()`, or `load()` call before normal use. If setup is required, make the factory async and resolve with a ready object. Keep lifecycle methods for real repeatable transitions such as `start()`/`stop()`, not construction readiness.
- For larger libraries, expose one small public root or factory that creates stateful domain objects. Keep object construction, async setup, I/O, and validation behind factory methods instead of forcing callers through static functions or half-ready instances.
- Return `undefined` only for normal domain absence, and document exactly when it occurs. Do not use optional returns as an unstated error path; throw or reject when an operation fails.
- Decide whether returned data is a plain value or a resource. Use plain structs/interfaces for small immutable data whose fields are cheap and semantically complete. Use classes/objects/resources when the value owns native state, needs lazy expensive access, can grow behavior, or should expose methods later.
- Choose data representations by semantics first, then performance. Use `string` for decoded text payloads. Use `ArrayBuffer` or byte-oriented objects for raw binary, opaque bytes, media, or large data where zero-copy access is part of the contract.

### Variant Example

Avoid nullable clusters when an object can be in several distinct states:

```typescript
interface ScannedData {
  position: Point
  text?: string
  barcode?: string
  barcodeType?: BarcodeType
  face?: Rect
}
```

Prefer a base type plus variants with nonoptional state-specific fields:

```typescript
interface ScannedData {
  position: Point
}

interface ScannedText extends ScannedData {
  text: string
}

interface ScannedBarcode extends ScannedData {
  barcode: string
  barcodeType: BarcodeType
}

interface ScannedFace extends ScannedData {
  face: Rect
}

type ScannedResult = ScannedText | ScannedBarcode | ScannedFace
```

## Public API Organization

- Split public surfaces into focused files or modules and re-export them from a clear package entry point. Do not create catch-all files that contain a feature's main object plus every enum, option, result, event, and helper type.
- Default to one exported public type per file. Group multiple exported types in one file only when they form one tightly coupled logical construct and are rarely imported independently, such as a `DynamicRange` type plus the exact literal unions that define it.
- Re-export public package types only from package entry points such as `src/index.ts`. Do not make feature/spec/type files re-export unrelated types from the same folder.
- Use direct re-export syntax at package entry points instead of importing just to export again. Use `export type { Foo } from './Foo'` for type-only symbols and `export { Foo } from './Foo'` for runtime values.
- Package entry points such as `src/index.ts`, `index.ts`, `index.js`, and `index.tsx` are barrels only. Do not define functions, classes, hooks, components, helper constants, branching, side effects, or implementation logic there. The only allowed runtime declaration is a simple one-line package root such as `export const camera = NitroModules.createHybridObject<Camera>('Camera')`; everything else belongs in a focused file and is re-exported.
- A 600-line type/spec file is not acceptable when the types can be split by concept, such as barcode formats, scanned values, configuration, capabilities, and subscriptions.
- Put shared fields and methods on a base interface or class. Subtypes should add only the members that are specific to that subtype, not repeat fields such as `format`, `valueType`, `id`, or `bounds` across every concrete variant.
- Put helpers and conversions on the smallest meaningful receiver: if a conversion only reads one element, put it on that element even when it returns zero, one, or many target values. Compose arrays with normal `map`, `flatMap`, `reduce`, or `Set(...)` at the call site.
- Add collection-level helpers only when the collection itself has domain semantics, such as validation across elements, deduplication, ordering guarantees, caching, batching for performance, nonempty checks, or error aggregation. Do not add a collection helper merely to hide one standard collection operation.
- Keep performance and implementation strategy out of the public shape unless it changes how the caller should use the API. For example, the API may expose an explicit conversion method, but names and docs should not advertise internal details like "lazy", "lightweight", or "normalized" unless that behavior is directly observable.

## TypeScript and JavaScript Style

- Never use `void 0` as an undefined value. Write `undefined` explicitly.
- Never use logical assignment operators such as `??=`, `||=`, or `&&=` in package/runtime code. Prefer an explicit `if` block or direct assignment so mutation and fallback behavior are obvious at the call site.

## Names and Members

- Name commands with a verb and subject. Add unit suffixes to numeric values. Prefer `getCurrentSystemTimestampMs()` over `timestamp()`.
- Name booleans by their role, not just by their type.
- Use predicate names such as `is*`, `has*`, `can*`, or `supports*` for booleans that reflect observed state, capability, or resolved configuration. Examples: `isFlashEnabled`, `isFlashAvailable`, `hasFlash`, `supportsFlash`.
- Use command or preference names such as `enable*`, `allow*`, or domain-specific verbs for boolean options that control future behavior. Examples: `enableFlash`, `allowCellularAccess`, `preferHighAccuracy`.
- In React and React Native public APIs, reserve `use*` names for hooks. Outside React contexts, `use*` can be acceptable only when it reads naturally in the local domain and cannot be confused with a hook.
- Avoid `is*Enabled` for input preferences when the feature is not enabled yet. `enableGuidance?: boolean` reads as a requested setting; `isGuidanceEnabled: boolean` reads as resolved state.
- Use properties for cheap observed state or capability. Prefer `readonly isAccelerometerAvailable: boolean` over `accelerometerAvailable()`.
- Use methods for side effects, expensive work, allocation, mutation, async boundaries, or operations that can fail.
- Make units explicit in names: `timeoutMs`, `byteSize`, `maxRetries`, `createdAt`.
- Avoid mechanically prefixing every exported type with the package, module, or feature name. Imports and package namespaces already provide context, and callers can alias names when needed. Use prefixes only when the unprefixed name is ambiguous at package-root import sites; prefer domain names like `CameraPermissionStatus`, `ScannedResultSource`, `Point`, or `Rect` over repeating `DataScanner` on every type.
- Use `readonly` for public state the caller observes but does not set. Use mutable properties only when assigning the property is itself the intended command.
- Writable properties must be cheap, synchronous, and unlikely to fail. If setting a value needs native negotiation, permissions, I/O, allocation, fallible validation, or thread/process hops, expose an explicit async method such as `setZoomFactor(zoomFactor): Promise<void>`.
- For public string literal unions, prefer lowercase kebab-case values such as `manual-input` over camelCase values such as `manualInput`.

## Async, Events, and React

- Use sync APIs when results are immediate, deterministic, cheap, and local. Do not async-wrap simple value construction, cached metadata, or pure transforms just because the implementation is native.
- Use `Promise` for one-shot async work. Use listener APIs, streams, or observable stores for repeated events.
- Use `Promise` for permissions, hardware/session setup, I/O, capture/recording, platform async APIs, blocking work, native APIs that are async already, or work that may cross a thread or process boundary. Heavy or complex work should run on an owned worker/queue/dispatcher/runtime rather than blocking the caller.
- Avoid the main/UI thread unless the underlying platform API requires it. Main-thread APIs should do only the required UI work there and move heavy setup, conversion, parsing, I/O, and computation to an owned background context.
- Do not pass Promise resolver state through arbitrary layers. Prefer returning a Promise from the async boundary and using `async`/`await`, native Promise helpers, or a small completion callback at the exact bridge point. Dangling promises and double resolution are lifecycle bugs.
- Benchmark ambiguous APIs. Make the method async when normal use can block visible UI work, waits on another thread/process, or has unpredictable runtime.
- If a transform has both cheap and potentially heavy paths, expose explicit sync and async methods such as `convertX()` and `convertXAsync()` instead of hiding blocking work behind one ambiguous method.
- Treat repeated internal thread/queue/runtime hops as an API design smell. Prefer an object that owns its execution context, or an explicit async lifecycle method that crosses into that context once. If callers need a result from another thread, expose a `Promise`, listener, stream, or returned stateful handle instead of hiding hop chains behind sync-looking methods or properties.
- Do not fix race conditions, readiness, or ordering bugs with `setTimeout`, sleeps, artificial delays, extra thread hops, or calling the same method twice. Those hide a broken lifecycle contract. Fix the state machine, expose an explicit readiness/completion event, return a configured handle, or make the operation properly async. Retries are appropriate only for external nondeterminism such as network, remote services, OS services, or hardware, and they must be bounded, cancellable, and safe to repeat.
- Use explicit listener methods with cleanup instead of writable callback properties: `addOnValueChangedListener(listener): ListenerSubscription`, not `onValueChanged?: (...) => void`.
- Inline simple listener callback parameters in method signatures. Export a named callback type only when users import it directly, the same function contract is reused across multiple APIs, or the callback has a real domain meaning beyond being a listener function.
- Listener registration must return the cleanup handle. Avoid `addListener(...): number` plus `removeListener(listenerId: number)` because caller-managed IDs are easy to leak, hard to type safely, and force hidden global/static listener tables. Prefer a flat subscription object with an idempotent `remove` function that owns the native or internal cleanup.
- For repeated observations or events, default to `addOn...Listener(callback): ListenerSubscription`. This supports multiple independent consumers and gives each caller explicit ownership of cleanup. Do not use a single `setOn...` callback slot when one caller can accidentally replace another caller's listener.
- Listener cleanup should prevent future emissions, not promise to cancel an event already being delivered from a snapshot. Do not overcomplicate the API or implementation to guarantee that a callback removed during dispatch cannot receive the current event.
- Use a `setOn...(callback | undefined)`-style API only when replacement is the intended semantic: the object has exactly one callback slot, the callback is more like configuration than event subscription, or a hot-path native pipeline cannot reasonably multiplex listeners. Document that it replaces the previous callback and that `undefined` removes it.
- Do not rely on the `Callback` or `Listener` suffix alone to communicate ownership. The `add...` vs `set...` verb and the return type should make it clear whether the callback is additive and caller-owned or a single replaceable slot.
- Use callback option objects for one-shot operation progress when callbacks belong to one method call, such as capture or upload progress callbacks.
- Do not expose native-side bookkeeping as the event contract unless it is the feature. Prefer simple observations and let JS derive app-specific diffs or state when that is cheap and clearer.
- In React or React Native libraries, provide hooks on top of a stable imperative API when the value should drive UI. Use the appropriate React primitive, such as `useEffect` for subscriptions or `useSyncExternalStore` for external state.
- Keep hooks as adapters over the imperative core, not the only way to use the library.
- For React components, wrap the imperative core instead of creating a parallel API. A component can own setup, refs, gestures, and lifecycle, while hooks expose the same lower-level objects for advanced use.
- Use stable callbacks and deterministic cleanup for subscriptions. Subscribe before lifecycle effects that can emit events when missing an event would be observable.

## Errors and Platform Differences

- Never silently swallow user-reachable errors. Do not just return, log, or no-op. Throw, reject, or emit through a dedicated error listener.
- Use real JavaScript `Error` objects for failures and error events, not custom `{ code, message }` structs, unless the API is deliberately serializing errors across a boundary that cannot preserve prototypes.
- Unsupported required capabilities or invalid inputs should throw specific errors. Name the missing capability, invalid value, valid range, or platform restriction.
- Do not throw only because one platform ignores an optional preference that another platform supports. If ignoring it does not break the user's requested outcome, degrade gracefully and let capability/resolved-state APIs show whether it took effect.
- Throw when ignoring an option would violate the user's intent, safety, privacy, or visible correctness. For example, a required flash mode should fail on hardware without flash; a best-effort quality hint can fall back.
- Mention an alternative in the error message when a real alternative exists.
- Static assertions or fatal errors are only for impossible internal states, not for states reachable from JS user code.
- For React Native, design cross-platform concepts instead of mirroring iOS and Android APIs 1:1. Avoid leaking native class names or framework details unless that low-level access is the feature.
- Keep low-level concepts explicit for GPU, zero-copy, native-resource, and hardware APIs. Do not force them into generic web-shaped names if that hides ownership, copying, sync/async behavior, thread affinity, or disposal.

## Avoid Workaround APIs

- Do not encode temporary patches, platform bugs, dependency quirks, or stale implementation details into the public API shape unless callers genuinely need to reason about them.
- Prefer fixing the root cause, using official extension points, or hiding compatibility code behind a stable domain API.
- If a workaround is unavoidable, keep it narrow and internal where possible. If it must be public, document why it exists, what issue it tracks, and when it can be removed.

## TypeScript Facades

- Avoid JS/TS facades over public Nitro HybridObjects. If callers are meant to use the imperative Nitro API, export it 1:1 as defined in the `.nitro.ts` spec and native implementation; do not wrap it to pre-parse arguments, convert strings/enums, inject hidden defaults, or alter error/lifecycle behavior.
- Use JS/TS wrappers only when they are intentionally higher-level APIs, such as React hooks, React components, ergonomic UI composition, or when the Nitro HybridObject is an internal implementation detail that does not match the user-facing mental model.
- If a JS facade changes failure behavior, defaults, lifecycle, ownership, or accepted value shapes, move that rule into the Nitro spec/native implementation unless the facade is deliberately the product API and the HybridObject is internal.
- Prefer examples that show realistic setup, cleanup, unavailable-feature behavior, and invalid inputs.

## Documentation Contracts

- Treat exported TypeScript as product documentation. Add JSDoc to every exported declaration users import, including interfaces, type aliases, string-literal unions, runtime enums, classes, HybridObjects, option objects, event objects, hooks, components, and public constants.
- Assume these comments will become API documentation through TypeDoc or a similar generator. Write them as navigable reference docs, not inline-only code notes.
- Every JSDoc `{@linkcode ...}` or `@see` target must resolve in the file where it is written. Import type-only symbols that are referenced only by docs when necessary, or link to a local symbol that is already in scope. Do not leave editor or doc-tooling squiggles just because `tsc` happens to pass.
- Do not create exported callback aliases only to attach JSDoc. Inline simple callback parameters and document the method or parameter that accepts them. Export and document a callback type only when it is intentionally part of the public API.
- Use JSDoc for semantics, lifecycle, platform behavior, defaults, and performance costs that types cannot express.
- Keep JSDoc user-facing. Do not mention native class names, framework implementation details, or current platform limitations unless the caller must know them to use the API correctly.
- Write JSDoc that explains the domain meaning, not the fact that the API is JavaScript. Avoid empty comments such as "normalized for JavaScript"; prefer concrete semantics such as "Represents the format of a barcode" or "Represents the content type of a scanned text value."
- Document every public property, including properties on options, capabilities, results, events, and HybridObjects. Short comments are fine for obvious fields, but defaults, units, availability, failure behavior, and interaction with related options belong on the property that exposes them.
- Every type-level JSDoc should connect the type to a real related API with `{@linkcode ...}` or `@see`. Use the property, method, factory, or result that exposes the type, for example `Represents the format of a {@linkcode Barcode}.` plus `@see {@linkcode Barcode.format}`. Do not invent link targets or add filler links only to satisfy this rule.
- For base interfaces or abstract concepts, describe how callers encounter the value and link concrete variants exported by the package, for example `Represents a value scanned by {@linkcode DataScanner}. Concrete values include {@linkcode ScannedTextValue} and {@linkcode ScannedBarcodeValue}.`
- Use `{@linkcode ...}` or `@see` to point to related methods, configuration objects, and capability checks instead of writing generic warnings about not assuming the current OS or platform.
- Link docs densely enough that users can click around the generated API reference: factories link to returned objects, options link to methods that consume them, result objects link to methods that produce them, events link to listener registration methods, and cleanup/disposal docs link to the API that creates the resource.
- Use `@default`, `@throws`, `@platform`, `@example`, `@see`, and `@discussion` where they clarify behavior. Link related APIs with `{@linkcode ...}`.
- Document resource ownership and cleanup explicitly. If a returned object must be disposed, say when and why.
