# Migration guide — VisionCamera v4 → v5

V5 is a ground-up Nitro rewrite. Do not try to incrementally upgrade — most surfaces are renamed or replaced. Treat this as a port. Work through the changes below in order; each step is independent of the next and can land in its own commit.

## The cheat sheet

| Concern | v4 | v5 |
|---|---|---|
| Enable photo | `<Camera photo={true} />` | `const photoOutput = usePhotoOutput()` then `outputs={[photoOutput]}` |
| Enable video | `<Camera video={true} audio={true} />` | `const videoOutput = useVideoOutput({ enableAudio: true })` then `outputs={[videoOutput]}` |
| Enable frame processor | `frameProcessor={useFrameProcessor(...)}` | `const frameOutput = useFrameOutput({ onFrame })` then `outputs={[frameOutput]}` |
| Enable code scanner | `codeScanner={useCodeScanner(...)}` | Separate package `react-native-vision-camera-barcode-scanner` → `const barcodeOutput = useBarcodeScannerOutput(...)` then `outputs={[barcodeOutput]}` OR iOS-only native `useObjectOutput` |
| Format / resolution / fps / HDR | `useCameraFormat(device, [...])` + `format`, `fps`, `videoHdr`, `photoHdr` props | `constraints={[...]}` prop — priority-ordered, auto-negotiated |
| Take photo | `await cameraRef.current.takePhoto({ flash: 'on' })` | `await photoOutput.capturePhoto({ flashMode: 'on' }, {})` — returns in-memory `Photo` |
| Save photo to file | takePhoto returned a file path already | `await photoOutput.capturePhotoToFile(...)` returns `{ filePath }` |
| Start recording | `cameraRef.current.startRecording({ onRecordingFinished, onRecordingError })` | `const recorder = await videoOutput.createRecorder({}); await recorder.startRecording(onFinished, onError)` |
| Stop recording | `cameraRef.current.stopRecording()` | `recorder.stopRecording()` |
| Focus | `cameraRef.current.focus({ x, y })` | `cameraRef.current.focusTo({ x, y })` or `controller.focusTo(meteringPoint, { modes, adaptiveness, autoResetAfter, responsiveness })` |
| Pinch-to-zoom | Manual `Gesture.Pinch()` + `animatedProps` + `addWhitelistedNativeProps` | `<Camera enableNativeZoomGesture />` (or still-manual with `zoom={sharedValue}`) |
| Tap-to-focus | Manual `Gesture.Tap()` + `camera.focus(point)` | `<Camera enableNativeTapToFocusGesture />` |
| Pixel format | `pixelFormat` on `<Camera />` | Per-output: `useFrameOutput({ pixelFormat: 'yuv' })` |
| Worklets engine | `react-native-worklets-core` + babel plugin | `react-native-worklets` (Software Mansion) + `react-native-vision-camera-worklets`; no separate babel plugin (Reanimated plugin covers it) |
| Native frame processor plugin | Swift class extends `FrameProcessorPlugin`, registered via `VISION_EXPORT_SWIFT_FRAME_PROCESSOR` macro + `[String: Any?]` options | Nitro `HybridObject` spec, platforms in Swift/Kotlin, full typed params |
| Expo config plugin flag | `"enableFrameProcessors": false` in app.json | Worklets are opt-in by installing the package; no flag required |

## 1. Packages

Remove:

```sh
npm uninstall react-native-worklets-core
# if you had these community plugins, check their v5 status — many are being rewritten
npm uninstall vision-camera-code-scanner vision-camera-resize-plugin
```

Install:

```sh
npm i react-native-vision-camera@5 react-native-nitro-modules react-native-nitro-image
# If you used frame processors:
npm i react-native-vision-camera-worklets react-native-worklets
# If you used code scanning:
npm i react-native-vision-camera-barcode-scanner
# If you used location tagging (EXIF/video metadata):
npm i react-native-vision-camera-location
# If you used vision-camera-resize-plugin:
npm i react-native-vision-camera-resizer
cd ios && pod install
```

