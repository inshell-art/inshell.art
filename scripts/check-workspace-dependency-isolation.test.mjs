import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyWorkspaceDependencyIsolation } from "./check-workspace-dependency-isolation.mjs";

const writeJson = (filename, value) => {
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, `${JSON.stringify(value)}\n`);
};

const makeFixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "inshell-workspace-isolation-"));
  const shared = path.join(root, "packages/shared");
  const app = path.join(root, "apps/home");
  writeJson(path.join(shared, "package.json"), {
    name: "@inshell/shared",
  });
  writeJson(path.join(app, "package.json"), {
    name: "@inshell/home",
    dependencies: { "@inshell/shared": "workspace:*" },
  });
  mkdirSync(path.join(app, "node_modules/@inshell"), { recursive: true });
  return { app, root, shared };
};

test("accepts workspace links bound to the candidate root", () => {
  const fixture = makeFixture();
  try {
    symlinkSync(
      fixture.shared,
      path.join(fixture.app, "node_modules/@inshell/shared"),
    );
    assert.deepEqual(verifyWorkspaceDependencyIsolation(fixture.root), {
      packages: 2,
      verified: 1,
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects workspace links copied from another candidate", () => {
  const fixture = makeFixture();
  const donor = mkdtempSync(path.join(os.tmpdir(), "inshell-workspace-donor-"));
  try {
    writeJson(path.join(donor, "package.json"), { name: "@inshell/shared" });
    symlinkSync(donor, path.join(fixture.app, "node_modules/@inshell/shared"));
    assert.throws(
      () => verifyWorkspaceDependencyIsolation(fixture.root),
      /resolves outside this candidate/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
    rmSync(donor, { recursive: true, force: true });
  }
});
