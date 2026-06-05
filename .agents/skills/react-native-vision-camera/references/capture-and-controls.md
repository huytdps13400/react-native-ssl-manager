# Capture & Controls

All the user-facing "camera app" behavior: taking photos, recording video, zoom, focus, exposure, and manual 3A locks.

## Taking photos

### Default path — in-memory

```tsx
const photoOutput = usePhotoOutput({
  previewImageTargetSize: { width: 150, height: 150 }, // optional thumbnail
  qualityPrioritization: 'balanced',
})

const photo = await photoOutput.capturePhoto(
  {
    flashMode: 'auto',           // 'on' | 'off' | 'auto'
    enableRedEyeReduction: true,
    enableShutterSound: false,
    qualityPrioritization: 'quality', // override the output-level setting per capture
    // location: locationFromReact-native-vision-camera-location
  },
  {
    onWillBeginCapture: () => {},
    onWillCapturePhoto: () => {},
    onDidCapturePhoto: () => {},
    onPreviewImageAvailable: (image) => {
      // Fire-and-forget thumbnail for instant UX — often arrives before the full Photo resolves
    },
  },
)

// photo: Photo (hybrid object, in-memory)
//   photo.width / photo.height / photo.orientation / photo.isMirrored
//   photo.timestamp / photo.isRawPhoto / photo.containerFormat / photo.hasPixelBuffer
//   photo.calibrationData?  (CameraCalibrationData, when available)
//   photo.depth?            (Depth, when captured with depth enabled)
//   photo.getPixelBuffer()               // ArrayBuffer
//   photo.getFileData() / photo.getFileDataAsync()  // encoded + EXIF bytes
//   photo.toImage() / await photo.toImageAsync()    // -> Image (react-native-nitro-image)
//   await photo.saveToTemporaryFileAsync() // -> file path, .dng if RAW
//   await photo.saveToFileAsync(path)      // write to a specific path
```

### File path — if you really need it

```tsx
const { filePath } = await photoOutput.capturePhotoToFile({ flashMode: 'on' }, {})
```

### `takeSnapshot` — zero-shutter-lag preview grab (Android only)

On the Camera ref, `takeSnapshot({ quality: 90 })` grabs the latest preview buffer and JPEG-encodes it synchronously. Lower fidelity than `capturePhoto`, but instant. Good for burst / scanner UIs where the user can't tell the difference. This is Android only.

### RAW

```tsx
const photoOutput = usePhotoOutput({
  containerFormat: 'dng',  // triggers RAW negotiation
})

// On supported Apple devices this may become Apple ProRAW automatically.
const photo = await photoOutput.capturePhoto({}, {})
const path = await photo.saveToTemporaryFileAsync()   // .dng file
const pixels = photo.getPixelBuffer()                 // raw pixel data when available
```

Verify via `isSessionConfigSupported(...)` before exposing a RAW toggle. Preview image callbacks are especially important here because RAW write latency is high.

### HDR

Photo HDR fuses an under/normal/over exposure at the ISP:

```tsx
<Camera constraints={[{ photoHDR: true }]} />
```

Alternative on Android: a vendor `CameraExtension` may provide an `'hdr'` extension:

```ts
const hdrExtension = extensions.find((e) => e.type === 'hdr')
<Camera cameraExtension={hdrExtension} />
```

## Recording video

```tsx
const videoOutput = useVideoOutput({
  enableAudio: true,
  enablePersistentRecorder: false, // true = survives device switching, costs some overhead
})

<Camera outputs={[videoOutput]} /* + photoOutput if you want both */ />
```

```tsx
// A Recorder is single-use. Always create a new one per recording.
const recorder = await videoOutput.createRecorder({
  // settings: codec, bitrate, container, audio, location...
})

await recorder.startRecording(
  (filePath, reason) => console.log('finished:', filePath, reason), // reason: 'stopped' | 'max-duration-reached' | 'max-file-size-reached'
  (err) => console.error('error:', err),
  () => console.log('paused'),
  () => console.log('resumed'),
)

// Progress polling
const interval = setInterval(() => {
  console.log(recorder.recordedFileSize, recorder.isRecording, recorder.isPaused, recorder.filePath)
}, 500)

await recorder.pauseRecording()
await recorder.resumeRecording()
await recorder.stopRecording()    // resolves immediately; onFinished fires after flush
// or:
await recorder.cancelRecording()  // deletes the partial file
```

### Video HDR / Log

```tsx
<Camera constraints={[{
  videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' }
}]} />
// Apple Log: colorSpace: 'apple-log'
```

Bit depths: `'sdr-8-bit'` (default) vs `'hdr-10-bit'`. Color spaces: `'srgb'`, `'hlg-bt2020'`, `'apple-log'`. Probe support with `isSessionConfigSupported`.

### Stabilization

```tsx
<Camera constraints={[{ videoStabilizationMode: 'cinematic-extended' }]} />
```

Introduces startup latency and adds post-stop flush time — disable for shutter-speed-sensitive UX.

## Zoom