`babel.config.js` — remove the `react-native-worklets-core/plugin` entry. The react-native-worklets plugin needs to be added https://docs.swmansion.com/react-native-worklets/docs/.

Expo — remove `"enableFrameProcessors": false` from the `react-native-vision-camera` plugin block. That flag no longer exists.

## 2. `<Camera />` — props

V4 boolean props → V5 explicit outputs:

```tsx
// ❌ V4
<Camera
  device={device}
  photo={true}
  video={true}
  audio={true}
  frameProcessor={frameProcessor}
  codeScanner={codeScanner}
  format={format}
  fps={60}
  videoHdr={true}
  photoHdr={true}
  pixelFormat="yuv"
  enableDepthData={true}
/>

// ✅ V5
const photoOutput = usePhotoOutput()
const videoOutput = useVideoOutput({ enableAudio: true })
const frameOutput = useFrameOutput({ pixelFormat: 'yuv', onFrame })
const depthOutput = useDepthOutput({ onDepth })

<Camera
  device={device}
  outputs={[photoOutput, videoOutput, frameOutput, depthOutput]}
  constraints={[
    { fps: 60 },
    { photoHDR: true },
    { videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' } },
  ]}
/>
```

Notes:

- `device` now accepts the string shortcut `"back"` or `"front"` in addition to a `CameraDevice` object. `useCameraDevice('back')` still works and is still preferred when you need capability probing.
- `format={...}` is removed. There is no direct replacement — express intent via `constraints`.
- `pixelFormat`, `videoHdr`, `photoHdr`, `fps`, `videoStabilizationMode` are all **not** Camera props anymore. They are either constraints or per-output options.

## 3. Formats → Constraints

The biggest conceptual shift. In v4 you built a `CameraDeviceFormat` by filtering a list. In v5 you declare what you want; the Camera picks.

```tsx
// ❌ V4
const format = useCameraFormat(device, [
  { fps: 60 },
  { videoHdr: true },
  { videoResolution: { width: 3840, height: 2160 } },
])
const minFps = Math.max(format.minFps, 20)
const maxFps = Math.min(format.maxFps, 30)
<Camera device={device} format={format} fps={60} videoHdr />

// ✅ V5
<Camera
  device={device}
  constraints={[
    { fps: 60 },
    { videoDynamicRange: CommonDynamicRanges.ANY_HDR },
    { resolutionBias: videoOutput }, // prefer videoOutput's target resolution
  ]}
/>
```

Rules:

- Order matters. Earliest constraint = highest priority.
- Never throws for an unreachable combination — it picks the closest supported fallback.
- Use `resolutionBias: output` to say "optimize for this output's resolution" instead of picking pixel dimensions by hand.
- Set per-output `targetResolution` (e.g. `usePhotoOutput({ targetResolution: CommonResolutions.UHD_16_9 })`) rather than computing `{ width, height }` in a format filter.
- Probe support with `device.isSessionConfigSupported(...)` when you need to gate UI (e.g. "show HDR toggle only if supported").
- Resolve target constraints without opening a Camera via `VisionCamera.resolveConstraints(...)` upfront if desired.
- `onSessionConfigSelected={(config) => console.log(config.toString())}` tells you what the Camera actually picked (same as `VisionCamera.resolveConstraints(...)`).

Common migrations:

```tsx
// Slow motion 240fps
// ❌ V4: useCameraFormat(device, [{ fps: 240 }])  then fps={format.maxFps}
// ✅ V5:
<Camera constraints={[{ fps: 240 }]} />

// "Highest possible photo resolution"
// ❌ V4: useCameraFormat(device, [{ photoResolution: 'max' }])
// ✅ V5: drop the constraint — fewer outputs already mean higher resolutions
//    are negotiated. Or explicitly:
const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.UHD_16_9 })
<Camera outputs={[photoOutput]} constraints={[{ resolutionBias: photoOutput }]} />

// Video HDR
// ❌ V4: useCameraFormat(device, [{ videoHdr: true }]) + videoHdr prop
// ✅ V5:
<Camera constraints={[{
  videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' }
}]} />
```

