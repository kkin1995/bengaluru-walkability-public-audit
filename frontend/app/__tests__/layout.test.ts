/**
 * Tests for frontend/app/layout.tsx — Next.js metadata / viewport exports.
 *
 * Requirements covered:
 *   F1.1 — layout.tsx exports a named `viewport` object (type Viewport from "next")
 *   F1.2 — `viewport` export contains `themeColor`
 *   F1.3 — `metadata` export does NOT contain a `viewport` key
 *   F1.4 — `metadata` export does NOT contain a `themeColor` key
 *
 * Why these tests exist:
 *   Next.js 14+ deprecated mixing `viewport` and `themeColor` inside the
 *   `Metadata` object. They must be exported as a separate `Viewport` named
 *   export. The current layout.tsx places both keys inside `metadata`, which
 *   triggers deprecation warnings and will break in future Next.js versions.
 *
 * Mocking strategy:
 *   layout.tsx imports "./globals.css" which is aliased to a style mock via
 *   jest.config.js moduleNameMapper — no additional mocking is required here.
 *   The default export (RootLayout component) is not exercised by these tests.
 */

// layout.tsx is excluded from coverage collection (jest.config.js line 40)
// but it is still importable for named-export contract tests.
import { metadata, viewport } from "../layout";

// ─────────────────────────────────────────────────────────────────────────────
// F1.1 — viewport named export exists and is an object
// ─────────────────────────────────────────────────────────────────────────────
describe("F1.1 — layout exports a named viewport object", () => {
  it("viewport named export is defined", () => {
    expect(viewport).toBeDefined();
  });

  it("viewport named export is a plain object (not null, not a primitive)", () => {
    expect(typeof viewport).toBe("object");
    expect(viewport).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F1.2 — viewport export contains themeColor
// ─────────────────────────────────────────────────────────────────────────────
describe("F1.2 — viewport export contains themeColor", () => {
  it("viewport has a themeColor property", () => {
    // themeColor must live in the Viewport export, not in metadata.
    // Without this, Next.js cannot inject the correct <meta name="theme-color"> tag.
    expect(viewport).toHaveProperty("themeColor");
  });

  it("viewport.themeColor is a non-empty string or array (valid Next.js Viewport shape)", () => {
    const { themeColor } = viewport as { themeColor: unknown };
    const isValid =
      (typeof themeColor === "string" && themeColor.length > 0) ||
      Array.isArray(themeColor);
    expect(isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F1.3 — metadata does NOT contain a viewport key
// ─────────────────────────────────────────────────────────────────────────────
describe("F1.3 — metadata does not contain viewport key", () => {
  it("metadata object does not have a 'viewport' property", () => {
    // Next.js 14 treats `viewport` inside Metadata as a deprecated field.
    // The property must be absent so no deprecation warning is raised.
    expect(metadata).not.toHaveProperty("viewport");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F1.4 — metadata does NOT contain a themeColor key
// ─────────────────────────────────────────────────────────────────────────────
describe("F1.4 — metadata does not contain themeColor key", () => {
  it("metadata object does not have a 'themeColor' property", () => {
    // themeColor must live in the Viewport export, not in Metadata.
    // Having it in both places produces duplicate <meta> tags.
    expect(metadata).not.toHaveProperty("themeColor");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression guard — mandatory metadata fields must still be present
// ─────────────────────────────────────────────────────────────────────────────
describe("metadata still contains required SEO fields after refactor", () => {
  it("metadata.title is defined and non-empty", () => {
    // Guard: refactoring viewport/themeColor must not accidentally drop title.
    expect(metadata.title).toBeTruthy();
  });

  it("metadata.description is defined and non-empty", () => {
    expect(metadata.description).toBeTruthy();
  });
});
