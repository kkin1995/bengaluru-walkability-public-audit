/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterFramework: [],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
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
  },
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "babel-jest",
      {
        presets: [
          ["next/babel", { "preset-react": { runtime: "automatic" } }],
        ],
      },
    ],
  },
  // Treat these file extensions as ESM test sources
  testMatch: [
    "**/__tests__/**/*.(ts|tsx|js|jsx)",
    "**/?(*.)+(spec|test).(ts|tsx|js|jsx)",
  ],
  // Don't transform node_modules EXCEPT packages that ship ES modules
  transformIgnorePatterns: ["/node_modules/(?!(exifr)/)"],
  // Collect coverage from these paths
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "!app/**/*.d.ts",
    "!app/globals.css",
    "!app/layout.tsx",
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};

module.exports = config;
