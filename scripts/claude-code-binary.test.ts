import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  isClaudeCodeAuthenticated,
  resolveClaudeCodeBinary,
} from "./lib/claude-code-binary";

test("requires Claude Code auth status to explicitly report loggedIn true", () => {
  assert.equal(isClaudeCodeAuthenticated('{"loggedIn":true}'), true);
  assert.equal(isClaudeCodeAuthenticated('{"loggedIn":false}'), false);
  assert.equal(isClaudeCodeAuthenticated("not json"), false);
});

const executable = async (path: string) => {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(path, 0o755);
};

test("resolves explicit, PATH, then the latest native Claude Desktop installation", async () => {
  const root = await mkdtemp(join(tmpdir(), "inshell-claude-resolver-"));
  try {
    const pathBinary = join(root, "bin", "claude");
    const managedBinary = (version: string) => join(
      root,
      "Library",
      "Application Support",
      "Claude",
      "claude-code",
      version,
      "claude.app",
      "Contents",
      "MacOS",
      "claude",
    );
    await executable(pathBinary);
    await executable(managedBinary("2.1.99"));
    await executable(managedBinary("2.1.229"));

    assert.equal(await resolveClaudeCodeBinary({
      explicitPath: "/operator/claude",
      pathValue: join(root, "bin"),
      homeDirectory: root,
    }), "/operator/claude");
    assert.equal(await resolveClaudeCodeBinary({
      pathValue: join(root, "bin"),
      homeDirectory: root,
    }), pathBinary);
    assert.equal(await resolveClaudeCodeBinary({
      pathValue: "",
      homeDirectory: root,
    }), managedBinary("2.1.229"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not mistake Claude's Linux VM binary for the native host CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "inshell-claude-resolver-"));
  try {
    await executable(join(
      root,
      "Library",
      "Application Support",
      "Claude",
      "claude-code-vm",
      "2.1.229",
      "claude",
    ));
    assert.equal(await resolveClaudeCodeBinary({
      pathValue: "",
      homeDirectory: root,
    }), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
