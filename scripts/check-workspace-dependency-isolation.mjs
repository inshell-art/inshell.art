import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKSPACE_DIRECTORIES = ["apps", "packages"];
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

const readPackage = (filename) => JSON.parse(readFileSync(filename, "utf8"));

const isSamePath = (left, right) =>
  process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;

export function verifyWorkspaceDependencyIsolation(root = process.cwd()) {
  const realRoot = realpathSync(root);
  const packages = new Map();
  const consumers = [];

  for (const directory of WORKSPACE_DIRECTORIES) {
    const workspaceDirectory = path.join(realRoot, directory);
    if (!existsSync(workspaceDirectory)) continue;
    for (const entry of readdirSync(workspaceDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageDirectory = path.join(workspaceDirectory, entry.name);
      const manifestPath = path.join(packageDirectory, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = readPackage(manifestPath);
      if (typeof manifest.name === "string") {
        packages.set(manifest.name, realpathSync(packageDirectory));
      }
      consumers.push({ manifest, packageDirectory });
    }
  }

  const failures = [];
  let verified = 0;
  for (const { manifest, packageDirectory } of consumers) {
    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = manifest[field];
      if (!dependencies || typeof dependencies !== "object") continue;
      for (const dependencyName of Object.keys(dependencies)) {
        const expected = packages.get(dependencyName);
        if (!expected) continue;
        const installed = path.join(packageDirectory, "node_modules", dependencyName);
        if (!existsSync(installed)) {
          failures.push(`${manifest.name}: missing workspace dependency ${dependencyName}`);
          continue;
        }
        const actual = realpathSync(installed);
        if (!isSamePath(actual, expected)) {
          failures.push(
            `${manifest.name}: ${dependencyName} resolves outside this candidate (${actual})`,
          );
          continue;
        }
        verified += 1;
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Workspace dependency isolation failed:\n${failures.join("\n")}`);
  }

  return { packages: packages.size, verified };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = verifyWorkspaceDependencyIsolation();
  process.stdout.write(
    `Workspace dependency isolation passed (${result.verified} links across ${result.packages} packages).\n`,
  );
}
