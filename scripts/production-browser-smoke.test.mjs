import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("production gates execute the current built-browser smoke", () => {
  const rootPackage = JSON.parse(read("package.json"));
  assert.match(
    rootPackage.scripts["test:browser:production"],
    /run-production-browser-smoke\.mjs/,
  );
  assert.match(rootPackage.scripts["check:production"], /test:browser:production/);

  const runner = read("scripts/run-production-browser-smoke.mjs");
  assert.match(runner, /dist\/home/);
  assert.match(runner, /createServer/);
  assert.doesNotMatch(runner, /@inshell\/home["', ]+preview/);

  const testWorkflow = read(".github/workflows/test.yml");
  const deployWorkflow = read(".github/workflows/deploy-pages.yml");
  assert.match(
    testWorkflow,
    /Install Cypress browser binary[\s\S]*cypress install[\s\S]*cypress verify/,
  );
  assert.match(
    deployWorkflow,
    /Install Cypress browser binary[\s\S]*cypress install[\s\S]*cypress verify/,
  );
  assert.match(
    testWorkflow,
    /Build home[\s\S]*Run production browser smoke[\s\S]*test:browser:production/,
  );
  assert.match(
    deployWorkflow,
    /Build home[\s\S]*Run production browser smoke[\s\S]*test:browser:production[\s\S]*Deploy home to Cloudflare Pages/,
  );
});

test("browser smoke locks mobile Agent and wallet production behavior", () => {
  const spec = read("cypress/e2e/app.cy.ts");
  for (const required of [
    '"/path"',
    '"/path/1"',
    '"/thought/"',
    '"/thought/1"',
    '"/gallery"',
    '"/will"',
    "continue on desktop",
    "Rabby Wallet",
    "WalletConnect",
    "eth_requestAccounts",
    "TOUCH_TARGET_MIN",
    "scrollWidth",
  ]) {
    assert.ok(spec.includes(required), `missing production browser assertion: ${required}`);
  }
});