## 4. Taking photos

```tsx
// ❌ V4
const file = await cameraRef.current.takePhoto({
  flash: 'on',
  enableAutoRedEyeReduction: true,
  enableShutterSound: false,
})
const uri = `file://${file.path}`

// ✅ V5 — in-memory (preferred)
const photo = await photoOutput.capturePhoto(
  { flashMode: 'on' },
  {
    onWillBeginCapture: () => {},
    onWillCapturePhoto: () => {},
    onDidCapturePhoto: () => {},
    onPreviewImageAvailable: (image) => { /* thumbnail for instant UI */ },
  }
)
const image = await photo.toImageAsync() // render with react-native-nitro-image

// ✅ V5 — if you genuinely need a file
const { filePath } = await photoOutput.capturePhotoToFile({ flashMode: 'on' }, {})
```

Behavioral changes:

- `takePhoto` wrote to a temp file on every call. `capturePhoto` skips that entirely. Prefer it — it is faster and uses less I/O and disk.
- Callbacks that used to fire on the Camera are now passed as a second argument object on every capture call (`onWillBeginCapture`, `onWillCapturePhoto`, `onDidCapturePhoto`, `onPreviewImageAvailable`).
- Thumbnail preview: in v5, configure `previewImageTargetSize` on `usePhotoOutput(...)` and receive via `onPreviewImageAvailable`, rather than showing the saved file.
- `photoQualityBalance` prop is gone. Pass `qualityPrioritization: 'speed' | 'balanced' | 'quality'` in the capture settings (per-call) or the photo output options.
- Shutter sound / red-eye options live on `CapturePhotoSettings`. Note the renames: `flash` → `flashMode`, `enableAutoRedEyeReduction` → `enableRedEyeReduction`.

## 5. Recording video

```tsx
// ❌ V4
<Camera video={true} audio={true} />
camera.current.startRecording({
  onRecordingFinished: (video) => console.log(video.path),
  onRecordingError: (err) => console.error(err),
})
await camera.current.stopRecording()

// ✅ V5
const videoOutput = useVideoOutput({ enableAudio: true })
<Camera outputs={[videoOutput]} />
const recorder = await videoOutput.createRecorder({
  // optional: location, audio settings, codec, etc.
})
await recorder.startRecording(
  (filePath, reason) => console.log('finished:', filePath, reason),
  (err) => console.error(err),
  () => console.log('paused'),
  () => console.log('resumed'),
)
await recorder.pauseRecording()
await recorder.resumeRecording()
await recorder.stopRecording()
await recorder.cancelRecording() // deletes the file
```

- `Recorder` is **single-use**. Do not reuse it. Always `createRecorder` again.
- Progress: `recorder.recordedFileSize`, `recorder.isRecording`, `recorder.isPaused`, `recorder.filePath`.
- For recordings that must survive a device switch (e.g. front→back mid-recording), set `enablePersistentRecorder: true` on `useVideoOutput(...)`.

## 6. Frame processors

### 6a. Basic processor

```tsx
// ❌ V4
const frameProcessor = useFrameProcessor((frame) => {
  'worklet'
  const objects = detectObjects(frame)
}, [])
<Camera frameProcessor={frameProcessor} pixelFormat="yuv" />

// ✅ V5
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet'
    try {
      const objects = detectObjects(frame)
    } finally {
      frame.dispose() // REQUIRED
    }
  },
})
<Camera outputs={[frameOutput]} />
```

- `frame.dispose()` is mandatory in v5. The buffer pool is bounded; without dispose, the pipeline stalls and new frames are dropped.
- Worklets now run on `react-native-worklets` — a worklet can mutate a Reanimated `SharedValue` directly (no `runOnJS` needed).

### 6b. runAsync / runAtTargetFps → AsyncRunner

```tsx
// ❌ V4 runAsync
const frameProcessor = useFrameProcessor((frame) => {
  'worklet'
  runAsync(frame, () => {
    'worklet'
    doHeavyWork(frame)
  })
}, [])

