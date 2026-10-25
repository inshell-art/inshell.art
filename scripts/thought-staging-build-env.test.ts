import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ga4EnvironmentAllowed } from "../packages/shared/src/ga4-policy";

const thoughtRoot = fileURLToPath(new URL("../apps/thought", import.meta.url));
const requireThought = createRequire(new URL("../apps/thought/package.json", import.meta.url));
const { resolveConfig } = await import(pathToFileURL(requireThought.resolve("vite")).href);
const publicApiKey = "VITE_THOUGHT_AGENT_PUBLIC_API_BASE";
const thoughtHtml = readFileSync(path.join(thoughtRoot, "index.html"), "utf8");

test("resolved THOUGHT builds do not inject retired Agent API defaults", async (t) => {
  const cases = [
    { name: "Home staging", branch: "staging", expected: undefined },
    { name: "feature preview", branch: "codex/feature", expected: undefined },
    { name: "production", branch: "main", expected: undefined },
    { name: "non-Pages build", branch: undefined, expected: undefined },
    { name: "standalone staging", branch: "staging", standalone: true, expected: undefined },
    { name: "explicit public origin", branch: "staging", override: "https://override.example/api", expected: "https://override.example/api" },
    { name: "explicit same-origin URL", branch: "staging", override: "/api/thought-agent/v2", expected: "/api/thought-agent/v2" },
    { name: "explicit empty override", branch: "staging", override: "", expected: "" },
    { name: "explicit production mode", branch: "staging", deployEnv: "production", expected: undefined },
    { name: "GA4 preview forced off", branch: "staging", deployEnv: "preview", ga4: { enabled: "false", id: "" }, allowed: false, expected: undefined },
    { name: "GA4 production opt-in forwarded", branch: "main", deployEnv: "production", ga4: { enabled: "true", id: "G-LOCALONLY01" }, allowed: true, expected: undefined },
    { name: "GA4 standalone production opt-in forwarded", branch: "main", standalone: true, deployEnv: "production", ga4: { enabled: "true", id: "G-LOCALONLY01" }, allowed: true, expected: undefined },
    { name: "GA4 production missing ID closed", branch: "main", deployEnv: "production", ga4: { enabled: "true", id: "" }, allowed: false, expected: undefined },
    { name: "GA4 production invalid ID closed", branch: "main", deployEnv: "production", ga4: { enabled: "true", id: "invalid" }, allowed: false, expected: undefined },
    { name: "GA4 production disabled", branch: "main", deployEnv: "production", ga4: { enabled: "false", id: "" }, allowed: false, expected: undefined },
  ];
  const controlledKeys = [
    "CF_PAGES_BRANCH",
    "VITE_DEPLOY_ENV",
    "VITE_GA4_ENABLED",
    "VITE_GA4_MEASUREMENT_ID",
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
        // resolveConfig alone does not perform the Vite build CLI's NODE_ENV setup.
        process.env.NODE_ENV = "production";
        if (scenario.branch !== undefined) process.env.CF_PAGES_BRANCH = scenario.branch;
        if (scenario.override !== undefined) process.env[publicApiKey] = scenario.override;
        if (scenario.deployEnv !== undefined) process.env.VITE_DEPLOY_ENV = scenario.deployEnv;
        if (scenario.ga4) {
          process.env.VITE_GA4_ENABLED = scenario.ga4.enabled;
          process.env.VITE_GA4_MEASUREMENT_ID = scenario.ga4.id;
        }
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
        if (scenario.ga4) {
          assert.equal(publicEnv.VITE_GA4_ENABLED, scenario.ga4.enabled);
          assert.equal(publicEnv.VITE_GA4_MEASUREMENT_ID, scenario.ga4.id);
        }
        // Vite's import.meta.env includes built-in PROD/DEV in addition to public values.
        assert.equal(ga4EnvironmentAllowed({ ...config.env, ...publicEnv }, new URL("https://inshell.art/thought"), false), scenario.allowed ?? false);
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

test("resolved Home build modes forward GA4 public values but fail closed without production opt-in", async () => {
  const root = fileURLToPath(new URL("../apps/home", import.meta.url));
  const keys = ["CF_PAGES_BRANCH", "VITE_DEPLOY_ENV", "VITE_GA4_ENABLED", "VITE_GA4_MEASUREMENT_ID", "NODE_ENV"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const scenario of [
      { branch: "staging", deploy: "preview", enabled: "false", id: "", allowed: false },
      { branch: "main", deploy: "production", enabled: "true", id: "G-LOCALONLY01", allowed: true },
      { branch: "main", deploy: "production", enabled: "true", id: "", allowed: false },
      { branch: "main", deploy: "production", enabled: "true", id: "invalid", allowed: false },
      { branch: "main", deploy: "production", enabled: "false", id: "", allowed: false },
      { branch: "", deploy: "", enabled: "", id: "", allowed: false },
    ]) {
      for (const key of keys) delete process.env[key];
      process.env.NODE_ENV = "production";
      Object.assign(process.env, { CF_PAGES_BRANCH: scenario.branch, VITE_DEPLOY_ENV: scenario.deploy,
        VITE_GA4_ENABLED: scenario.enabled, VITE_GA4_MEASUREMENT_ID: scenario.id });
      const config = await resolveConfig({ configFile: path.join(root, "vite.config.ts"), configLoader: "runner", logLevel: "silent" }, "build", "production");
      const publicEnv = JSON.parse(config.define["globalThis.__INSHELL_VITE_ENV__"]);
      assert.equal(publicEnv.VITE_GA4_ENABLED, scenario.enabled);
      assert.equal(publicEnv.VITE_GA4_MEASUREMENT_ID, scenario.id);
      assert.equal(ga4EnvironmentAllowed({ ...config.env, ...publicEnv }, new URL("https://inshell.art/"), false), scenario.allowed);
      assert.equal(ga4EnvironmentAllowed({ ...config.env, ...publicEnv }, new URL("https://preview.inshell.art/"), false), false);
    }
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
