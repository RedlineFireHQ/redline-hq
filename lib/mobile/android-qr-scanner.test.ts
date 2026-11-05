import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("./android-qr-scanner.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(agent = "Android", search = "") {
  const readers: Node[] = [], hosts: Node[] = [], scanners: FakeScanner[] = [];
  const timers = new Map<number, () => void>();
  const errors: unknown[] = [], phases: string[] = [];
  let nextTimer = 0, draws = 0, stops = 0, ready = 0;
  let delayStart = false, delayPlayback = false, rejectStart = false, rejectStop = false, failDraw = false;
  const observers: { disconnected: boolean }[] = [];
  class Stream {
    track = { readyState: "live", stop: () => { this.track.readyState = "ended"; } };
    getTracks() { return [this.track]; }
  }
  class Node {
    id = "";
    style = { cssText: "" };
    dataset: Record<string, string> = {};
    clientWidth = 344;
    isConnected = true;
    width = 0;
    height = 0;
    children: Node[] = [];
    video?: { srcObject: Stream; videoWidth: number; readyState: number; play: () => Promise<void> };
    setAttribute() {}
    append(child: Node) { this.children.push(child); }
    remove() {
      this.isConnected = false;
      for (const list of [readers, ...hosts.map(h => h.children)]) {
        const index = list.indexOf(this);
        if (index >= 0) list.splice(index, 1);
      }
    }
    querySelector() { return this.video; }
    getContext() { return { drawImage: () => { if (failDraw) throw Error("Draw failed"); draws++; } }; }
  }
  class FakeScanner {
    isScanning = false;
    paused = false;
    startGate = deferred<void>();
    playGate = deferred<void>();
    decode!: (text: string) => void;
    reader: Node;
    config: unknown;
    constructor(id: string, public options: unknown) {
      this.reader = readers.find(r => r.id === id)!;
      scanners.push(this);
    }
    async start(_camera: unknown, config: unknown, decode: (text: string) => void) {
      this.decode = decode; this.config = config;
      this.reader.video = { srcObject: new Stream(), videoWidth: 288, readyState: 4,
        play: async () => { if (delayPlayback) await this.playGate.promise; } };
      if (delayStart) await this.startGate.promise;
      if (rejectStart) throw Error("Permission denied");
      assert.equal(this.reader.isConnected, true, "Playback surface must remain connected throughout startup");
      this.isScanning = true;
    }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    async stop() { stops++; if (rejectStop) throw Error("Stop failed"); this.isScanning = false; this.reader.video!.srcObject.getTracks().forEach(t => t.stop()); }
    clear() { this.reader.video = undefined; }
  }
  const exports = {};
  const context = {
    exports, navigator: { userAgent: agent }, location: { search }, URLSearchParams, AbortController,
    MediaStream: Stream, HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    document: {
      body: { append: (node: Node) => readers.push(node) },
      createElement: () => new Node(),
    },
    window: { BarcodeDetector: class {} },
    performance: { now: () => 100 },
    ResizeObserver: class {
      disconnected = false;
      constructor() { observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    setTimeout: (callback: () => void) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id: number) => timers.delete(id),
    console: { error: (...args: unknown[]) => errors.push(args) },
    require: () => ({ Html5Qrcode: FakeScanner, Html5QrcodeSupportedFormats: { QR_CODE: 0 } }),
  };
  runInNewContext(code, context);
  const api = exports as typeof import("./android-qr-scanner");
  function start(resolve: (text: string, signal: AbortSignal) => Promise<(() => void) | null> = async () => null) {
    const host = new Node(); hosts.push(host);
    const session = api.startAndroidQrScanner({
      host: host as unknown as HTMLElement, resolve,
      onReady: () => ready++,
      onError: (_error, phase) => phases.push(phase),
    });
    return { ...session, host };
  }
  return { api, start, readers, hosts, scanners, timers, errors, phases, observers,
    get draws() { return draws; }, get stops() { return stops; }, get ready() { return ready; },
    set delayStart(v: boolean) { delayStart = v; }, set rejectStart(v: boolean) { rejectStart = v; },
    set delayPlayback(v: boolean) { delayPlayback = v; },
    set rejectStop(v: boolean) { rejectStop = v; }, set failDraw(v: boolean) { failDraw = v; },
    tick: () => { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(t => t()); },
  };
}
for (const agent of ["iPhone", "Macintosh", "Windows"]) {
  test(`keeps legacy scanner on ${agent}`, () => assert.equal(fixture(agent).api.usesAndroidCanvasScanner(), false));
}
test("Android defaults to canvas and permits explicit legacy fallback", () => {
  assert.equal(fixture().api.usesAndroidCanvasScanner(), true);
  assert.equal(fixture("Android", "?androidCameraPreview=video").api.usesAndroidCanvasScanner(), false);
});
test("camera settings constrain QR work while retaining mirrored retry without native detector", () => {
  const f = fixture();
  const config = f.api.androidCameraConfig(true);
  assert.equal(config.fps, 5);
  assert.equal(config.disableFlip, true);
  assert.equal(f.api.androidCameraConfig(false).disableFlip, false);
  assert.equal(config.videoConstraints?.facingMode, "environment");
  assert.deepEqual(JSON.parse(JSON.stringify(config.videoConstraints?.width)), { ideal: 320 });
});
test("one existing stream feeds a display-sized canvas and closes idempotently", async () => {
  const f = fixture(), s = f.start();
  await settle();
  assert.equal(f.scanners.length, 1); assert.equal(f.ready, 1);
  assert.equal(f.scanners[0].reader.isConnected, true);
  assert.equal(s.host.children[0].width, 288);
  f.tick(); assert.equal(f.draws, 1);
  await s.close(); await s.close();
  assert.equal(f.stops, 1); assert.equal(f.readers.length, 0);
  assert.equal(s.host.children.length, 0); assert.equal(f.timers.size, 0);
  assert.ok(f.observers.every(o => o.disconnected));
});
test("close before dynamic import does not open a camera", async () => {
  const f = fixture(), s = f.start();
  await s.close();
  assert.equal(f.scanners.length, 0); assert.equal(f.readers.length, 0);
});
test("interrupted startup retains connected video until playback settles, then releases tracks", async () => {
  const f = fixture(); f.delayStart = true;
  const s = f.start(); await settle();
  const stream = f.scanners[0].reader.video!.srcObject;
  const closing = s.close(); s.host.isConnected = false;
  assert.equal(f.scanners[0].reader.isConnected, true);
  f.scanners[0].startGate.resolve(); await closing;
  assert.equal(stream.track.readyState, "ended"); assert.equal(f.readers.length, 0);
  assert.equal(f.ready, 0); assert.equal(f.errors.length, 0);
});
test("immediate scanner switch waits for prior startup and shutdown; no overlapping streams", async () => {
  const f = fixture(); f.delayStart = true;
  const first = f.start(); await settle(); const closing = first.close();
  const second = f.start(); await settle();
  assert.equal(f.scanners.length, 1);
  f.scanners[0].startGate.resolve(); await closing; await settle();
  assert.equal(f.scanners.length, 2);
  f.scanners[1].startGate.resolve(); await settle(); await second.close();
  assert.equal(f.readers.length, 0);
});
test("start resolving is not playback completion: close must await the video play promise", async () => {
  const f = fixture(); f.delayPlayback = true;
  const s = f.start(); await settle();
  const closing = s.close(); await settle();
  assert.equal(f.stops, 0); assert.equal(f.readers.length, 1);
  f.scanners[0].playGate.resolve(); await closing;
  assert.equal(f.stops, 1); assert.equal(f.readers.length, 0);
});
test("permission denial reports an error, cleans tracks, and allows recovery", async () => {
  const f = fixture(); f.rejectStart = true;
  const first = f.start(); await settle(); await first.close();
  assert.equal(f.phases[0], "camera"); assert.equal(f.readers.length, 0);
  f.rejectStart = false; const second = f.start(); await settle();
  assert.equal(f.ready, 1); await second.close();
});
test("duplicate callbacks produce one pending resolution and one successful workflow", async () => {
  const f = fixture(), lookup = deferred<(() => void) | null>();
  let requests = 0, workflows = 0;
  f.start(async () => { requests++; return lookup.promise; }); await settle();
  f.scanners[0].decode("test"); f.scanners[0].decode("test");
  assert.equal(requests, 1); assert.equal(f.scanners[0].paused, true);
  lookup.resolve(() => { workflows++; }); await settle();
  assert.equal(workflows, 1); assert.equal(f.stops, 1); assert.equal(f.readers.length, 0);
});
test("unrecognized QR resumes decoding and can retry", async () => {
  const f = fixture(); let requests = 0;
  const s = f.start(async () => { requests++; return null; }); await settle();
  f.scanners[0].decode("invalid"); await settle();
  assert.equal(f.scanners[0].paused, false);
  f.scanners[0].decode("other"); await settle(); assert.equal(requests, 2);
  await s.close();
});
test("lookup failure is surfaced and resumes scanning", async () => {
  const f = fixture(), s = f.start(async () => { throw Error("Lookup unavailable"); }); await settle();
  f.scanners[0].decode("test"); await settle();
  assert.equal(f.phases[0], "lookup"); assert.equal(f.scanners[0].paused, false);
  await s.close();
});
test("close during pending lookup aborts and prevents stale result workflow", async () => {
  const f = fixture(), lookup = deferred<(() => void) | null>(); let workflows = 0;
  let signal: AbortSignal | undefined;
  const s = f.start(async (_text, value) => { signal = value; return lookup.promise; }); await settle();
  f.scanners[0].decode("test"); await s.close();
  assert.equal(signal?.aborted, true);
  lookup.resolve(() => { workflows++; }); await settle();
  assert.equal(workflows, 0); assert.equal(f.readers.length, 0);
});
test("draw failure stops the camera, timer, observer and visible canvas", async () => {
  const f = fixture(); f.failDraw = true; f.start(); await settle(); f.tick(); await settle();
  assert.equal(f.phases[0], "camera"); assert.equal(f.readers.length, 0);
  assert.equal(f.timers.size, 0);
});
test("failed library stop still stops tracks and releases next camera owner", async () => {
  const f = fixture(), first = f.start(); await settle();
  const track = f.scanners[0].reader.video!.srcObject.track;
  f.rejectStop = true; await assert.rejects(first.close(), /Stop failed/);
  assert.equal(track.readyState, "ended"); assert.equal(f.readers.length, 0);
  f.rejectStop = false; const second = f.start(); await settle(); await second.close();
});
test("ten consecutive opens and closes leave no readers, previews, timers or observers", async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) { const s = f.start(); await settle(); f.tick(); await s.close(); }
  assert.equal(f.stops, 10); assert.equal(f.readers.length, 0);
  assert.equal(f.timers.size, 0); assert.ok(f.observers.every(o => o.disconnected));
});
