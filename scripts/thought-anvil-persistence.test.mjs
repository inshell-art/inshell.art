import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./start-thought-anvil.mjs", import.meta.url),
  "utf8",
);

test("THOUGHT Anvil persists on shutdown without periodic full-state dumps", () => {
  assert.match(source, /"--state",\s*\n\s*THOUGHT_ANVIL_STATE_FILE/);
  assert.doesNotMatch(source, /--state-interval/);
});
