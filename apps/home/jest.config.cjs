const defaults = require("jest-config").defaults;

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleFileExtensions: [...defaults.moduleFileExtensions, "ts", "tsx"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  coverageProvider: "v8",
  collectCoverage: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.d.ts",
    "!<rootDir>/src/main.tsx",
    "!<rootDir>/src/vite-env.d.ts",
    "!<rootDir>/src/types/**",
    "!<rootDir>/src/components/Footer/**",
    "!<rootDir>/src/components/PathMarketplaceLabPage.tsx",
    "!<rootDir>/src/components/Thought*.tsx",
    "!<rootDir>/src/services/thought*.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold:
    process.env.INSHELL_COVERAGE_GATE === "1"
      ? {
          global: {
            statements: 85,
            branches: 71,
            functions: 86,
            lines: 85,
          },
        }
      : undefined,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@inshell/(.*)$": "<rootDir>/../../packages/$1/src",
    "\\.md\\?url$": "<rootDir>/tests/fileMock.cjs",
    "\\.css$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
};
