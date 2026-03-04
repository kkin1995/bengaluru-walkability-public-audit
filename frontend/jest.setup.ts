import "@testing-library/jest-dom";

// ── Global browser API stubs ────────────────────────────────────────────────

// jest-environment-jsdom v29 with jsdom 20 does not include fetch.
// Tests use jest.spyOn(global, "fetch") so we must install a stub first.
// Individual tests override this with mockResolvedValueOnce etc.
if (typeof global.fetch === "undefined") {
  global.fetch = jest.fn() as unknown as typeof global.fetch;
}

// URL.createObjectURL / revokeObjectURL are not implemented in jsdom.
// PhotoCapture uses them to build preview src values.
if (typeof window !== "undefined") {
  window.URL.createObjectURL = jest.fn(() => "blob:mock-url");
  window.URL.revokeObjectURL = jest.fn();
}

// navigator.share — not present in jsdom
Object.defineProperty(global.navigator, "share", {
  value: undefined,
  writable: true,
  configurable: true,
});

// navigator.clipboard — not present in jsdom
Object.defineProperty(global.navigator, "clipboard", {
  value: { writeText: jest.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

// window.alert — jsdom does not implement alert
window.alert = jest.fn();

// HTMLCanvasElement.getContext stub — jsdom provides no canvas rendering
// Tests that exercise compressImage will replace toBlob via prototype.
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// HTMLCanvasElement.toBlob default stub — returns a small blob that is
// UNDER the 10 MB limit.  Individual tests may override this on the prototype.
HTMLCanvasElement.prototype.toBlob = jest.fn(
  (callback: BlobCallback, _type?: string, _quality?: number) => {
    // 1-byte blob — always passes the size check
    callback(new Blob(["x"], { type: "image/jpeg" }));
  }
);

// HTMLImageElement onload — jsdom does not fire load events for object URLs.
// Patch the setter so it fires synchronously when src is set.
const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "src"
);
Object.defineProperty(HTMLImageElement.prototype, "src", {
  set(value: string) {
    if (originalImageSrcDescriptor?.set) {
      originalImageSrcDescriptor.set.call(this, value);
    }
    // Fire onload synchronously so compressImage's Promise resolves in tests
    if (this.onload) {
      (this.onload as EventListener)(new Event("load"));
    }
  },
  get() {
    return originalImageSrcDescriptor?.get?.call(this) ?? "";
  },
  configurable: true,
});

// ── Reset all mocks between tests ───────────────────────────────────────────
// Use afterEach so mock implementations set in beforeEach are not cleared
// before the test runs. clearAllMocks() only clears call history (not impls).
afterEach(() => {
  jest.clearAllMocks();
});
