/** @type {import('jest').Config} */

const sharedTransform = {
  "^.+\\.(ts|tsx|js|jsx)$": [
    "babel-jest",
    {
      presets: [
        ["next/babel", { "preset-react": { runtime: "automatic" } }],
      ],
    },
  ],
};

const sharedModuleNameMapper = {
  // Handle CSS imports (Tailwind / global CSS)
  "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
  // Handle Next.js path alias
  "^@/(.*)$": "<rootDir>/$1",
  // Mock next/dynamic to render the component synchronously in tests
  "^next/dynamic$": "<rootDir>/__mocks__/nextDynamic.js",
  // Mock react-leaflet entirely — Leaflet requires a real browser DOM
  "^react-leaflet$": "<rootDir>/__mocks__/reactLeaflet.js",
  // Mock leaflet (required in ReportsMap via require())
  "^leaflet$": "<rootDir>/__mocks__/leaflet.js",
};

const config = {
  // projects splits the test run into two isolated environments so that
  // middleware tests (which need Next.js edge-runtime globals like Request)
  // run under node, while all other tests continue to use jsdom.
  projects: [
    {
      // ── Project 1: Edge middleware tests ────────────────────────────────
      // next/server requires Web Fetch API globals (Request, Response, Headers)
      // that jsdom does not provide.  Running under node picks up the native
      // Node.js 18+ globals instead.
      displayName: "middleware",
      testEnvironment: "node",
      testMatch: ["<rootDir>/__tests__/middleware.test.ts"],
      transform: sharedTransform,
      moduleNameMapper: sharedModuleNameMapper,
      // Use a minimal setup file — jest.setup.ts references jsdom APIs
      // (HTMLCanvasElement, window) that do not exist in the node environment.
      setupFilesAfterEnv: ["<rootDir>/jest.setup.node.ts"],
      transformIgnorePatterns: ["/node_modules/(?!(exifr)/)"],
    },
    {
      // ── Project 2: All other tests (jsdom) ──────────────────────────────
      displayName: "jsdom",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testMatch: [
        "**/__tests__/**/*.(ts|tsx|js|jsx)",
        "**/?(*.)+(spec|test).(ts|tsx|js|jsx)",
      ],
      testPathIgnorePatterns: [
        "/node_modules/",
        "<rootDir>/__tests__/middleware.test.ts",
      ],
      transform: sharedTransform,
      moduleNameMapper: sharedModuleNameMapper,
      transformIgnorePatterns: ["/node_modules/(?!(exifr)/)"],
      collectCoverageFrom: [
        "app/**/*.{ts,tsx}",
        "!app/**/*.d.ts",
        "!app/globals.css",
        "!app/layout.tsx",
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
  ],
};

module.exports = config;