// ✅ V5 AsyncRunner with explicit backpressure
const asyncRunner = useAsyncRunner()
const frameOutput = useFrameOutput({
  onFrame(frame) {
    'worklet'
    const accepted = asyncRunner.runAsync(() => {
      'worklet'
      try { doHeavyWork(frame) } finally { frame.dispose() }
    })
    if (!accepted) frame.dispose() // dropped — still must dispose
  },
})
```

`runAsync` returns a boolean. `true` = work accepted; dispose inside the async callback. `false` = runner full; dispose immediately. Always handle both branches.

`runAtTargetFps` does not exist in v5. Throttle by counting frames in a worklet-level shared value and early-returning; or offload via async and let backpressure do the throttling for you.

### 6c. Native plugin authoring

This is a hard break. The v4 `FrameProcessorPlugin` base class and `VISION_EXPORT_SWIFT_FRAME_PROCESSOR` macro are gone. V5 plugins are Nitro `HybridObject`s with typed specs.

V4 (Swift) — deprecated:

```swift
@objc(FaceDetectorFrameProcessorPlugin)
public class FaceDetectorFrameProcessorPlugin: FrameProcessorPlugin {
  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable:Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }
  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable:Any]?) -> Any {
    let buffer = frame.buffer
    // ...
    return nil
  }
}
// + Objective-C:
// VISION_EXPORT_SWIFT_FRAME_PROCESSOR(FaceDetectorFrameProcessorPlugin, detectFaces)
```

V5 (Nitro) — the only supported path:

```ts
// spec.ts
import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

export interface MyNativePlugin extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  call(frame: Frame): void
}
```

```swift
// iOS: HybridMyNativePlugin.swift
import VisionCamera
import AVFoundation

class HybridMyNativePlugin: HybridMyNativePluginSpec {
  func call(frame: any HybridFrameSpec) {
    guard let native = frame as? any NativeFrame else { return }
    let buffer = native.sampleBuffer  // CMSampleBuffer
    // ...
  }
}
```

```kotlin
// Android: HybridMyNativePlugin.kt
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.public.NativeFrame

class HybridMyNativePlugin : HybridMyNativePluginSpec() {
  fun call(frame: HybridFrameSpec) {
    val native = frame as? NativeFrame ?: return
    val image = native.image   // ImageProxy
    // ...
  }
}
```

```ts
// JS call site
import { NitroModules } from 'react-native-nitro-modules'
const plugin = NitroModules.createHybridObject<MyNativePlugin>('MyNativePlugin')

const frameOutput = useFrameOutput({
  onFrame(frame) {
    'worklet'
    plugin.call(frame)
    frame.dispose()
  },
})
```

For full Nitro scaffolding (nitrogen codegen, podspec, CMake, linking VisionCamera), delegate to the `build-nitro-modules` skill. 

## 7. Code scanning

```tsx
// ❌ V4 — in core
const codeScanner = useCodeScanner({
  codeTypes: ['qr', 'ean-13'],
  onCodeScanned: (codes) => {},
})
<Camera codeScanner={codeScanner} />

// ✅ V5 — separate package (MLKit, works on both platforms)
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner'

const barcodeOutput = useBarcodeScannerOutput({
  barcodeFormats: ['qr-code', 'ean-13'],
  onBarcodeScanned: (barcodes) => {},
})
<Camera outputs={[barcodeOutput]} />

// Or use the simple drop-in view:
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner'
<CodeScanner isActive barcodeFormats={['qr-code']} onBarcodeScanned={(barcodes) => {}} onError={(e) => {}} />

