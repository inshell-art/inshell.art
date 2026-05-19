//
// Usage:
//   pnpm tsx scripts/sync-thought-release.ts --net sepolia --from /path/to/fe-release
//
// Output:
//   packages/contracts/src/addresses/addresses.<net>.json
//   packages/contracts/src/releases/thought-release.<net>.json
//   packages/contracts/src/abi/<net>/*.json

import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import {
  assertNet,
  ensureDir,
  isAddrMap,
  normalizeAddressMap,
  readJson,
  required,
  writeJson,
  type AddrMap,
  type Net,
} from "./utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_KEYS = [
  "path_nft",
  "thought_nft",
  "thought_spec_registry",
  "thought_spec_registry_owner",
  "color_font_v1",
  "thought_previewer",
  "seed_generator",
] as const;

const REQUIRED_ABI_FUNCTIONS: Record<string, readonly string[]> = {
  ColorFontV1: ["data", "hash", "id", "version"],
  ThoughtNFT: [
    "mint",
    "tokenURI",
    "colorFontData",
    "colorFontHash",
    "thoughtSpecRegistry",
    "pathNft",
  ],
  ThoughtPreviewer: ["preview", "previewMetrics", "previewWithFuel"],
  ThoughtSpecRegistry: [
    "registerThoughtSpec",
    "validateThoughtSpec",
    "thoughtSpecText",
    "latestThoughtSpecId",
    "owner",
  ],
};

type Checksums = Record<string, string>;

type ThoughtProtocolRelease = {
  schema_version: number;
  protocol: string;
  network: string;
  chain_id: number;
  release_tier?: string;
  path_dependency?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  movement?: Record<string, unknown>;
  recommended_thought_spec?: Record<string, unknown>;
  deploy_txs?: Record<string, unknown>;
};

function asAddressMap(value: Record<string, unknown>): AddrMap {
  const out: AddrMap = {};
  for (const key of ADDRESS_KEYS) {
    const valueAtKey = value[key];
    if (typeof valueAtKey === "string") out[key] = valueAtKey;
  }
  return normalizeAddressMap(out);
}

function readExistingAddresses(file: string): AddrMap {
  if (!existsSync(file)) return {};
  const value = readJson(file);
  if (!isAddrMap(value)) {
    throw new Error(`Invalid existing address book shape: ${file}`);
  }
  return normalizeAddressMap(value);
}

function assertThoughtRelease(
  value: unknown,
  net: Net,
  addresses: AddrMap,
  existingAddresses: AddrMap
): asserts value is ThoughtProtocolRelease {
  const release = value as ThoughtProtocolRelease;
  if (!release || typeof release !== "object") {
    throw new Error("Invalid THOUGHT protocol release JSON shape");
  }
  if (release.schema_version !== 1) {
    throw new Error(
      `Unsupported THOUGHT release schema_version: ${release.schema_version}`
    );
  }
  if (release.protocol !== "thought") {
    throw new Error(`Unsupported protocol release: ${release.protocol}`);
  }
  if (release.network !== net) {
    throw new Error(`THOUGHT release network mismatch: ${release.network}`);
  }
  if (!Number.isInteger(release.chain_id) || release.chain_id < 0) {
    throw new Error("THOUGHT release chain_id is invalid");
  }
  if (!release.contracts || typeof release.contracts !== "object") {
    throw new Error("THOUGHT release missing contracts");
  }
  if (!release.path_dependency || typeof release.path_dependency !== "object") {
    throw new Error("THOUGHT release missing path_dependency");
  }
  if (!release.movement || typeof release.movement !== "object") {
    throw new Error("THOUGHT release missing movement");
  }
  if (
    release.movement.name !== "THOUGHT" ||
    release.movement.quota !== 1 ||
    release.movement.frozen !== true
  ) {
    throw new Error("THOUGHT movement must be THOUGHT quota=1 frozen=true");
  }
  if (
    release.path_dependency.pathNft !== addresses.path_nft ||
    release.contracts.path_nft !== addresses.path_nft
  ) {
    throw new Error("THOUGHT release PathNFT address mismatch");
  }
  if (
    existingAddresses.path_nft &&
    existingAddresses.path_nft.toLowerCase() !== addresses.path_nft.toLowerCase()
  ) {
    throw new Error("THOUGHT PathNFT does not match imported PATH address book");
  }
  const spec = release.recommended_thought_spec;
  if (!spec || typeof spec !== "object") {
    throw new Error("THOUGHT release missing recommended_thought_spec");
  }
  for (const key of ["name", "id", "hash", "sha256", "file"]) {
    if (typeof spec[key] !== "string" || !String(spec[key]).trim()) {
      throw new Error(`THOUGHT recommended spec missing ${key}`);
    }
  }
  if (!Number.isInteger(spec.byteLength) || Number(spec.byteLength) <= 0) {
    throw new Error("THOUGHT recommended spec byteLength is invalid");
  }
}

