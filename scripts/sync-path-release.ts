//
// Usage:
//   pnpm tsx scripts/sync-path-release.ts --net sepolia --from /path/to/fe-release
//
// Output:
//   packages/contracts/src/addresses/addresses.<net>.json
//   packages/contracts/src/releases/release.<net>.json
//   packages/contracts/src/abi/<net>/*.json

import { copyFileSync, readdirSync, readFileSync } from "fs";
import { basename, join, resolve } from "path";
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

const BANNED_TERMS = [
  "RESERVED_ROLE",
  "SPARK_BASE",
  "mintSparker",
  "getReservedCap",
  "getReservedRemaining",
  "reserved_cap",
] as const;

const REQUIRED_ABI_FUNCTIONS = new Set([
  "getCurrentPrice",
  "curveActive",
  "getConfig",
  "bid",
]);

type ProtocolRelease = {
  schema_version: number;
  protocol: string;
  network: string;
  chain_id: number;
  contracts: Record<string, string>;
  deploy_blocks: Record<string, number>;
  config?: Record<string, unknown>;
  status?: { ready_for_fe?: boolean; postconditions?: string };
};

function rejectDeprecatedSurface(file: string) {
  const text = readFileSync(file, "utf8");
  const banned = BANNED_TERMS.filter((term) => text.includes(term));
  if (banned.length) {
    throw new Error(
      `${file} contains deprecated PATH spark/reserved surface: ${banned.join(
        ", "
      )}`
    );
  }
}

function assertAddressMap(value: unknown): asserts value is AddrMap {
  if (!isAddrMap(value)) {
    throw new Error("Invalid addresses JSON shape");
  }
}

function assertProtocolRelease(
  value: unknown,
  net: Net
): asserts value is ProtocolRelease {
  const release = value as ProtocolRelease;
  if (!release || typeof release !== "object") {
    throw new Error("Invalid protocol release JSON shape");
  }
  if (release.schema_version !== 2) {
    throw new Error(
      `Unsupported protocol release schema_version: ${release.schema_version}`
    );
  }
  if (release.protocol !== "path") {
    throw new Error(`Unsupported protocol release: ${release.protocol}`);
  }
  if (release.network !== net) {
    throw new Error(`Protocol release network mismatch: ${release.network}`);
  }
  if (!Number.isInteger(release.chain_id) || release.chain_id < 0) {
    throw new Error("Protocol release chain_id is invalid");
  }
  if (release.status?.ready_for_fe !== true) {
    throw new Error("Protocol release is not marked ready_for_fe");
  }
  if (release.status?.postconditions !== "pass") {
    throw new Error("Protocol release postconditions are not pass");
  }
  const config = release.config ?? {};
  for (const key of ["k", "genesis_price", "genesis_floor", "pts"]) {
    if (typeof config[key] !== "string" || !String(config[key]).trim()) {
      throw new Error(`Protocol release config missing ${key}`);
    }
  }
}

function assertAbiSnapshot(file: string) {
  const abi = readJson<any[]>(file);
  if (!Array.isArray(abi)) {
    throw new Error(`ABI snapshot must be an array: ${file}`);
  }
  const functions = new Set(
    abi
      .filter((item) => item?.type === "function")
      .map((item) => String(item.name))
  );
  for (const name of REQUIRED_ABI_FUNCTIONS) {
    if (!functions.has(name)) {
      throw new Error(`PulseAuction ABI missing ${name}: ${file}`);
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
const pulseAbiFile = join(abiDir, "PulseAuction.json");

try {
  for (const file of [protocolFile, addressesFile, pulseAbiFile]) {
    rejectDeprecatedSurface(file);
  }

  const addresses = readJson(addressesFile);
  assertAddressMap(addresses);
  const normalizedAddresses = normalizeAddressMap(addresses);

  const release = readJson(protocolFile);
  assertProtocolRelease(release, net);

  for (const [key, value] of Object.entries(release.contracts)) {
    if (normalizedAddresses[key]?.toLowerCase() !== value.toLowerCase()) {
      throw new Error(`Release/address mismatch for ${key}`);
    }
  }
  if (release.deploy_blocks.pulse_auction == null) {
    throw new Error("Protocol release missing deploy_blocks.pulse_auction");
  }

  assertAbiSnapshot(pulseAbiFile);

  const addressesOut = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "addresses",
    `addresses.${net}.json`
  );
  const releaseOut = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "releases",
    `release.${net}.json`
  );
  const abiOutDir = resolve(
    process.cwd(),
    "packages",
    "contracts",
    "src",
    "abi",
    net
  );

  writeJson(addressesOut, normalizedAddresses);
  writeJson(releaseOut, release);
  ensureDir(abiOutDir);

  for (const name of readdirSync(abiDir)) {
    if (!name.endsWith(".json")) continue;
    const from = join(abiDir, name);
    rejectDeprecatedSurface(from);
    copyFileSync(from, join(abiOutDir, basename(name)));
  }

  console.log(`[path-release] wrote ${addressesOut}`);
  console.log(`[path-release] wrote ${releaseOut}`);
  console.log(`[path-release] copied ABI snapshots to ${abiOutDir}`);
} catch (err) {
  console.error("[path-release] ERROR:", (err as Error)?.message ?? err);
  process.exit(1);
}
