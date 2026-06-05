---
name: cpp
description: Design, implement, and review modern C++ APIs and native implementation code. Use when working on .cpp, .hpp, CMake, RAII ownership, std::variant, callbacks, async work, platform bridges, or C++-backed React Native Nitro Module implementations.
---

# C++

Use this skill for C++ code that needs clear ownership, strong type modeling, maintainable file boundaries, and predictable native integration. When the code is part of a Nitro Module, pair this with `build-nitro-modules` for generated specs, Promise mapping, CMake, and HybridObject constraints.

## Workflow

1. Read the generated headers, public API shape, and local ownership patterns before editing.
2. Model valid states with types before implementing behavior.
3. Keep headers small and stable; push implementation details into `.cpp` files.
4. Split helpers by responsibility instead of growing a primary implementation file.
5. Make ownership, lifetime, threading, and async boundaries explicit.

## Type-Safe API Design

- Represent state variants with `std::variant`, inheritance, or separate concrete types. Do not encode variants as one struct with many `std::optional` fields.
- Keep related values nonoptional on the variant where they are valid. If `barcode` and `barcodeType` must exist together, put both on `ScannedBarcode`.
- Use `std::optional` for real domain absence inside one state, not for "maybe this object is a different kind of thing".
- Prefer compile-time flow over caller-side optional probing.

## File Organization

- Treat a filename as a scope contract. `HybridDataScanner.cpp` should implement `HybridDataScanner`; it should not also define unrelated geometry conversions, UI helpers, platform adapters, or extension-style utilities.
- Keep one primary class, struct family, or cohesive algorithm per file by default. Split delegates, adapters, converters, platform shims, and reusable helpers into named files such as `GeometryConversions.cpp`, `DataScannerDelegate.cpp`, or `PlatformViewController.cpp`.
- Put private helpers in an anonymous namespace only when they are small and only serve the file's primary type. Move reusable or bulky helpers to a separate file under a `detail` namespace or an internal folder.
- Use line count as a review signal: files below roughly 300 lines are usually fine; files above that need a clear reason tied to one cohesive responsibility. Size caused by unrelated helpers, conversions, or platform glue is a design issue.
- Do not hide large implementation bodies in headers. Use headers for declarations, templates that must be visible, and small inline functions only.
- Put conversions on the element type or as a named converter function for one element when the conversion only reads one element. The one-element converter may still return multiple values; compose callers with standard loops, `std::transform`, insertion into a set, or `std::accumulate`.
- Add collection-level helpers only when the collection has real domain behavior, such as validation across elements, deduplication, ordering, batching, caching, nonempty checks, or error aggregation.

## Ownership and Async

- Prefer RAII and explicit ownership with values, `std::unique_ptr`, and `std::shared_ptr` only when shared lifetime is real.
- Avoid raw owning pointers. Raw pointers and references should be non-owning and documented by surrounding lifetime.
- Use `std::variant`, `std::optional`, and strong structs to express API flow instead of stringly typed states.
- Keep quick, deterministic, local work synchronous. Do not introduce executors, promises, or callback plumbing for simple value construction, cached metadata, or pure transforms.
- Do not block caller threads for I/O, long CPU work, or platform callbacks. Use the project's async abstraction, an owned executor/thread, or Nitro `Promise<T>` when the operation can wait.
- Avoid platform main/UI threads unless the platform API requires them. Keep main-thread blocks small and move parsing, conversion, I/O, session negotiation, and CPU work to an owned executor/thread or async API.
- Keep thread-affine state behind a clear owner. Do not mix mutexes, queues, callbacks, and shared ownership without a documented boundary.
- Treat repeated executor, queue, thread, or callback hops as an architecture smell. A component should either own the executor/thread it works on, or cross into that owner once at the public async boundary or native callback boundary.
- If a workflow bounces between platform, worker, JS/Nitro, and callback threads in multiple nested places, stop and redesign the object/lifecycle/API. Excessive hops hide latency, make ordering harder to reason about, and create future performance problems.
- Do not fix races or readiness bugs with `sleep_for`, `usleep`, timers, extra executor hops, or calling the same method twice. Fix ownership, the state machine, lifecycle event, callback contract, or async boundary instead. Retry only for external nondeterminism such as hardware, OS services, remote services, or network, and keep retries bounded, cancellable, and idempotent.
- Treat `std::mutex` as last-resort synchronization, not default listener or callback plumbing. Before adding one, identify the exact shared mutable values, concurrent callers, and why one owner thread/queue, immutable snapshots, or message passing is not enough.
- Never hold a mutex while invoking callbacks, crossing into JS/Nitro, calling platform APIs with unknown reentrancy, or calling user-provided code. Copy/snapshot the data needed for dispatch, unlock, then call out.

## Nitro Notes

- C++ HybridObjects must inherit from the generated `Hybrid*Spec` class and copy generated signatures exactly.
- Use `std::shared_ptr<Promise<T>>` for generated async methods.
- Keep generated-spec implementation files focused on the HybridObject. Put conversion helpers, OpenCV utilities, platform adapters, and CMake-only glue in separate files.
- Pair JS-facing base HybridObjects with native interfaces or adapter classes when C++ needs to work with Swift/Kotlin-backed platform services.
