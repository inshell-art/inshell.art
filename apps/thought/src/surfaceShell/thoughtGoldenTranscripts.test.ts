import assert from "node:assert/strict";

import {
  createThoughtSurfaceShellAdapter,
  parseThoughtShellInput,
  redactThoughtShellInput,
  shouldRecordThoughtShellInput,
} from "./thoughtDispatcherAdapter";
import { defaultThoughtShellState, type ThoughtShellState } from "./thoughtShellState";

export const runThoughtShellAdapterTests = async () => {
  const state: ThoughtShellState = {
    ...defaultThoughtShellState(),
    route: "connect",
    routeConfigured: true,
    model: "openrouter/free",
  };
  const adapter = createThoughtSurfaceShellAdapter(() => state);

  const pathList = parseThoughtShellInput("  PATH   list  ");
  assert.equal(pathList.legacyHead, "path");
  assert.equal(pathList.rest, "list");
  assert.deepEqual(pathList.args, ["list"]);
  assert.deepEqual(pathList.canonicalPath, ["path", "list"]);

  const help = parseThoughtShellInput("?");
  assert.equal(help.legacyHead, "help");
  assert.deepEqual(help.canonicalPath, ["help"]);

  const colorFont = parseThoughtShellInput("font raw");
  assert.equal(colorFont.legacyHead, "color-font");
  assert.equal(colorFont.rest, "raw");
  assert.deepEqual(colorFont.canonicalPath, ["color-font", "raw"]);

  const thoughtView = parseThoughtShellInput("view THOUGHT 9");
  assert.equal(thoughtView.legacyHead, "view");
  assert.equal(thoughtView.rest, "THOUGHT 9");
  assert.deepEqual(thoughtView.canonicalPath, ["view", "THOUGHT"]);

  assert.equal(redactThoughtShellInput("config direct key sk-private"), "config direct key ********");
  assert.equal(shouldRecordThoughtShellInput("config direct key sk-private"), false);
  assert.equal(shouldRecordThoughtShellInput("config direct key clear"), true);

  const directHelp = await adapter.getBranchHelpLines("config direct");
  assert(
    directHelp.some((line) => line.includes("config direct key")),
    "config direct branch help should include key guidance",
  );
  assert(
    directHelp.some((line) => line.includes("config direct model")),
    "config direct branch help should include model guidance",
  );

  state.myBrainWaiting = true;
  assert.equal(adapter.isAllowedWhileMyBrainWaiting(adapter.resolve("run")), false);
  assert.equal(adapter.isAllowedWhileMyBrainWaiting(adapter.resolve("return YES")), true);
  assert.equal(adapter.isAllowedWhileMyBrainWaiting(adapter.resolve("cancel")), true);

  const completions = adapter.getCompletions("config ");
  assert(completions.includes("config direct"));
  assert(completions.includes("config local"));
};
