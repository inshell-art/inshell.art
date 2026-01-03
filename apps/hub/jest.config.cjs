const defaults = require("jest-config").defaults;

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleFileExtensions: [...defaults.moduleFileExtensions, "ts", "tsx"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    "<rootDir>/src/App.tsx",
    "<rootDir>/src/components/AuctionCanvas.tsx",
    "<rootDir>/src/components/Movements.tsx",
    "<rootDir>/../../packages/utils/src/pulse/**/*.{ts,tsx}",
    "<rootDir>/../../packages/utils/src/num/**/*.{ts,tsx}",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text-summary", "lcov"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@inshell/(.*)$": "<rootDir>/../../packages/$1/src",
    "\\.css$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
};
