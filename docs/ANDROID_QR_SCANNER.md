# Android QR camera preview

The standard and EMS mobile scanners use an Android-only canvas preview of the
existing html5-qrcode camera stream. Authentication, lookup endpoints and resolved
navigation are unchanged. iOS and desktop keep their original scanner path.

The library's source video stays connected offscreen until startup and shutdown
settle, even if React unmounts the scanner. This avoids interrupting the library's
unawaited `video.play()`: the controller also awaits playback before stopping it.
Camera ownership is serialized across close/reopen and
standard/EMS switching. Resolution is single-flight, pauses decoding while the
lookup runs and aborts in-flight lookups on close. Hiding the page stops the camera;
use **Restart camera** on returning. The same button retries denied camera access
after the user allows it in browser settings.

Only QR formats are decoded, with a 200 ms delay after processing. Camera constraints
request 320-square video and 15 FPS, but devices may deliver different values.
Mirrored retry remains enabled when no native BarcodeDetector is available. The
canvas is display-sized, uses cached resize measurements, and draws at most 15 FPS
with timer compensation. There is no worker, second camera stream, native change,
dependency upgrade or database change.

The Pixel 9 emulator experiments proved real camera-to-QR recognition for both
scanners, including rotated codes, but did not achieve 15 FPS. Emulator throughput
varies with host load and must not be interpreted as physical-phone performance.
Physical-phone lighting, range and decoder fallback still need field validation.

Final validation of the integrated components on Pixel 9 measured 8.69 FPS for
the standard scanner and 8.23 FPS for EMS. Eight live-camera scans (normal, 90
and 180 degrees) returned the exact local test value to the correct existing endpoint,
with one request per scan. End-to-end recognition/result times were 2.19-3.52
seconds, including a deliberately delayed local lookup response. Both scanners
recovered from simulated permission denial. Six rapid startup-close/switch cycles
released every camera stream and preview without unhandled playback errors.
These are emulator measurements, not physical-device or authenticated Production
camera verification.

## Fallback and rollback

For diagnosis, append `?androidCameraPreview=video` to the scanner page URL to use
the original scanner path, e.g. `/mobile/scan?androidCameraPreview=video`.
This deliberately returns to the potentially black video preview. Normal Android
users receive canvas without a flag or account restriction.

The application release is based directly on Production commit
`462a102e40e9d07296fddf29dac254cad164ad2d`. No migrations are required. If a
Production regression is found, promote the prior READY deployment
`redline-lkjg00wlr-redline-fire-hq.vercel.app` rather than changing data.

## Checks

Run `npx tsx --test lib/mobile/android-qr-scanner.test.ts`, `npm run typecheck`,
and `npm run build`. Camera validation must use live video with a real QR in view;
decoding a static fixture file is not a camera test.
