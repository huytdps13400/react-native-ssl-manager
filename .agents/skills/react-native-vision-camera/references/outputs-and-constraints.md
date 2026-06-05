# Outputs, Constraints, Devices, and Session lifecycle

The three ideas that define v5:

1. **Outputs are first-class objects.** A Camera is "idle" until outputs are attached. Each output (Photo, Video, Frame, Depth, Preview, Object) is a `HybridObject` created upfront, passed via `outputs={[...]}`, and owns its own capture methods.
2. **Constraints are negotiated declarations of intent.** You say what you want (fps, HDR, resolution bias, stabilization); the Camera picks the closest supported config. Array order = priority.
3. **There are three usage forms.** Declarative `<Camera />`, hook-driven `useCamera(...)`, and imperative `VisionCamera.createCameraSession(...)`. Pick the least powerful one that does the job.

## Outputs

| Output | Create with | Purpose |
|---|---|---|
| `CameraPhotoOutput` | `usePhotoOutput(options)` | Still capture. `capturePhoto` / `capturePhotoToFile`. |
| `CameraVideoOutput` | `useVideoOutput(options)` | Video recording. `createRecorder`. |
| `CameraFrameOutput` | `useFrameOutput({ onFrame, pixelFormat, targetResolution })` | Real-time frame streaming for ML / CV. |
| `CameraDepthFrameOutput` | `useDepthOutput({ onDepth })` | Depth streams from LiDAR / ToF / disparity virtual cameras. |
| `CameraPreviewOutput` | `usePreviewOutput()` | Manual preview via `<NativePreviewView />` (multi-cam). |
| `CameraObjectOutput` (iOS only) | `useObjectOutput({ types, onObjectsScanned })` | Native QR/face/body detection via `AVCaptureMetadataOutput`, no ML dep. |
| Barcode output (separate package) | `useBarcodeScannerOutput(...)` | MLKit barcode detection on both platforms. |

Key rules:

