/* eslint-env node */
/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { TextDecoder, TextEncoder } = require("node:util");

Object.defineProperty(window.navigator, "userAgent", {
  value:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  writable: true,
});

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = () =>
    Promise.reject(new Error("fetch not implemented in tests"));
}

if (typeof globalThis.__VITE_ENV__ === "undefined") {
  globalThis.__VITE_ENV__ = {};
}
