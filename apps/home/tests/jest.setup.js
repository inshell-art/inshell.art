/* eslint-env node */
/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { TextDecoder, TextEncoder } = require("node:util");

// Deployment workflows export public Vite build values at the job level. Tests
// inject their own values through __VITE_ENV__, so inherited build settings must
// not silently change fixture behavior or assertions.
for (const name of Object.keys(process.env)) {
  if (name.startsWith("VITE_")) delete process.env[name];
}

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

const originalInfo = console.info;
console.info = (...args) => {
  if (typeof args[0] === "string") {
    if (args[0].includes("Download the React DevTools")) return;
  }
  originalInfo(...args);
};

// jsdom does not implement Element.prototype.scrollIntoView. Provide an inert
// default so components that scroll to a fragment target can run; individual
// tests still override it with their own spy when they assert on the call.
if (typeof HTMLElement.prototype.scrollIntoView !== "function") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: function scrollIntoView() {},
  });
}
