import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

export const THOUGHT_DEV_SNAPSHOT_QUERY_PARAM = "inshell-thought-dev-snapshot";
export const THOUGHT_DEV_SNAPSHOT_QUERY_VALUE = "da998e1";

export const THOUGHT_DEV_INDEX_SNAPSHOT = Object.freeze({
  tag: "thought-app-e2e-integration-20260810-r1",
  tagCommit: "da998e1145d20b4a7301aaa61748c68fbc91a2e1",
  immutableDeployment: "https://9f8ac359.inshell-art.pages.dev/thought/",
  securityHardenedPreviewCommit: "bdd9640f7a2969b3b7a27a1c81c11a0b94df4b4f",
  indexBlob: "ac5a07c18176a6e8e05984e30840c1925e3149b9",
  indexSha256: "e991fe996e1732aca3ec6d9f77a9cac73609505ba29128c7892afabaa9908164",
  mainBlob: "0366396bcfaac34b1ad770b37a6cb8e117ff4406",
  mainSha256: "ffbfd1f2a7818c68aec6e07096c4be80c9df4dfdda0df23f2d4fd01563c7e939",
  styleBlob: "5d5448e8766bf4f32d1867e1534ce73797465de5",
  styleSha256: "950156fb82ff9d4449dfb03e914445eeeace10de0796361108e29e5637a48cf1",
});

const SNAPSHOT_FILES = Object.freeze({
  main: Object.freeze({
    path: "apps/thought/src/main.ts",
    blob: THOUGHT_DEV_INDEX_SNAPSHOT.mainBlob,
    sha256: THOUGHT_DEV_INDEX_SNAPSHOT.mainSha256,
  }),
  style: Object.freeze({
    path: "apps/thought/src/style.css",
    blob: THOUGHT_DEV_INDEX_SNAPSHOT.styleBlob,
    sha256: THOUGHT_DEV_INDEX_SNAPSHOT.styleSha256,
  }),
});

const POST_SNAPSHOT_SURFACE_ROUTER = `      const requestedSurface = params.get("surface");
      const useDevAgentDefault =
        requestedSurface === null &&
        globalThis.__INSHELL_THOUGHT_DEV_DEFAULT_SURFACE__ === "agent";
      const isCliSurface =
        params.get("debug") === "cli" ||
        requestedSurface === "cli" ||
        (requestedSurface !== "agent" && !useDevAgentDefault);
      document.documentElement.classList.add(isCliSurface ? "cli-surface" : "agent-surface");
`;

const POST_SNAPSHOT_SURFACE_NAV = `        <nav class="thought-create__links" aria-label="THOUGHT creation surfaces">
          <a href="/thought?surface=cli">[ cli ]</a>
          <a href="/thought?surface=agent">[ Agent ]</a>
          <a href="/thought/verify">[ verify ]</a>
        </nav>
`;

const POST_SNAPSHOT_CLI_TITLE =
  `          <h1 class="frontpage-title thought-cli-title">THOUGHT</h1>\n`;

const POST_SNAPSHOT_INDEX_FRAGMENTS = [
  ["surface router", POST_SNAPSHOT_SURFACE_ROUTER],
  ["surface navigation", POST_SNAPSHOT_SURFACE_NAV],
  ["CLI title", POST_SNAPSHOT_CLI_TITLE],
];

function removeExactlyOnce(html, label, fragment) {
  const first = html.indexOf(fragment);
  const last = html.lastIndexOf(fragment);
  if (first === -1 || first !== last) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected exactly one ${label} delta`,
    );
  }
  return `${html.slice(0, first)}${html.slice(first + fragment.length)}`;
}

function replaceExactlyOnce(source, label, from, to) {
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected exactly one ${label}`,
    );
  }
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

function verifySnapshotBytes(label, source, expectedSha256) {
  const digest = createHash("sha256").update(source).digest("hex");
  if (digest !== expectedSha256) {
    throw new Error(
      `Refusing unverified THOUGHT ${label} snapshot: expected ${expectedSha256}, received ${digest}`,
    );
  }
  return source;
}

/**
 * Reverses only the three known post-tag index deltas. The resulting bytes must
 * match the immutable tagged index before Vite may serve them as the dev UI.
 */
export function restoreThoughtDevIndexSnapshot(html) {
  const restored = POST_SNAPSHOT_INDEX_FRAGMENTS.reduce(
    (current, [label, fragment]) => removeExactlyOnce(current, label, fragment),
    html,
  );
  verifySnapshotBytes("index", restored, THOUGHT_DEV_INDEX_SNAPSHOT.indexSha256);

  const query = `${THOUGHT_DEV_SNAPSHOT_QUERY_PARAM}=${THOUGHT_DEV_SNAPSHOT_QUERY_VALUE}`;
  return [
    ["tagged stylesheet reference", 'href="/src/style.css"', `href="/src/style.css?${query}"`],
    ["tagged main reference", 'src="/src/main.ts"', `src="/src/main.ts?${query}"`],
  ].reduce(
    (current, [label, from, to]) => replaceExactlyOnce(current, label, from, to),
    restored,
  );
}

export function loadThoughtDevSnapshotFile(workspaceRoot, fileKey) {
  const snapshotFile = SNAPSHOT_FILES[fileKey];
  if (!snapshotFile) {
    throw new Error(`Unknown THOUGHT dev snapshot file: ${fileKey}`);
  }
  let source;
  try {
    source = execFileSync("git", ["cat-file", "blob", snapshotFile.blob], {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot load immutable THOUGHT ${fileKey} blob ${snapshotFile.blob}: ${detail}`,
    );
  }
  return verifySnapshotBytes(fileKey, source, snapshotFile.sha256);
}

export function loadThoughtDevSnapshotModule(workspaceRoot, id) {
  const queryStart = id.indexOf("?");
  if (queryStart === -1) return null;
  const query = new URLSearchParams(id.slice(queryStart + 1));
  if (
    query.get(THOUGHT_DEV_SNAPSHOT_QUERY_PARAM) !==
    THOUGHT_DEV_SNAPSHOT_QUERY_VALUE
  ) {
    return null;
  }

  const requestedPath = path.resolve(id.slice(0, queryStart));
  const fileKey = Object.entries(SNAPSHOT_FILES).find(([, file]) =>
    requestedPath === path.resolve(workspaceRoot, file.path)
  )?.[0];
  if (!fileKey) {
    throw new Error(`Unexpected THOUGHT snapshot module request: ${id}`);
  }
  return loadThoughtDevSnapshotFile(workspaceRoot, fileKey);
}

export function shouldRestoreThoughtDevIndexSnapshot(originalUrl, path) {
  const requestUrl = new URL(originalUrl || path || "/", "http://thought.local");
  const normalizedPath = requestUrl.pathname.replace(/\/+$/, "") || "/";
  const requestedSurface = requestUrl.searchParams.get("surface");
  return (
    (normalizedPath === "/" || normalizedPath === "/thought") &&
    requestUrl.searchParams.get("debug") !== "cli" &&
    (requestedSurface === null || requestedSurface === "agent")
  );
}
