# Advanced features

Depth, multi-cam, Skia previews, the GPU Resizer, barcode scanning (separate package), GPS/location metadata, and writing a custom native output.

## Depth frames (LiDAR / ToF / disparity)

```tsx
import { Camera, useDepthOutput, useCameraDevice } from 'react-native-vision-camera'

const device = useCameraDevice('back')
const depthOutput = useDepthOutput({
  // pixelFormat: DepthPixelFormat — one of:
  //   'depth-16-bit' | 'depth-32-bit' | 'depth-point-cloud-32-bit'
  //   | 'disparity-16-bit' | 'disparity-32-bit' | 'unknown'
  onDepth(depth) {
    'worklet'
    try {
      // depth.width, depth.height, depth.pixelFormat, depth.orientation, depth.timestamp
      // depth.depthDataAccuracy, depth.depthDataQuality, depth.isDepthDataFiltered
      // depth.isMirrored, depth.isValid, depth.bytesPerRow, depth.cameraCalibrationData (iOS)
      // depth.getDepthData(), depth.getNativeBuffer()
      // depth.convert('depth-32-bit') / depth.convertAsync(...)
    } finally {
      depth.dispose() // REQUIRED — same buffer-pool rule as Frame
    }
  },
})

<Camera device={device} isActive={true} outputs={[depthOutput]} />
```

- Requires `react-native-vision-camera-worklets` + `react-native-worklets`.
- Not every device exposes depth. Gate on `device.supportsDepthCapture`.
- Two sources:
  - LiDAR / ToF / Infrared → true depth frames (`depth-16-bit`, `depth-32-bit`, `depth-point-cloud-32-bit`).
  - Dual or triple virtual cameras → disparity frames synthesized from stereo (`disparity-16-bit`, `disparity-32-bit`).
- `depth.convert(...)` / `depth.convertAsync(...)` converts between depth/disparity formats in-place on the GPU.
- Native plugins: same Nitro pattern as Frame, but use the `Depth` spec type and cast to `NativeDepth` (iOS: `AVDepthData`).

## Multi-camera sessions

Front + back simultaneously (or any combination the device supports). iOS 13+ and supported Android devices only.

```ts
// Probe first:
if (!device.supportsMultiCamSessions) return

// Imperative only — no declarative shorthand for multi-cam.
const session = await VisionCamera.createCameraSession(/* isMultiCam */ true)

const backDevice = await getDefaultCameraDevice('back')
const frontDevice = await getDefaultCameraDevice('front')

const backPreview = VisionCamera.createPreviewOutput({})
const frontPreview = VisionCamera.createPreviewOutput({})
const backVideo = VisionCamera.createVideoOutput({ enableAudio: true })

const [backController, frontController] = await session.configure([
  {
    input: backDevice,
    outputs: [
      { output: backPreview,  mirrorMode: 'auto' },
      { output: backVideo,    mirrorMode: 'auto' },
    ],
    constraints: [{ fps: 30 }],
  },
  {
    input: frontDevice,
    outputs: [{ output: frontPreview, mirrorMode: 'auto' }],
    constraints: [],
  },
], {})

await session.start()
```

Render each preview with `<NativePreviewView />`, bound to its own `CameraPreviewOutput`. For picture-in-picture UX, render the front preview as a smaller absolutely-positioned view on top.

## Skia previews — shaders and live effects

```tsx
import { SkiaCamera } from 'react-native-vision-camera-skia'

<SkiaCamera
  device={device}
  isActive={true}
  pixelFormat="yuv"
  onFrame={(frame, render) => {
    'worklet'
    render(({ frameTexture, canvas }) => {
      canvas.drawImage(frameTexture, 0, 0)
      // draw overlays, apply a Skia ImageFilter, etc.
    })
    frame.dispose()
  }}
/>
```

- `<SkiaCamera />` replaces `<Camera />`'s preview with a Skia canvas and **always** attaches a frame output (you can't opt out).
- Pixel formats: `'yuv'` (default, 8/10-bit supported), `'rgb'` (conversion overhead), `'native'` (verify compatibility).
- `focusTo` works with SkiaCamera in v5.
- For manual rendering without the wrapper: use `NativeBuffer` + Skia's `MakeImageFromNativeBuffer()`.
- Peer deps: `@shopify/react-native-skia`.

## GPU Resizer — the ML fast-path

`react-native-vision-camera-resizer` is Margelo's GPU-accelerated replacement for CPU-based `vision-camera-resize-plugin`. Benchmarked ~5× faster. Runs Metal on iOS, Vulkan on Android 8.0+.

```ts
import { useResizer, isResizerAvailable } from 'react-native-vision-camera-resizer'

const { resizer } = useResizer({
  width: 128,
  height: 128,
  channelOrder: 'rgb',     // 'rgb' | 'bgr' | ...
  dataType: 'float32',     // 'float32' for most ML models; 'uint8' for quantized
  pixelLayout: 'planar',   // 'planar' = NCHW ([1,3,H,W]); 'interleaved' = NHWC ([1,H,W,3])
  // scaleMode: 'cover' | 'contain'
})

const frameOutput = useFrameOutput({
  pixelFormat: 'yuv', // resizer is happiest with YUV input
  onFrame(frame) {
    'worklet'
    const resized = resizer.resize(frame)
    const pixels = resized.getPixelBuffer() // typed array / native buffer ready for ONNX/TFLite
    try { /* model.run(pixels) */ }
    finally {
      resized.dispose()
      frame.dispose()
    }
  },
})
```