- Attach all outputs you want to use at once — swapping outputs at runtime causes a brief reconfiguration pause.
- **Fewer outputs = higher negotiated resolution.** 8K photo on iOS is only reachable with photo-only output sets.
- Each output has its own `targetResolution`. Set it to the smallest resolution the consumer actually needs (e.g. your ML model wants 128×128 → don't stream 4K frames to dispose of 99% of pixels).
- Use the `onConfigured` callback (on the Camera or session) to gate work that depends on the output being ready.

### Hook vs imperative creation

```tsx
// Hook (declarative + useCamera)
const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.UHD_16_9 })
const videoOutput = useVideoOutput({ enableAudio: true })

<Camera device="back" isActive={true} outputs={[photoOutput, videoOutput]} />

// Or:
const camera = useCamera({
  device,
  outputs: [photoOutput, videoOutput],
  constraints: [{ fps: 30 }],
  isActive: true,
})
```

```ts
// Imperative — full control, required for multi-cam
const session = await VisionCamera.createCameraSession(/* isMultiCam */ false)
const device = await getDefaultCameraDevice('back')
const photoOutput = VisionCamera.createPhotoOutput({})

const [controller] = await session.configure([{
  input: device,
  outputs: [{ output: photoOutput, mirrorMode: 'auto' }],
  constraints: [{ fps: 30 }],
}], {})

await session.start()
// ... later:
await session.stop()
await session.dispose()
```

## Constraints

The Constraints API replaces the entire v4 formats system. You never pick a `CameraDeviceFormat` by hand again.

### Principles

- **Array order = priority, descending.** The first constraint is the one the Camera will bend least to satisfy.
- **Always succeeds.** `{ fps: 99999 }` resolves to the highest supported FPS. Constraints never throw for unreachable combos.
- **Probe with `isSessionConfigSupported(config)`** when you want to conditionally show UI (e.g. only render an HDR toggle on devices that can actually do HDR at the requested resolution).
- **Observe the chosen config** via `onSessionConfigSelected={(config) => ...}` or by reading `config` returned from `resolveConstraints`.

### Constraint types

```ts
// FPS
{ fps: 60 }

// Photo HDR (3-frame fusion at ISP)
{ photoHDR: true }

// Video HDR / Log
{ videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' } }
// Shortcut:
{ videoDynamicRange: CommonDynamicRanges.ANY_HDR }
// Apple Log: colorSpace: 'apple-log'

// Stabilization
{ videoStabilizationMode: 'cinematic-extended' }
{ previewStabilizationMode: 'standard' }

// Pixel format (frame output)
{ pixelFormat: 'yuv-420-8-bit-full' }

// Resolution — prefer an output-driven bias over pixel dimensions
{ resolutionBias: photoOutput }

// Binned sensor readout — bigger effective pixels, better low-light, less bandwidth
{ binned: true }
```

### Common recipes

Photo-first tuning (highest-res photos, still a usable preview/video path):

```ts
constraints={[
  { resolutionBias: photoOutput },
  { photoHDR: true },
  { resolutionBias: videoOutput },
]}
```

High-FPS video (60fps wins over resolution):

```ts
constraints={[
  { fps: 60 },
  { resolutionBias: videoOutput },
]}
```

Low-resolution frame stream for ML:

```ts
const frameOutput = useFrameOutput({ targetResolution: CommonResolutions.VGA_16_9, onFrame })
constraints={[{ resolutionBias: frameOutput }]}
```

10-bit HLG video:

```ts
constraints={[{ videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' } }]}
```

### Programmatic resolution

```ts
const config = await resolveConstraints(
  device,
  [{ output: videoOutput, mirrorMode: 'auto' }],
  [{ resolutionBias: videoOutput }, { fps: 60 }],
)
const ok = await isSessionConfigSupported(device, config)
```

## Devices

- `useCameraDevice('back')` / `useCameraDevice('front')` / `useCameraDevice('external')` — most common.
- `useCameraDevices()` for reactive listings (e.g. UVC plug/unplug).
- Filter by physical types when you need a simpler pipeline (faster startup):
  ```tsx
  const device = useCameraDevice('back', { physicalDevices: ['wide-angle'] })
  ```
  vs. a `'triple'` virtual device that switches across ultra-wide / wide / telephoto.
- Probe capabilities upfront: `device.getSupportedResolutions('photo')`, `device.supportedFPSRanges`, `device.supportedPixelFormats`, `device.supportsPhotoHDR`, `device.supportsVideoStabilizationMode('cinematic')`, `device.supportsExposureBias`, `device.supportsFocusMetering`, `device.supportsFocusLocking`, `device.supportsMultiCamSessions`, `device.zoomLensSwitchFactors`.
- External cameras (iPad/Mac/UVC on Android) use `'external'` and emit change notifications: `addOnCameraDevicesChangedListener`.

## Session lifecycle

Three states:

1. **Idle** — no connections, not running.
2. **Ready** — configured with outputs but not streaming. Memory + permissions still held.
3. **Active** — streaming.

Toggle between Ready and Active with `isActive`. Do **not** toggle between Idle and Ready by mounting/unmounting — that tears down and rebuilds the whole session.

```tsx
import { useIsFocused } from '@react-navigation/native'

function Screen() {
  const isFocused = useIsFocused()
  return <Camera isActive={isFocused} /* ... */ />
}
```

Interruptions (phone calls, thermal throttle, another app grabbing the camera):

```tsx
<Camera
  onInterruptionStarted={(reason) => {}}
  onInterruptionEnded={() => {}}
  onError={(error) => {}}
/>
```

Reconfiguration cost: changing `outputs`, `device`, or `constraints` pauses briefly while the session rebuilds. Batch changes and avoid changing them in render loops. The docs guide explicitly says: *"ensure that most configuration is handled before you start the session, as any configuration while the session is running can be expensive and cause stutters."*

## Performance cheatsheet

- Prefer single-physical-device cameras (`'wide-angle'` only) over virtual multi-device cameras when you don't need seamless zoom switching — faster startup.
- Disable features you don't need: video HDR, stabilization, unneeded outputs.
- YUV > RGB for frame output. The native format is YUV; RGB forces conversion per frame.
- Match FPS and resolution to the consumer. 30fps is sufficient for 99% of recording; 60/120/240 only when the UX demands it.
- Binned formats (`{ binned: true }`) for better low-light and lower bandwidth when fine detail is not needed.
- For rapid photo bursts: `qualityPrioritization: 'speed'` on the photo output options or per capture. For instant capture with zero shutter lag, use `takeSnapshot()` via the Camera ref.
- Don't rotate buffers in the pipeline — handle orientation downstream with flags.

## Pointers

- Docs — Camera Outputs: https://visioncamera.margelo.com/docs/camera-outputs
- Docs — Constraints: https://visioncamera.margelo.com/docs/constraints
- Docs — Photo Output: https://visioncamera.margelo.com/docs/photo-output
- Docs — Depth Output: https://visioncamera.margelo.com/docs/depth-output
- Docs — Object Output: https://visioncamera.margelo.com/docs/object-output
- Docs — Async Frame Processing: https://visioncamera.margelo.com/docs/async-frame-processing
- API — `Constraint` type: https://visioncamera.margelo.com/api/react-native-vision-camera/type-aliases/Constraint
- API — `CameraPhotoOutput`: https://visioncamera.margelo.com/api/react-native-vision-camera/hybrid-objects/CameraPhotoOutput
- Related: [capture-and-controls.md](./capture-and-controls.md), [frame-processors.md](./frame-processors.md), [advanced-features.md](./advanced-features.md), [quickstart-v5.md](./quickstart-v5.md)