function assertAbiSnapshot(file: string, contractName: string) {
  const raw = readJson<Record<string, unknown> | unknown[]>(file);
  const abi = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { abi?: unknown }).abi)
      ? ((raw as { abi: unknown[] }).abi)
      : undefined;
  if (!abi) {
    throw new Error(`ABI snapshot must be an array or { abi: [...] }: ${file}`);
  }

  const functions = new Set(
    abi
      .filter(
        (item): item is { type?: unknown; name?: unknown } =>
          item != null && typeof item === "object"
      )
      .filter((item) => item.type === "function")
      .map((item) => String(item.name))
  );
  for (const name of REQUIRED_ABI_FUNCTIONS[contractName] ?? []) {
    if (!functions.has(name)) {
      throw new Error(`${contractName} ABI missing ${name}: ${file}`);
    }
  }
}

function sha256(file: string): string {
  return `0x${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

function assertChecksums(srcDir: string) {
  const checksumsFile = join(srcDir, "checksums.json");
  const checksums = readJson<Checksums>(checksumsFile);
  if (
    !checksums ||
    typeof checksums !== "object" ||
    Array.isArray(checksums)
  ) {
    throw new Error("Invalid checksums.json shape");
  }
  for (const [relativePath, expected] of Object.entries(checksums)) {
    const file = join(srcDir, relativePath);
    if (!existsSync(file)) {
      throw new Error(`checksums.json references missing file: ${relativePath}`);
    }
    const actual = sha256(file);
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`checksum mismatch for ${relativePath}`);
    }
  }
}

const netArg = required("--net");
assertNet(netArg);
const net = netArg as Net;
const srcDir = resolve(process.cwd(), required("--from"));
const protocolFile = join(srcDir, `protocol-release.${net}.json`);
const addressesFile = join(srcDir, `addresses.${net}.json`);
const abiDir = join(srcDir, "abi");

try {
  assertChecksums(srcDir);

  const rawAddresses = readJson<Record<string, unknown>>(addressesFile);
  if (!rawAddresses || typeof rawAddresses !== "object") {
    throw new Error("Invalid THOUGHT addresses JSON shape");
  }
  const thoughtAddresses = asAddressMap(rawAddresses);

  const addressesOut = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "addresses",
    `addresses.${net}.json`
  );
  const existingAddresses = readExistingAddresses(addressesOut);

  const release = readJson(protocolFile);
  assertThoughtRelease(release, net, thoughtAddresses, existingAddresses);

  for (const [key, value] of Object.entries(thoughtAddresses)) {
    if (
      key !== "path_nft" &&
      release.contracts?.[key]?.toString().toLowerCase() !==
        value.toLowerCase()
    ) {
      throw new Error(`THOUGHT release/address mismatch for ${key}`);
    }
  }

  for (const contractName of Object.keys(REQUIRED_ABI_FUNCTIONS)) {
    assertAbiSnapshot(join(abiDir, `${contractName}.json`), contractName);
  }

  const releaseOut = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "releases",
    `thought-release.${net}.json`
  );
  const abiOutDir = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "abi",
    net
  );

  const mergedAddresses = {
    ...existingAddresses,
    ...thoughtAddresses,
    payment_token: existingAddresses.payment_token ?? ZERO_ADDRESS,
  };
  writeJson(addressesOut, mergedAddresses);
  writeJson(releaseOut, release);
  ensureDir(abiOutDir);

  for (const name of readdirSync(abiDir)) {
    if (!name.endsWith(".json")) continue;
    copyFileSync(join(abiDir, name), join(abiOutDir, basename(name)));
  }

  console.log(`[thought-release] wrote ${addressesOut}`);
  console.log(`[thought-release] wrote ${releaseOut}`);
  console.log(`[thought-release] copied ABI snapshots to ${abiOutDir}`);
} catch (err) {
  console.error("[thought-release] ERROR:", (err as Error)?.message ?? err);
  process.exit(1);
}