Always gate on `isResizerAvailable()` to provide a CPU fallback if desired. Dispose the `GPUFrame` same as a regular Frame — it's a pooled GPU resource.

## Barcode scanner — `react-native-vision-camera-barcode-scanner`

MLKit on both platforms, so format behavior matches across iOS and Android. The classic v4 `'ean-13' ↔ UPC-A` iOS quirk is gone.

### Easiest — drop-in view

```tsx
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner'

<CodeScanner
  isActive
  barcodeFormats={['qr-code', 'ean-13']}
  onBarcodeScanned={(barcodes) => console.log(barcodes[0]?.rawValue)}
  onError={(e) => console.error(e)}
/>
```

### Integrated — Camera output

```tsx
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner'

const barcodeOutput = useBarcodeScannerOutput({
  barcodeFormats: ['qr-code'],
  onBarcodeScanned: (barcodes) => {},
})

<Camera outputs={[photoOutput, barcodeOutput]} /* ... */ />
```

### Frame-processor — full control

```tsx
import { useBarcodeScanner } from 'react-native-vision-camera-barcode-scanner'

const scanner = useBarcodeScanner({ barcodeFormats: ['qr-code'] })
const frameOutput = useFrameOutput({
  onFrame(frame) {
    'worklet'
    try {
      const codes = scanner.scanCodes(frame)
      if (codes.length) found.value = codes
    } finally { frame.dispose() }
  },
})
```

Performance rule: list only the formats you need.

## iOS-only native object output (no ML dep)

If all you need is QR + face + body detection on iOS, skip MLKit and use the native `AVCaptureMetadataOutput` path:

```tsx
import { useObjectOutput, isScannedCode, isScannedFace } from 'react-native-vision-camera'

const objectOutput = useObjectOutput({
  types: ['qr', 'face', 'human-body'],
  onObjectsScanned: (objects) => {
    for (const o of objects) {
      if (isScannedCode(o)) console.log('code:', o.value)
      else if (isScannedFace(o)) console.log('face:', o.faceID)
    }
  },
})

<Camera outputs={[objectOutput]} />
```

Android has no native equivalent — use the MLKit barcode scanner there.

## GPS / location metadata — `react-native-vision-camera-location`

```tsx
import { useLocation } from 'react-native-vision-camera-location'

const loc = useLocation({})
useEffect(() => { if (!loc.hasPermission) loc.requestPermission() }, [loc.hasPermission])

// Attach to photo:
const photo = await photoOutput.capturePhoto({ location: loc.currentLocation }, {})

// Attach to video recorder:
const recorder = await videoOutput.createRecorder({ location: loc.currentLocation })
```

Adds EXIF GPS tags to JPEGs and location metadata to mp4/mov. Imperative variant: `createLocationManager(...)` + `addOnLocationChangedListener`.

## Custom native `CameraOutput` (extensibility)

V5 exposes `NativeCameraOutput` so plugin authors can ship a fully custom output (e.g. a proprietary HDR pipeline, a ML streaming output) as a separate Nitro Module without forking the library.

```ts
// Your spec
export interface MyOutput extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  // ... methods + events your output exposes
}
```

Implement `NativeCameraOutput` (iOS) / its Android equivalent, expose a factory function in your Nitro module, and consumers attach via the standard `outputs={[myOutput, ...]}` prop. Delegate scaffolding to the build-nitro-modules skill.

## Constraints for advanced features — quick recap

```ts
// Photo HDR
[{ photoHDR: true }]

// Video HDR 10-bit HLG
[{ videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'hlg-bt2020', colorRange: 'full' } }]

// Apple Log
[{ videoDynamicRange: { bitDepth: 'hdr-10-bit', colorSpace: 'apple-log', colorRange: 'full' } }]

// Cinematic stabilization
[{ videoStabilizationMode: 'cinematic-extended' }]

// Prefer binned sensor readout
[{ binned: true }]

// Optimize for the frame output's resolution
[{ resolutionBias: frameOutput }]
```

Always pair advanced features with `isSessionConfigSupported(...)` / `onSessionConfigSelected` so your UI reflects what the Camera actually picked.

## Pointers

- Docs — Depth Output: https://visioncamera.margelo.com/docs/depth-output
- Docs — Object Output (iOS): https://visioncamera.margelo.com/docs/object-output
- API — `Depth`: https://visioncamera.margelo.com/api/react-native-vision-camera/hybrid-objects/Depth
- API — `DepthPixelFormat`: https://visioncamera.margelo.com/api/react-native-vision-camera/type-aliases/DepthPixelFormat
- Core repo: https://github.com/mrousavy/react-native-vision-camera
- Barcode scanner (MLKit, both platforms): https://github.com/mrousavy/react-native-vision-camera/tree/main/packages/react-native-vision-camera-barcode-scanner
- GPU Resizer (~5× CPU, Metal/Vulkan): https://github.com/mrousavy/react-native-vision-camera/tree/main/packages/react-native-vision-camera-resizer
- Skia preview: https://github.com/mrousavy/react-native-vision-camera/tree/main/packages/react-native-vision-camera-skia
- Location (EXIF GPS): https://github.com/mrousavy/react-native-vision-camera/tree/main/packages/react-native-vision-camera-location
- Nitro scaffolding for custom `NativeCameraOutput`: use the `build-nitro-modules` skill.
- Related: [outputs-and-constraints.md](./outputs-and-constraints.md), [frame-processors.md](./frame-processors.md), [capture-and-controls.md](./capture-and-controls.md), [migration-v4-to-v5.md](./migration-v4-to-v5.md)
