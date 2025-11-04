import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  HTMLElement: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
};

const testGlobals = {
  ...browserGlobals,
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  jest: "readonly",
  test: "readonly",
};

const nodeGlobals = {
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "readonly",
  require: "readonly",
};

const cypressGlobals = {
  cy: "readonly",
  Cypress: "readonly",
  describe: "readonly",
  it: "readonly",
  before: "readonly",
  after: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
};

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eslintPkgPath = require.resolve("eslint/package.json");
const eslintDir = path.dirname(eslintPkgPath);
const eslintRecommendedPath = path.join(
  eslintDir,
  "../@eslint/js/src/configs/eslint-recommended.js"
);
const eslintRecommended =
  require(eslintRecommendedPath)?.rules ?? Object.create(null);

const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const reactHooks = require("eslint-plugin-react-hooks");
const reactRefresh = require("eslint-plugin-react-refresh");

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".eslintrc.cjs"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...eslintRecommended,
      ...(tsPlugin.configs?.recommended?.rules ?? {}),
      ...(reactHooks.configs?.recommended?.rules ?? {}),
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "**/*.{config,scripts}.{js,ts}",
      "scripts/**/*.{js,ts}",
      "vite.config.ts",
      "jest.config.js",
      "cypress.config.ts",
      "cypress/**/*.{js,ts}",
    ],
    languageOptions: {
      globals: { ...browserGlobals, ...nodeGlobals, ...cypressGlobals },
    },
  },
  {
    files: [
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
      "**/*.{spec,test}.{js,jsx,ts,tsx}",
      "tests/**/*.{js,jsx,ts,tsx}",
    ],
    languageOptions: {
      globals: testGlobals,
    },
  },
];
