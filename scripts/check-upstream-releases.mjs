#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATH_REMOTE = "https://github.com/inshell-art/path.git";
const THOUGHT_REMOTE = "https://github.com/inshell-art/THOUGHT.git";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(resolve(repoRoot, relativePath)))
    .digest("hex");
}

export function parseLsRemote(output) {
  return new Map(
    output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [object, ref] = line.trim().split(/\s+/, 2);
        return [ref, object];
      }),
  );
}

function remoteTags(remote) {
  try {
    return parseLsRemote(
      execFileSync("git", ["ls-remote", "--tags", remote], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error?.message || String(error);
    throw new Error(`Could not read upstream tags from ${remote}: ${detail}`);
  }
}

function tagTarget(tags, tag) {
  const direct = tags.get(`refs/tags/${tag}`);
  const dereferenced = tags.get(`refs/tags/${tag}^{}`);
  if (!direct) throw new Error(`Upstream tag is missing: ${tag}`);
  return { object: direct, target: dereferenced ?? direct };
}

export function latestPathTag(tags) {
  const candidates = [...tags.keys()]
    .map((ref) => /^refs\/tags\/(v(\d+)\.(\d+)\.(\d+))$/.exec(ref))
    .filter(Boolean)
    .map((match) => ({
      tag: match[1],
      version: [Number(match[2]), Number(match[3]), Number(match[4])],
    }));
  candidates.sort((left, right) => {
    for (let index = 0; index < 3; index += 1) {
      const difference = left.version[index] - right.version[index];
      if (difference) return difference;
    }
    return 0;
  });
  return candidates.at(-1)?.tag ?? null;
}

export function latestThoughtTag(tags) {
  const candidates = [...tags.keys()]
    .map((ref) =>
      /^refs\/tags\/(thought-v2-canonical-portable-release-(\d{8})-r(\d+))$/.exec(ref),
    )
    .filter(Boolean)
    .map((match) => ({ tag: match[1], date: Number(match[2]), revision: Number(match[3]) }));
  candidates.sort((left, right) => left.date - right.date || left.revision - right.revision);
  return candidates.at(-1)?.tag ?? null;
}

export function assertPathPublication(lock, tag, publication) {
  if (
    publication.object !== lock.releaseTagObject ||
    publication.target !== lock.releasePublicationCommit
  ) {
    throw new Error(
      `PATH ${tag} resolves to ${publication.object} -> ${publication.target}, ` +
        `but the consumer lock pins ${lock.releaseTagObject} -> ${lock.releasePublicationCommit}.`,
    );
  }
}

function checkPath() {
  const lock = readJson("packages/contracts/src/path-release/consumer-lock.json");
  const tags = remoteTags(PATH_REMOTE);
  const latest = latestPathTag(tags);
  if (!latest) throw new Error("PATH upstream exposes no semantic release tag.");
  if (latest !== lock.releaseTag) {
    throw new Error(
      `PATH upstream has ${latest}; the downstream lock is ${lock.releaseTag}. Review and import the upstream release before regenerating docs.`,
    );
  }
  const publication = tagTarget(tags, latest);
  assertPathPublication(lock, latest, publication);
  const manifestPath = `packages/contracts/src/path-release/releases/${latest}/manifest.json`;
  const manifestSha256 = sha256File(manifestPath);
  if (manifestSha256 !== lock.manifestSha256) {
    throw new Error(
      `PATH copied manifest digest is ${manifestSha256}; the consumer lock pins ${lock.manifestSha256}.`,
    );
  }
  return {
    project: "PATH",
    latest,
    tagObject: publication.object,
    target: publication.target,
    manifestSha256,
  };
}

function checkThought() {
  const lock = readJson("apps/thought/contract-release/consumer-lock.json");
  const tags = remoteTags(THOUGHT_REMOTE);
  const latest = latestThoughtTag(tags);
  if (!latest) throw new Error("THOUGHT upstream exposes no canonical portable release tag.");
  if (latest !== lock.sourceTag) {
    throw new Error(
      `THOUGHT upstream has ${latest}; the downstream lock is ${lock.sourceTag}. Review and import the upstream release before regenerating docs.`,
    );
  }
  const publication = tagTarget(tags, latest);
  if (publication.object !== lock.sourceTagObject || publication.target !== lock.sourceTagTarget) {
    throw new Error(
      `THOUGHT ${latest} resolves to ${publication.object} -> ${publication.target}, but the consumer lock pins ${lock.sourceTagObject} -> ${lock.sourceTagTarget}.`,
    );
  }
  const manifestPath = `apps/thought/contract-release/releases/${lock.artifactId}/manifest.json`;
  const manifestSha256 = sha256File(manifestPath);
  if (manifestSha256 !== lock.manifestSha256) {
    throw new Error(
      `THOUGHT copied manifest digest is ${manifestSha256}; the consumer lock pins ${lock.manifestSha256}.`,
    );
  }
  return {
    project: "THOUGHT",
    latest,
    tagObject: publication.object,
    target: publication.target,
    manifestSha256,
  };
}

function selectedProjects() {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
  if (only && !["path", "thought"].includes(only)) {
    throw new Error("--only must be path or thought");
  }
  return only ? [only] : ["path", "thought"];
}

function main() {
  const results = selectedProjects().map((project) =>
    project === "path" ? checkPath() : checkThought(),
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        check: "upstream-release-freshness",
        projects: results,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
