import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertExecutableCommands,
  assertExactBytes,
  assertExactFileInventory,
  assertRequiredCommands,
  assertSafeRelativePath,
  parseSha256Sums,
  resolveRegularFileWithin,
  unexpectedGeneratedPaths,
  workflowRunCommands,
} from "./generate-agent-docs.ts";

import { DOCS_SOURCE } from "../apps/home/src/content/docs.ts";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

test("rejects tampered exact-byte artifacts", () => {
  const expected = "accepted artifact";
  assert.doesNotThrow(() =>
    assertExactBytes(Buffer.from(expected), { sha256: sha256(expected) }, "fixture"),
  );
  assert.throws(
    () => assertExactBytes(Buffer.from("tampered artifact"), { sha256: sha256(expected) }, "fixture"),
    /SHA-256 drift/,
  );
});

test("rejects unsafe relative paths", () => {
  for (const path of ["../secret", "nested/../../secret", "/absolute", "C:/secret", "nested\\file", "a//b", "."]) {
    assert.throws(
      () => assertSafeRelativePath(path, "fixture path"),
      /must be relative|drive prefix|unsafe path segment|POSIX/,
    );
  }
  assert.equal(assertSafeRelativePath("nested/file.json", "fixture path"), "nested/file.json");
});

test("rejects symlinks and non-files", () => {
  const root = mkdtempSync(join(tmpdir(), "inshell-docs-generator-"));
  try {
    writeFileSync(join(root, "target.json"), "{}\n", "utf8");
    symlinkSync(join(root, "target.json"), join(root, "link.json"));
    mkdirSync(join(root, "directory"));
    writeFileSync(join(root, "directory", "nested.json"), "{}\n", "utf8");
    symlinkSync(join(root, "directory"), join(root, "linked-directory"));

    assert.throws(
      () => resolveRegularFileWithin(root, "link.json", "fixture file"),
      /symbolic link/,
    );
    assert.throws(
      () => resolveRegularFileWithin(root, "directory", "fixture file"),
      /not a regular file/,
    );
    assert.throws(
      () => resolveRegularFileWithin(root, "linked-directory/nested.json", "fixture file"),
      /symbolic link/,
    );
    assert.equal(
      resolveRegularFileWithin(root, "target.json", "fixture file"),
      join(root, "target.json"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicate and traversing SHA256SUMS paths", () => {
  const digest = "a".repeat(64);
  assert.deepEqual(parseSha256Sums(`${digest}  artifact.json\n`, "fixture sums"), {
    "artifact.json": digest,
  });
  assert.throws(
    () => parseSha256Sums(`${digest}  artifact.json\n${digest}  artifact.json\n`, "fixture sums"),
    /duplicate path/,
  );
  assert.throws(
    () => parseSha256Sums(`${digest}  ../secret\n`, "fixture sums"),
    /unsafe path segment/,
  );
});

test("rejects extra release files and reports stale generated outputs", () => {
  assert.doesNotThrow(() =>
    assertExactFileInventory(["manifest.json", "checksums.json"], ["checksums.json", "manifest.json"], "fixture release"),
  );
  assert.throws(
    () =>
      assertExactFileInventory(
        ["manifest.json", "checksums.json", "stale.json"],
        ["manifest.json", "checksums.json"],
        "fixture release",
      ),
    /fixture release mismatch/,
  );
  assert.deepEqual(
    unexpectedGeneratedPaths(
      ["apps/home/public/docs/current.json", "apps/home/public/docs/stale.json"],
      new Set(["apps/home/public/docs/current.json"]),
    ),
    ["apps/home/public/docs/stale.json"],
  );
});

test("rejects weakened documentation gate commands", () => {
  assert.doesNotThrow(() =>
    assertRequiredCommands(
      "pnpm docs:check\npnpm check:upstream-releases\n",
      ["pnpm docs:check", "pnpm check:upstream-releases"],
      "fixture gate",
    ),
  );
  assert.throws(
    () =>
      assertRequiredCommands(
        "pnpm docs:check\n",
        ["pnpm docs:check", "pnpm check:upstream-releases"],
        "fixture gate",
      ),
    /fixture gate is missing required command: pnpm check:upstream-releases/,
  );
});

test("requires documentation gates in executable workflow steps", () => {
  const commands = workflowRunCommands(
    [
      "jobs:",
      "  build:",
      "    steps:",
      "      - name: Comment only",
      "        run: '# pnpm run check:upstream-releases'",
      "      - name: Real build",
      "        run: pnpm run build:home",
      "",
    ].join("\n"),
    "build",
    "fixture workflow",
  );
  assert.deepEqual(commands, [
    "# pnpm run check:upstream-releases",
    "pnpm run build:home",
  ]);
  assert.throws(
    () =>
      assertExecutableCommands(
        commands,
        ["pnpm run check:upstream-releases", "pnpm run build:home"],
        "fixture workflow/build",
      ),
    /missing executable command: pnpm run check:upstream-releases/,
  );
});

test("generates exact shared route metadata and a non-sensitive gate manifest", () => {
  const runtimeMetadata = JSON.parse(
    readFileSync(
      join(process.cwd(), "packages/shared/generated/docs-route-metadata.json"),
      "utf8",
    ),
  ) as { schema: string; topics: Record<string, { title: string; description: string }> };
  assert.equal(runtimeMetadata.schema, "inshell.docs.route-metadata.v1");
  assert.deepEqual(
    runtimeMetadata.topics,
    Object.fromEntries(
      DOCS_SOURCE.topics.map((topic) => [
        topic.slug,
        { title: topic.title, description: topic.summary },
      ]),
    ),
  );

  const gateManifest = JSON.parse(
    readFileSync(join(process.cwd(), "apps/home/public/docs/gate-manifest.json"), "utf8"),
  ) as { schema: string; gates: Array<Record<string, unknown>> };
  assert.equal(gateManifest.schema, "inshell.docs.gate-manifest.v1");
  assert.ok(gateManifest.gates.length >= 2);
  assert.deepEqual(
    Object.keys(gateManifest).sort(),
    ["gates", "schema"],
  );
  assert.equal(JSON.stringify(gateManifest).includes("secrets"), false);
});
