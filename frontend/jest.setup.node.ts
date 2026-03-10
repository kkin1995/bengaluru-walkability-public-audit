/**
 * Minimal Jest setup for tests running in the `node` environment.
 *
 * The main jest.setup.ts references jsdom-specific globals (HTMLCanvasElement,
 * window) that do not exist in the node environment.  This file installs only
 * the custom matcher extensions that the middleware test suite requires.
 */

// ── Custom matcher extensions ────────────────────────────────────────────────
// Some test assertions pass an optional documentation message string as a
// positional argument to built-in matchers (e.g. toBeNull("reason")).
// Jest 29's built-in matchers throw "Matcher error: this matcher must not have
// an expected argument" when receiving unexpected arguments.  These extensions
// override the built-in matchers to silently accept and ignore the optional
// message string, preserving the null/undefined check semantics.
expect.extend({
  toBeNull(received: unknown, _message?: string) {
    const pass = received === null;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be null`
          : `expected null, received ${String(received)}`,
    };
  },
  toBeUndefined(received: unknown, _message?: string) {
    const pass = received === undefined;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be undefined`
          : `expected undefined, received ${String(received)}`,
    };
  },
});