// Or, iOS-only, no ML dependency, native AVCaptureMetadataOutput:
import { useObjectOutput, isScannedCode } from 'react-native-vision-camera'
const objectOutput = useObjectOutput({
  types: ['qr'],
  onObjectsScanned: (objects) => {
    for (const obj of objects) if (isScannedCode(obj)) console.log(obj.value)
  },
})
<Camera outputs={[objectOutput]} />
```

- V4 `'ean-13'` iOS-UPC-A ambiguity: fixed in v5 because MLKit is used on both platforms.
- Narrow `barcodeFormats` to only what you need — fewer formats = faster detection.

## 8. Focus

```tsx
// ❌ V4
await camera.current.focus({ x: tap.x, y: tap.y })

// ✅ V5 — simple path (CameraRef converts view → camera coords for you)
await camera.current.focusTo({ x: tap.x, y: tap.y })

// ✅ V5 — imperative controller, full options
const meteringPoint = previewView.createMeteringPoint(tap.x, tap.y)
await controller.focusTo(meteringPoint, {
  modes: ['AE', 'AF'],          // subset of 3A metering
  adaptiveness: 'locked',        // 'continuous' (default) or 'locked'
  autoResetAfter: 10,            // seconds; null to disable auto-reset
  responsiveness: 'steady',      // 'snappy' (default) or 'steady'
})
await controller.resetFocus()

// Or let the library handle it:
<Camera enableNativeTapToFocusGesture={true} />
```

`focusTo` now works with `<SkiaCamera />` too (v4 only supported the default preview).

## 9. Zoom

```tsx
// ❌ V4 — manual Reanimated integration
Reanimated.addWhitelistedNativeProps({ zoom: true })
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera)
const zoom = useSharedValue(device.neutralZoom)
const animatedProps = useAnimatedProps<CameraProps>(() => ({ zoom: zoom.value }), [zoom])
<ReanimatedCamera {...props} animatedProps={animatedProps} />

// ✅ V5 — zoom prop accepts a SharedValue natively
const zoom = useSharedValue(device.minZoom)
<Camera zoom={zoom} /* ... */ />

// Or native gesture:
<Camera enableNativeZoomGesture={true} />

// Imperative:
await controller.setZoom(2)
await controller.startZoomAnimation(5, 2) // zoom to 5x over 2s
await controller.cancelZoomAnimation()
```

`device.neutralZoom` was the v4 default. In v5, `1` is the recommended default and `device.zoomLensSwitchFactors` exposes the virtual-device switch points.

## 10. Manual 3A (new capability in v5)

No v4 equivalent — these didn't exist. Pro-camera controls:

```ts
await controller.setFocusLocked(0.3)                                   // lens pos 0..1
await controller.setExposureLocked(minDuration, maxISO)
await controller.setWhiteBalanceLocked({ redGain: 1, greenGain: 0.1, blueGain: 0.1 })
// or lock current auto values:
await controller.lockCurrentExposure()
await controller.lockCurrentFocus()
await controller.lockCurrentWhiteBalance()
```

## 11. Pixel formats

v4 `pixelFormat` was on the Camera (`"yuv" | "rgb"`). In v5 it moves to the Frame/Depth output, and `"native"` is supported:

```tsx
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',     // default, faster than RGB
  // pixelFormat: 'rgb',  // forces YUV→RGB conversion; prefer the Resizer for ML
  // pixelFormat: 'native' // zero-conversion GPU pipelines - fastest - verify actual format via frame.pixelFormat
  onFrame,
})
```

## 12. Lifecycle

Nothing changed conceptually — `isActive` is still the right lever. Keep the Camera mounted; combine with `useIsFocused()`:

```tsx
const isFocused = useIsFocused()
<Camera isActive={isFocused} ... />
```

Interruption handling (incoming calls, thermal throttle) is now formalised on all three usage forms — `<Camera />`, `useCamera`, imperative `CameraSession` — via `onInterruptionStarted`/`onInterruptionEnded`.

## 13. Imperative session API (new in v5)

For multi-cam or fully programmatic control there's a new low-level API:

```ts
const session = await VisionCamera.createCameraSession(/* isMultiCam */ false)
const device = await getDefaultCameraDevice('back')
const photoOutput = VisionCamera.createPhotoOutput({})
const videoOutput = VisionCamera.createVideoOutput({})