```tsx
import { useSharedValue } from 'react-native-reanimated'

const zoom = useSharedValue(1) // 1 = natural default
<Camera zoom={zoom} enableNativeZoomGesture={true} device={device} /* ... */ />

// Clamp manually if you drive zoom from your own gesture:
const clamped = Math.min(Math.max(value, device.minZoom), device.maxZoom)

// Imperative:
await controller.setZoom(3)
await controller.startZoomAnimation(5, 2)  // zoom to 5x over 2s
await controller.cancelZoomAnimation()

// Virtual-device switch points (e.g. 0.5x ↔ 1x ↔ 3x):
device.zoomLensSwitchFactors
// User-facing display value:
controller.displayableZoomFactor
```

## Tap to focus / focusTo

Simple path — the native gesture does it all:

```tsx
<Camera enableNativeTapToFocusGesture={true} />
```

Custom gesture → `CameraRef`:

```tsx
const onTap = async ({ x, y }: { x: number, y: number }) => {
  await camera.current?.focusTo({ x, y }) // view-point → camera-point is handled for you
}
```

Full control → `CameraController`:

```ts
const point = previewView.createMeteringPoint(viewX, viewY)
// or normalized directly:
const point = VisionCamera.createNormalizedMeteringPoint(0.5, 0.5)

await controller.focusTo(point, {
  modes: ['AE', 'AF'],            // default is all three ['AE','AF','AWB']
  adaptiveness: 'locked',          // 'continuous' (default) keeps adjusting as scene changes
  autoResetAfter: 10,              // seconds; pass null to disable
  responsiveness: 'steady',        // 'snappy' (default) — steady is better for video
})

await controller.resetFocus() // return to center-based metering
```

`focusTo` works in `<SkiaCamera />` in v5 (did not in v4).

## Exposure bias

```tsx
import { useSharedValue } from 'react-native-reanimated'

const exposure = useSharedValue(0) // 0 = neutral
<Camera exposure={exposure} /* ... */ />

// Imperative:
if (device.supportsExposureBias) {
  await controller.setExposureBias(clamp(v, device.minExposureBias, device.maxExposureBias))
}
console.log(controller.exposureBias)
```

## Manual AE / AF / AWB lock (pro controls)

New in v5 — no v4 equivalent:

```ts
// Exposure: lock to fixed duration (seconds) + ISO
await controller.setExposureLocked(duration, iso)
await controller.lockCurrentExposure()   // freeze whatever auto-exposure chose

// Focus: lens position 0..1
await controller.setFocusLocked(0.3)
await controller.lockCurrentFocus()

// White balance: temperature (K) + tint, or RGB gains
await controller.setWhiteBalanceLocked({ temperature: 5500, tint: 0 })
await controller.setWhiteBalanceLocked({ redGain: 1.0, greenGain: 0.1, blueGain: 0.1 })
await controller.lockCurrentWhiteBalance()

// Back to auto:
await controller.resetFocus()
```

Typical temperature range 2500K–8000K; tint −150..150; lens position 0..1. Always gate on device support (`device.supportsExposureLock`, etc).

## Orientation

```tsx
<Camera orientationSource="device" /* or 'interface' or 'custom' */ />
```

- `'interface'` — rotates only when UI rotates (Snapchat-style).
- `'device'` — rotates with the phone regardless of UI orientation (stock camera app).
- `'custom'` — you drive `CameraOutput.outputOrientation` yourself.

Output orientation is applied via EXIF for photos, mp4/mov metadata for videos, view transform for preview. Frames expose raw `frame.orientation` — interpret it yourself in the processor.

## Photo preview image (thumbnail for instant UX)

```tsx
const photoOutput = usePhotoOutput({
  previewImageTargetSize: { width: 100, height: 150 },
})
await photoOutput.capturePhoto({}, {
  onPreviewImageAvailable: (image) => {
    // show this thumbnail immediately — the full Photo is usually ~100ms behind
  }
})
```

Gate on `device.supportsPreviewImage`.

## Performance knobs (capture side)

- `qualityPrioritization: 'speed'` for burst / instant UX; `'quality'` for hero shots.
- `takeSnapshot({ quality })` for true zero-shutter-lag preview grabs.
- Disable Video HDR & stabilization when not needed — both add latency.
- Prefer in-memory `capturePhoto` over `capturePhotoToFile` unless the consumer actually wants a file (e.g. sharing intent).
- Pre-create the photo output once, not per-shot.

## Pointers

- Docs — Photo Output: https://visioncamera.margelo.com/docs/photo-output
- API — `Photo`: https://visioncamera.margelo.com/api/react-native-vision-camera/hybrid-objects/Photo
- API — `CameraPhotoOutput`: https://visioncamera.margelo.com/api/react-native-vision-camera/hybrid-objects/CameraPhotoOutput
- API — `CapturePhotoCallbacks`: https://visioncamera.margelo.com/api/react-native-vision-camera/interfaces/CapturePhotoCallbacks
- Repo: https://github.com/mrousavy/react-native-vision-camera
- Related: [outputs-and-constraints.md](./outputs-and-constraints.md), [advanced-features.md](./advanced-features.md) (RAW/HDR/location EXIF), [frame-processors.md](./frame-processors.md), [quickstart-v5.md](./quickstart-v5.md)
