import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";

const previewUrl = "http://127.0.0.1:4173";
const root = resolve("dist/home");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function productionFile(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, previewUrl).pathname);
  const requested = resolve(root, `.${pathname}`);
  const relativeRequested = relative(root, requested);
  if (relativeRequested.startsWith("..")) return null;

  if (existsSync(requested) && statSync(requested).isFile()) return requested;

  const isThoughtRoute = pathname === "/thought" || pathname.startsWith("/thought/");
  return resolve(root, isThoughtRoute ? "thought/index.html" : "index.html");
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }

  try {
    const file = productionFile(request.url ?? "/");
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mimeTypes.get(extname(file)) ?? "application/octet-stream",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
});

function listen() {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", resolveListen);
  });
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

function close() {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

if (!existsSync(resolve(root, "index.html"))) {
  throw new Error("dist/home/index.html is missing; run pnpm build:home first");
}

await listen();
try {
  await run(
    "corepack",
    [
      "pnpm",
      "exec",
      "cypress",
      "run",
      "--config-file",
      "cypress/cypress.config.ts",
      "--spec",
      "cypress/e2e/app.cy.ts",
      "--browser",
      "electron",
    ],
    { env: { ...process.env, BASE_URL: previewUrl } },
  );
} finally {
  await close();
}
