import { defaults } from "jest-config";

export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleFileExtensions: [...defaults.moduleFileExtensions, "ts", "tsx"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.css$": "identity-obj-proxy",
  },

  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
};
