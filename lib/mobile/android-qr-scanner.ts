import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";

export function usesAndroidCanvasScanner(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) &&
    new URLSearchParams(location.search).get("androidCameraPreview") !== "video";
}

export function androidCameraConfig(nativeDetector: boolean): Html5QrcodeCameraScanConfig {
  return {
    fps: 5,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1,
    disableFlip: nativeDetector,
    videoConstraints: {
      facingMode: "environment",
      width: { ideal: 320 },
      height: { ideal: 320 },
      frameRate: { ideal: 15 },
    },
  };
}

type Options = {
  host: HTMLElement;
  resolve: (text: string, signal: AbortSignal) => Promise<(() => void) | null>;
  onReady: () => void;
  onError: (error: unknown, phase: "camera" | "lookup" | "cleanup") => void;
};

// Serialize camera ownership, including permission/startup work that cannot be cancelled.
let cameraReleased: Promise<void> = Promise.resolve();
let sequence = 0;

export function startAndroidQrScanner(options: Options): { close: () => Promise<void> } {
  const previous = cameraReleased;
  let release!: () => void;
  cameraReleased = new Promise<void>((resolve) => { release = resolve; });
  let closed = false;
  let closing: Promise<void> | undefined;
  let scanner: Html5Qrcode | undefined;
  let reader: HTMLDivElement | undefined;
  let stopPreview = () => {};
  let busy = false;
  const request = new AbortController();
  const report = (error: unknown, phase: "camera" | "lookup" | "cleanup") => {
    console.error(`Android QR scanner ${phase} failed:`, error);
    options.onError(error, phase);
  };
  const startup = (async () => {
    await previous;
    if (closed) return;
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    if (closed) return;
    reader = document.createElement("div");
    reader.id = `android-qr-camera-${++sequence}`;
    // Keep the library's video connected even if React unmounts the visible screen.
    // Removing a pending video.play() surface causes an unhandled library rejection.
    reader.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.max(240, options.host.clientWidth)}px;opacity:0;pointer-events:none`;
    reader.setAttribute("aria-hidden", "true");
    document.body.append(reader);
    scanner = new Html5Qrcode(reader.id, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    await scanner.start({ facingMode: "environment" }, androidCameraConfig("BarcodeDetector" in window), (text) => {
      if (closed || busy || !scanner) return;
      busy = true;
      scanner.pause(false);
      void (async () => {
        try {
          const resolved = await options.resolve(text, request.signal);
          if (closed) return;
          if (resolved) {
            await close();
            resolved();
          } else {
            busy = false;
            scanner?.resume();
          }
        } catch (error) {
          if (closed && request.signal.aborted) return;
          report(error, "lookup");
          busy = false;
          if (!closed && scanner?.isScanning) scanner.resume();
        }
      })();
    }, () => undefined);
    const video = reader.querySelector("video");
    if (!video?.srcObject) throw new Error("Camera started without a video stream.");
    // start() resolves before its unawaited play() has settled. Await playback,
    // even after close was requested, before stopping/removing the source video.
    await video.play();
    if (closed) return;
    stopPreview = attachPreview(options.host, video, (error) => {
      report(error, "camera");
      void close().catch((cleanupError) => report(cleanupError, "cleanup"));
    });
    options.onReady();
  })();

  async function close(): Promise<void> {
    if (closing) return closing;
    closed = true;
    request.abort();
    stopPreview();
    closing = (async () => {
      try {
        // Do not remove the camera surface while the library is starting playback.
        await startup;
      } catch {
        // Startup errors are reported by the handler below; still release its tracks.
      }
      const stream = reader?.querySelector("video")?.srcObject;
      try {
        if (scanner?.isScanning) await scanner.stop();
        scanner?.clear();
      } finally {
        if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
        reader?.remove();
        release();
      }
    })();
    return closing;
  }
  void startup.catch((error) => {
    if (!closed) report(error, "camera");
    void close().catch((cleanupError) => report(cleanupError, "cleanup"));
  });
  return { close };
}

export function attachPreview(host: HTMLElement, video: HTMLVideoElement, onError: (error: unknown) => void): () => void {
  const canvas = document.createElement("canvas");
  canvas.dataset.androidCanvasPreview = "true";
  canvas.setAttribute("aria-label", "Live camera preview");
  canvas.style.cssText = "display:block;width:100%;aspect-ratio:1;object-fit:cover";
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This Android browser cannot display the camera canvas.");
  const resize = () => {
    const size = Math.max(1, Math.min(video.videoWidth || 320, host.clientWidth || 320));
    if (canvas.width !== size) canvas.width = canvas.height = size;
  };
  resize();
  host.append(canvas);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    observer.disconnect();
    canvas.remove();
  };
  const draw = () => {
    if (stopped) return;
    if (!host.isConnected) { stop(); return; }
    const started = performance.now();
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    } catch (error) {
      stop();
      onError(error);
      return;
    }
    timer = setTimeout(draw, Math.max(0, Math.ceil(1000 / 15 - (performance.now() - started))));
  };
  timer = setTimeout(draw, 0);
  return stop;
}
