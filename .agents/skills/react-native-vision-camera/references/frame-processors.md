# Frame Processors — v5 (Nitro)

V5 frame processors are worklet callbacks attached to a `CameraFrameOutput`. The worklets engine is **`react-native-worklets` (Software Mansion)**, not `react-native-worklets-core`. Native plugins are **Nitro `HybridObject`s** — the v4 `FrameProcessorPlugin` subclass + `VISION_EXPORT_SWIFT_FRAME_PROCESSOR` macro is gone.

## Required dependencies

```sh
npm i react-native-vision-camera-worklets react-native-worklets
```

Do NOT install `react-native-worklets-core`. If a user reports "frame processor does nothing", check for this. Remove any `react-native-worklets-core/plugin` entry from `babel.config.js` and add `react-native-worklets/plugin` in its place (Reanimated 4 depends on `react-native-worklets` under the hood, so Expo SDK 54+ templates already include this plugin). See https://docs.swmansion.com/react-native-worklets/docs/.

## The basic shape

```tsx
import { Camera, useFrameOutput, useCameraDevice } from 'react-native-vision-camera'

const device = useCameraDevice('back')
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',           // default, fastest; 'rgb' forces conversion; 'native' = zero-conv
  targetResolution: CommonResolutions.VGA_16_9, // start small
  onFrame(frame) {
    'worklet'
    try {
      // frame.width, frame.height, frame.pixelFormat, frame.orientation, frame.timestamp
      // Call Nitro plugins here (see below).
    } finally {
      frame.dispose()
    }
  },
})

<Camera device={device} isActive={true} outputs={[frameOutput]} />
```

### Non-negotiable: `frame.dispose()`

The camera maintains a bounded GPU-backed buffer pool. A leaked frame stalls the pipeline and frames are dropped. **Always** dispose, even in error paths:

```ts
onFrame(frame) {
  'worklet'
  try { /* work */ }
  catch (e) { /* log */ }
  finally { frame.dispose() }
}
```

The same rule applies to `Depth` frames from `useDepthOutput`.

## Pixel format decision

| Format | When |
|---|---|
| `'yuv'` | Default. OpenCV, native camera pipelines, MLKit. A 4K YUV frame is ~12MB vs ~31MB RGB. |
| `'rgb'` | ML frameworks that hard-require RGB and don't convert internally. Prefer using the GPU **Resizer** instead of paying RGB conversion on every frame. |
| `'native'` | GPU pipelines (Metal/Vulkan) that accept the native format. Verify actual format via `frame.pixelFormat`. |

## Async frame work (backpressure)

Any processing that can't keep up with the capture rate must run on an `AsyncRunner`:

```tsx
import { useAsyncRunner } from 'react-native-vision-camera'

const asyncRunner = useAsyncRunner()
const frameOutput = useFrameOutput({
  onFrame(frame) {
    'worklet'
    const accepted = asyncRunner.runAsync(() => {
      'worklet'
      try {
        const detections = runMlModel(frame)
        // update Reanimated SharedValues directly — no runOnJS needed in v5
        detectionsShared.value = detections
      } finally {
        frame.dispose()
      }
    })
    if (!accepted) frame.dispose() // runner full; drop and keep camera flowing
  },
})
```

- `runAsync` returns `boolean`. `true` = accepted, dispose **inside** the async callback. `false` = busy, dispose **immediately**.
- There is no `runAtTargetFps` in v5. Throttle by counting inside the worklet (`count.value = (count.value + 1) % 3`) and skipping, or rely on backpressure through the async runner.
- Each `useAsyncRunner()` gets its own dedicated worklet runtime. Multiple stages → multiple runners.

## Reanimated integration

Worklets in v5 can mutate Reanimated `SharedValue`s directly. No `runOnJS` round-trip:

```tsx
import { useSharedValue } from 'react-native-reanimated'

const faces = useSharedValue<Face[]>([])

const frameOutput = useFrameOutput({
  onFrame(frame) {
    'worklet'
    try {
      faces.value = detectFaces(frame) // drives Reanimated animations on UI thread
    } finally { frame.dispose() }
  },
})
```

For overlays (bounding boxes, face meshes), combine with coordinate-system conversions — see below.

## Coordinate conversions for overlays

Frames stream in native sensor orientation and mirroring, not preview-view space. To draw a bounding box from frame-space onto the preview:

```ts
// Inside a worklet:
const cameraPoint = frame.convertFramePointToCameraPoint(framePoint)
// Inside a regular JS context (with a PreviewViewMethods ref):
const viewPoint = previewView.convertCameraPointToViewPoint(cameraPoint)

// ScannedObject convenience:
const viewObj = previewView.convertScannedObjectCoordinatesToViewCoordinates(scannedObject)
```

## Creating native plugins — Nitro only
Native Frame processor plugin requires to be created in nitro modules. Use build-nitro-modules skill or ask user to install that

### C++ cross-platform plugin

Also supported. Access the underlying buffer via `frame.getNativeBuffer()` and work against a single C++ codebase.

### Depth variant

Same pattern: accept a `Depth` in the spec, cast to `NativeDepth` to get `AVDepthData` / Android's depth representation.

## Best-practice checklist

- [ ] `pixelFormat: 'yuv'` unless you have a specific reason otherwise.
- [ ] `targetResolution` on the frame output — smaller is faster. VGA or 720p is enough for most ML models.
- [ ] Every `onFrame` wrapped in `try { ... } finally { frame.dispose() }`.
- [ ] Heavy work via `useAsyncRunner` + explicit accepted/rejected disposal.
- [ ] No `runOnJS` for Reanimated `SharedValue` mutations (v5 supports direct mutation).
- [ ] For ML: add `react-native-vision-camera-resizer` to do GPU-accelerated YUV→RGB + resize into a tensor. Don't do that on the CPU.
- [ ] For coordinate-space math: use the `convertFramePointToCameraPoint` / `convertCameraPointToViewPoint` pair — don't re-implement orientation math.
- [ ] Native plugin: must be a Nitro `HybridObject`; there is no other supported path in v5.

## Pointers

- Docs — Async Frame Processing: https://visioncamera.margelo.com/docs/async-frame-processing
- API — `Frame`: https://visioncamera.margelo.com/api/react-native-vision-camera/hybrid-objects/Frame
- Worklets (SWM, babel plugin `react-native-worklets/plugin`): https://docs.swmansion.com/react-native-worklets/docs/
- Repo: https://github.com/mrousavy/react-native-vision-camera
- Nitro scaffolding: use the `build-nitro-modules` skill.
- Related: [advanced-features.md](./advanced-features.md) (Depth, Resizer, Barcode, SkiaCamera), [outputs-and-constraints.md](./outputs-and-constraints.md), [capture-and-controls.md](./capture-and-controls.md), [migration-v4-to-v5.md](./migration-v4-to-v5.md)
