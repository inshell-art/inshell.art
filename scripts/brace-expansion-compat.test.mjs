import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load } from "js-yaml";

// Exercise every minimatch version in the actual pnpm graph, including newer
// consumers of the overridden brace-expansion, rather than a fixed major list.
const store = fileURLToPath(new URL("../node_modules/.pnpm/", import.meta.url));
const lock = load(readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"));
const consumers = Object.keys(lock.packages).filter(name => /^minimatch@/.test(name));

test("all installed minimatch consumers of overridden brace-expansion are covered", () => {
  assert.ok(consumers.length > 0, "Expected applicable minimatch compatibility coverage");
  const overriddenVersions = new Set(Object.entries(lock.overrides)
    .filter(([name]) => name.startsWith("brace-expansion@"))
    .map(([, version]) => version));
  assert.ok(overriddenVersions.size > 0, "Expected brace-expansion overrides");
  for (const consumer of consumers) {
    const dependency = lock.snapshots[consumer]?.dependencies?.["brace-expansion"];
    assert.ok(dependency, `${consumer}: missing brace-expansion dependency coverage`);
    assert.ok(overriddenVersions.has(dependency.split("(")[0]), `${consumer}: dependency escaped the override`);
    const installed = JSON.parse(readFileSync(join(store, consumer, "node_modules/minimatch/package.json"), "utf8"));
    assert.equal(installed.name, "minimatch");
    assert.equal(installed.version, consumer.slice("minimatch@".length));
  }
});

for (const consumer of consumers) {
  const require = createRequire(join(store, consumer, "node_modules/minimatch/package.json"));
  const expand = require("brace-expansion");
  const minimatch = require("./");

  test(`${consumer}: callable CommonJS and complete named exports`, () => {
    assert.equal(typeof expand, "function");
    assert.equal(expand.expand, expand);
    assert.equal(expand.EXPANSION_MAX, 100_000);
    assert.equal(expand.EXPANSION_MAX_LENGTH, 4_000_000);
    assert.equal(expand.EXPANSION_MAX_DEPTH, 1_000);
    assert.equal(expand.EXPANSION_MAX_REWRITES, 1_000);
    assert.deepEqual(expand("src/{a,{b,c}}.{js,ts}"), ["src/a.js", "src/a.ts", "src/b.js", "src/b.ts", "src/c.js", "src/c.ts"]);
    assert.deepEqual(expand("{01..03}"), ["01", "02", "03"]);
    const match = typeof minimatch === "function" ? minimatch : minimatch.minimatch;
    assert.equal(match("src/b.ts", "src/{a,b}.{js,ts}"), true);
    assert.equal(match("src/c.ts", "src/{a,b}.{js,ts}"), false);
  });

  test(`${consumer}: compatibility shim retains security limits`, () => {
    assert.equal(expand("{1..100}", { max: 3 }).length, 3);
    const limited = expand("{aa,bb}{cc,dd}", { maxLength: 8 });
    assert.ok(limited.reduce((length, value) => length + value.length, 0) <= 8);
    const nested = "{".repeat(50) + "a,b" + "}".repeat(50);
    const rewritten = "{a}" + "}".repeat(50) + ",z}";
    // Upstream leaves over-budget patterns literal rather than expanding them.
    assert.deepEqual(expand(nested, { maxDepth: 10 }), [nested]);
    assert.deepEqual(expand(rewritten, { maxRewrites: 10 }), [rewritten]);
  });
}
