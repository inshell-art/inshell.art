import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { delimiter, join } from "node:path";

type ClaudeBinaryResolverOptions = {
  explicitPath?: string;
  pathValue?: string;
  homeDirectory: string;
};

export const isClaudeCodeAuthenticated = (statusOutput: string) => {
  try {
    const status = JSON.parse(statusOutput) as { loggedIn?: unknown };
    return status.loggedIn === true;
  } catch {
    return false;
  }
};

const isExecutable = async (candidate: string) => {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const compareVersionsDescending = (left: string, right: string) => {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] || 0) - (leftParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return right.localeCompare(left);
};

export const resolveClaudeCodeBinary = async ({
  explicitPath,
  pathValue,
  homeDirectory,
}: ClaudeBinaryResolverOptions): Promise<string | undefined> => {
  const explicit = explicitPath?.trim();
  if (explicit) return explicit;

  for (const pathDirectory of (pathValue || "").split(delimiter).filter(Boolean)) {
    const candidate = join(pathDirectory, "claude");
    if (await isExecutable(candidate)) return candidate;
  }

  const managedRoot = join(
    homeDirectory,
    "Library",
    "Application Support",
    "Claude",
    "claude-code",
  );
  let versions: string[] = [];
  try {
    versions = (await readdir(managedRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort(compareVersionsDescending);
  } catch {
    return undefined;
  }

  for (const version of versions) {
    const candidate = join(
      managedRoot,
      version,
      "claude.app",
      "Contents",
      "MacOS",
      "claude",
    );
    if (await isExecutable(candidate)) return candidate;
  }
  return undefined;
};
