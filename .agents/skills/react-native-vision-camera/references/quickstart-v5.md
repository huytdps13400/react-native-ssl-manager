# Quickstart — VisionCamera v5

Minimum working Camera on iOS and Android with v5.

## 1. Install

Core + required Nitro peers:

```sh
npm i react-native-vision-camera@5 react-native-nitro-modules react-native-nitro-image
cd ios && pod install
```

Optional, install only what the app needs:

```sh
# Frame Processors (worklets). The new default worklets engine is Software Mansion's
# react-native-worklets, NOT react-native-worklets-core.
npm i react-native-vision-camera-worklets react-native-worklets

# Barcode/QR (MLKit on iOS + Android, consistent formats)
npm i react-native-vision-camera-barcode-scanner

# GPU-accelerated frame resize for ML pipelines (Metal/Vulkan, ~5x CPU)
npm i react-native-vision-camera-resizer

# GPS/EXIF metadata
npm i react-native-vision-camera-location

# Skia-based preview + shader effects
npm i react-native-vision-camera-skia @shopify/react-native-skia
```

babel plugin is needed for  worklet.  `react-native-worklets/plugin` must be added in `babel.config.js` . See https://docs.swmansion.com/react-native-worklets/docs/

## 2. Permissions

**iOS — `ios/<App>/Info.plist`:**

```xml
<key>NSCameraUsageDescription</key>
<string>$(PRODUCT_NAME) needs access to your Camera to capture photos and videos.</string>
<key>NSMicrophoneUsageDescription</key>
<string>$(PRODUCT_NAME) needs access to your Microphone to record audio.</string>
```

Add `NSLocationWhenInUseUsageDescription` only if using `react-native-vision-camera-location`.

**Android — `android/app/src/main/AndroidManifest.xml`:**

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

Request permissions in JS before rendering:

```tsx
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera'

const { hasPermission, requestPermission } = useCameraPermission()
useEffect(() => { if (!hasPermission) requestPermission() }, [hasPermission])
```

## 3. First Camera — photo capture

The idiomatic v5 screen: hook-based permission → hook-based device → output(s) → `<Camera />`.

```tsx
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera'

export function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission()
  useEffect(() => { if (!hasPermission) requestPermission() }, [hasPermission, requestPermission])

  const device = useCameraDevice('back')
  const isFocused = useIsFocused()
  const photoOutput = usePhotoOutput()

  if (!hasPermission || device == null) return null

  const onShutter = async () => {
    const photo = await photoOutput.capturePhoto({ flashMode: 'auto' }, {})
    // Display in-memory without hitting disk:
    const image = await photo.toImageAsync() // from react-native-nitro-image
    // ... render <Image source={image} />
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isFocused}
      outputs={[photoOutput]}
    />
  )
}
```

Key differences from v4 in this snippet:

- `outputs={[photoOutput]}` replaces the `photo={true}` boolean prop.
- `capturePhoto` lives on the output, not the Camera ref.
- The return value is a `Photo` — in memory, with EXIF and camera calibration already attached. Use `capturePhotoToFile` only if you genuinely need a file path.
- `isActive={isFocused}` keeps the session configured but stopped when the screen is off-stage. Do not unmount the Camera to hide it.

## 4. Video recording — minimum

```tsx
import { Camera, useCameraDevice, useVideoOutput, usePhotoOutput } from 'react-native-vision-camera'

const device = useCameraDevice('back')
const videoOutput = useVideoOutput({ enableAudio: true })
const photoOutput = usePhotoOutput()

const record = async () => {
  const recorder = await videoOutput.createRecorder({})
  await recorder.startRecording(
    (filePath, reason) => console.log('finished:', filePath, reason),
    (err) => console.error(err),
  )
  // later...
  await recorder.stopRecording()
}

return <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={[photoOutput, videoOutput]} />
```

Notes:

- A `Recorder` is **single-use**. Call `createRecorder` again for each recording.
- Audio is **off by default** — pass `enableAudio: true` and ensure microphone permission.
- `stopRecording()` resolves immediately; the `onFinished` callback fires once the file has been flushed.

## 5. Minimum Frame Processor

```tsx
import { Camera, useFrameOutput, useCameraDevice } from 'react-native-vision-camera'

const device = useCameraDevice('back')
const frameOutput = useFrameOutput({
  pixelFormat: 'yuv',
  onFrame(frame) {
    'worklet'
    try {
      // ... work with frame.width, frame.height, frame.pixelFormat, native buffer
    } finally {
      frame.dispose() // REQUIRED — buffer pool is bounded
    }
  },
})

return <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={[frameOutput]} />
```

Requires `react-native-vision-camera-worklets` + `react-native-worklets`. See [frame-processors.md](frame-processors.md) for async offloading, native plugin authoring, and pixel-format decisions.

## 6. Common gotchas on first install

- "Nitro module not found" / immediate native crash → peers missing. Install `react-native-nitro-modules` and `react-native-nitro-image`; for frame processors add `react-native-worklets` + `react-native-vision-camera-worklets`; run `pod install`.
- Frame processor silently does nothing → check both worklets packages are installed. v5 does not fall back to `worklets-core`.
- Camera is black on Android emulator → emulators rarely emulate all formats; test on a real device before debugging constraints.
- Immediate dealloc / crash when navigating away → you're unmounting the Camera. Mount it once and toggle `isActive`.
- Trying to set `format={...}` → that prop was removed. Use `constraints={[...]}`.

## Pointers

- Docs — Getting Started: https://visioncamera.margelo.com/docs
- Docs — Camera Outputs: https://visioncamera.margelo.com/docs/camera-outputs
- Worklets (Software Mansion): https://docs.swmansion.com/react-native-worklets/docs/
- Repo: https://github.com/mrousavy/react-native-vision-camera
- llms index: https://visioncamera.margelo.com/llms.txt / https://visioncamera.margelo.com/llms-full.txt
- Related: [migration-v4-to-v5.md](./migration-v4-to-v5.md), [outputs-and-constraints.md](./outputs-and-constraints.md), [frame-processors.md](./frame-processors.md), [capture-and-controls.md](./capture-and-controls.md)
