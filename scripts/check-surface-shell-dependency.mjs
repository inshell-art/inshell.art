import { readFileSync } from "node:fs";

const SURFACE_SHELL_SPEC = "git+https://github.com/inshell-art/surface-shell.git#0.1.0";
const SURFACE_SHELL_LOCK_TARBALL =
  "https://codeload.github.com/inshell-art/surface-shell/tar.gz/fbb3039416b3e01a24545aa4e9dada3399762550";

const thoughtPackage = JSON.parse(readFileSync("apps/thought/package.json", "utf8"));
const dependabotConfig = readFileSync(".github/dependabot.yml", "utf8");
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

invariant(
  thoughtPackage.dependencies?.["surface-shell"] === SURFACE_SHELL_SPEC,
  `apps/thought must pin surface-shell to ${SURFACE_SHELL_SPEC}`,
);

invariant(
  dependabotConfig.includes('dependency-name: "surface-shell"') &&
    dependabotConfig.includes("pnpm update surface-shell@<commit>") &&
    dependabotConfig.includes("pnpm run check:dependency-security"),
  "Dependabot must keep the Git-sourced surface-shell maintenance path visible.",
);

invariant(
  lockfile.includes(`specifier: ${SURFACE_SHELL_SPEC}`),
  `pnpm-lock.yaml must record the explicit surface-shell Git specifier ${SURFACE_SHELL_SPEC}`,
);

invariant(
  lockfile.includes(`version: ${SURFACE_SHELL_LOCK_TARBALL}`) &&
    lockfile.includes(`surface-shell@${SURFACE_SHELL_LOCK_TARBALL}:`),
  "pnpm-lock.yaml must keep surface-shell resolved to the tested 0.1.0 tag commit.",
);

console.log("surface-shell dependency source is explicit and manually maintained.");