await session.configure([{
  input: device,
  outputs: [
    { output: photoOutput, mirrorMode: 'auto' },
    { output: videoOutput, mirrorMode: 'auto' },
  ],
  constraints: [{ fps: 30 }],
}], {})

await session.start()
// ...
await session.stop()
await session.dispose()
```

Multi-cam: `createCameraSession(true)` + one connection per input device. Gate on `device.supportsMultiCamSessions`.

## 14. Testing / mocking

V4's `RN_SRC_EXT` / Metro mock pattern still works in v5 — the library exports the same top-level module shape, just with different identifiers. Your mock needs to expose `Camera`, `useCameraPermission`, `useCameraDevice`, `usePhotoOutput`, `useVideoOutput`, `useFrameOutput`, and whatever else your app imports.

## Checklist for a v4→v5 PR

- [ ] Uninstall `react-native-worklets-core` and its babel plugin; uninstall `vision-camera-code-scanner`, `vision-camera-resize-plugin`, and any v4-only frame-processor plugins.
- [ ] Install `react-native-nitro-modules`, `react-native-nitro-image`, and whichever v5 sub-packages you need. Run `pod install`.
- [ ] Replace `photo` / `video` / `audio` / `frameProcessor` / `codeScanner` props with `outputs={[...]}`.
- [ ] Replace `takePhoto(...)` call sites with `photoOutput.capturePhoto(...)`; drop `file://`-prefix logic unless you explicitly need `capturePhotoToFile`.
- [ ] Replace `startRecording/stopRecording` on the Camera ref with the Recorder lifecycle on the video output.
- [ ] Delete the `format`/`useCameraFormat` code path. Re-express FPS, HDR, stabilization, and resolution intent via `constraints={[...]}` and per-output `targetResolution`.
- [ ] Audit every `onFrame` worklet: add `try/finally` + `frame.dispose()`. Port any `runAsync(frame, ...)` to `asyncRunner.runAsync(() => ...)` with the `accepted ? dispose-inside : dispose-immediate` pattern.
- [ ] Rewrite any in-house native frame-processor plugin as a Nitro `HybridObject`. Remove the `FrameProcessorPlugin` subclass and the registration macro.
- [ ] Delete `Reanimated.createAnimatedComponent(Camera)` / `addWhitelistedNativeProps` — pass the `SharedValue` directly to `zoom` / `exposure`.
- [ ] Replace `camera.focus(point)` with `camera.focusTo(point)` or the native gesture prop.
- [ ] Remove Expo config plugin's `enableFrameProcessors` option.
- [ ] Smoke-test on a real device (emulators frequently misreport formats).

## Pointers

- V5 release blog: https://blog.margelo.com/whats-new-in-visioncamera-v5
- V5 docs: https://visioncamera.margelo.com
- V4 archived docs: https://visioncamera4.margelo.com
- V4 snapshot repo: https://github.com/margelo/react-native-vision-camera-v4-snapshot
- V5 repo (release notes via `gh api repos/mrousavy/react-native-vision-camera/releases/tags/v5.0.0`): https://github.com/mrousavy/react-native-vision-camera
- Worklets engine (SWM, replaces worklets-core): https://docs.swmansion.com/react-native-worklets/docs/
- Related: [quickstart-v5.md](./quickstart-v5.md), [outputs-and-constraints.md](./outputs-and-constraints.md), [frame-processors.md](./frame-processors.md), [capture-and-controls.md](./capture-and-controls.md), [advanced-features.md](./advanced-features.md)
