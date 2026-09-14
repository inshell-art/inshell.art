import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const thoughtRoot = fileURLToPath(new URL("../apps/thought", import.meta.url));
const requireThought = createRequire(new URL("../apps/thought/package.json", import.meta.url));
const { resolveConfig } = await import(pathToFileURL(requireThought.resolve("vite")).href);
const publicApiKey = "VITE_THOUGHT_AGENT_PUBLIC_API_BASE";
const canonicalApi = "https://preview.inshell.art/api/thought-agent/v2";
const thoughtHtml = readFileSync(path.join(thoughtRoot, "index.html"), "utf8");

test("resolved THOUGHT builds confine the canonical Agent API default to Home staging", async (t) => {
  const cases = [
    { name: "Home staging", branch: "staging", expected: canonicalApi },
    { name: "feature preview", branch: "codex/feature", expected: undefined },
    { name: "production", branch: "main", expected: undefined },
    { name: "non-Pages build", branch: undefined, expected: undefined },
    { name: "standalone staging", branch: "staging", standalone: true, expected: undefined },
    { name: "explicit public origin", branch: "staging", override: "https://override.example/api", expected: "https://override.example/api" },
    { name: "explicit same-origin URL", branch: "staging", override: "/api/thought-agent/v2", expected: "/api/thought-agent/v2" },
    { name: "explicit empty override", branch: "staging", override: "", expected: "" },
    { name: "explicit production mode", branch: "staging", deployEnv: "production", expected: undefined },
  ];
  const controlledKeys = [
    "CF_PAGES_BRANCH",
    "VITE_DEPLOY_ENV",
    publicApiKey,
    "VITE_THOUGHT_ROUTE_BASE",
    "INSHELL_THOUGHT_OUT_DIR",
    "INSHELL_THOUGHT_USE_LOCKED_SURFACE",
    "NODE_ENV",
  ];
  const originalEnv = Object.fromEntries(controlledKeys.map((key) => [key, process.env[key]]));
  const originalCwd = process.cwd();
  try {
    process.chdir(thoughtRoot);
    for (const scenario of cases) {
      await t.test(scenario.name, async () => {
        for (const key of controlledKeys) delete process.env[key];
        if (scenario.branch !== undefined) process.env.CF_PAGES_BRANCH = scenario.branch;
        if (scenario.override !== undefined) process.env[publicApiKey] = scenario.override;
        if (scenario.deployEnv !== undefined) process.env.VITE_DEPLOY_ENV = scenario.deployEnv;
        if (!scenario.standalone) {
          process.env.VITE_THOUGHT_ROUTE_BASE = "/thought";
          process.env.INSHELL_THOUGHT_OUT_DIR = "../../dist/home/thought";
          process.env.INSHELL_THOUGHT_USE_LOCKED_SURFACE = "1";
        }
        const config = await resolveConfig({
          configFile: path.join(thoughtRoot, "vite.config.ts"),
          configLoader: "runner",
          logLevel: "silent",
        }, "build", "production");
        const publicEnv = JSON.parse(config.define["globalThis.__INSHELL_VITE_ENV__"]);
        assert.equal(publicEnv[publicApiKey], scenario.expected);
        assert.equal(config.build.outDir, path.resolve(thoughtRoot,
          scenario.standalone ? "../../dist/thought" : "../../dist/home/thought"));
        if (!scenario.standalone) {
          const bootstrap = config.plugins.find((plugin: { name: string }) =>
            plugin.name === "inshell-thought-locked-runtime-bootstrap");
          assert.ok(bootstrap, "Home embeds the locked THOUGHT bootstrap");
          const transformed = bootstrap.transformIndexHtml.handler(thoughtHtml, { path: "/thought/index.html" });
          const injectedEnv = transformed.tags[0].children.match(/globalThis\.__INSHELL_VITE_ENV__ = (.+);/);
          assert.ok(injectedEnv, "the HTML bootstrap embeds the resolved public environment");
          assert.deepEqual(JSON.parse(injectedEnv[1]), publicEnv);
        }
      });
    }
  } finally {
    process.chdir(originalCwd);
    for (const key of controlledKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
