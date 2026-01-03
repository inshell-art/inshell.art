//
// Pull ABIs from a live node (Devnet/Sepolia/Mainnet) and write:
//   1) packages/contracts/src/abi/<net>/<ContractName>.json
//   2) packages/contracts/src/abi/by-class/<CLASS_HASH>.abi.json
//   3) packages/contracts/src/abi/<net>/manifest.json
//
// Usage:
//   pnpm tsx scripts/sync-abi.ts --net devnet  --rpc http://127.0.0.1:5050 --addr packages/contracts/src/addresses/addresses.devnet.json
//   pnpm tsx scripts/sync-abi.ts --net sepolia --rpc "$VITE_SEPOLIA_RPC"    --addr packages/contracts/src/addresses/addresses.sepolia.json

import { RpcProvider, validateAndParseAddress } from "starknet";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------- CLI flags ----------
const flag = (k: string) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const NET = flag("--net") as "devnet" | "sepolia" | "mainnet" | undefined;
const RPC = flag("--rpc");
const ADDR = flag("--addr"); // path to addresses.<net>.json (name -> address)
if (!NET || !RPC || !ADDR) {
  console.error(
    "Usage: --net <devnet|sepolia|mainnet> --rpc <url> --addr <file>"
  );
  process.exit(1);
}

// ---------- FS helpers ----------
function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}
function writeJson(path: string, data: unknown) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// ---------- Name helpers ----------
/** PascalCase from snake/kebab/UPPER_SNAKE, with small acronym fixes */
function toPascalCase(input: string): string {
  const base = input
    .replace(/^@/, "")
    .replace(/\.[tj]sx?$/, "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join("");
  return base
    .replace(/Nft\b/, "NFT")
    .replace(/Erc(\d+)/g, (_, d) => `ERC${d}`)
    .replace(/Src(\d+)/g, (_, d) => `SRC${d}`);
}

type AbiItem = { type?: string; name?: string; interface_name?: string };

/** Score candidates; prefer our own contract, down-rank OZ *Component */
function scoreName(
  candidate: { base: string; fqn?: string; iface?: string },
  key?: string
): number {
  const lowerKey = key?.toLowerCase();
  let s = 0;
  // prefer matches tied to our crate/key in the iface path or FQN
  if (lowerKey && candidate.iface?.toLowerCase().includes(lowerKey)) s += 6;
  if (lowerKey && candidate.fqn?.toLowerCase().includes(lowerKey)) s += 4;
  if (
    lowerKey &&
    candidate.base.toLowerCase().includes(lowerKey.replace(/_/g, ""))
  )
    s += 3;
  // prefer non-Component contract names
  if (/Component$/.test(candidate.base)) s -= 10;
  // prefer obvious domain names
  if (/Minter|Adapter|Auction|NFT$/i.test(candidate.base)) s += 2;
  return s;
}

/** Extract the likely ContractName from ABI, preferring impls and non-Component events */
function getContractNameFromAbi(
  abi: AbiItem[],
  key?: string
): string | undefined {
  // 1) Prefer impls like IPathNFTImpl → PathNFT (check interface_name to bias toward our crate/key)
  const implCandidates: { base: string; iface?: string }[] = [];
  for (const it of abi) {
    if (
      it?.type === "impl" &&
      typeof it.name === "string" &&
      /^I[A-Z][A-Za-z0-9]*Impl$/.test(it.name)
    ) {
      const base = it.name.replace(/^I/, "").replace(/Impl$/, "");
      implCandidates.push({ base, iface: it.interface_name });
    }
  }
  if (implCandidates.length) {
    implCandidates.sort((a, b) => scoreName(b, key) - scoreName(a, key));
    if (implCandidates[0].base) return implCandidates[0].base;
  }

  // 2) Look at ...::ContractName::Event; prefer non-*Component and paths that include our key
  const eventCandidates: { base: string; fqn: string }[] = [];
  for (const it of abi) {
    const n = it?.name;
    if (typeof n === "string") {
      const m = n.match(/::([A-Za-z][A-Za-z0-9_]*)::Event$/);
      if (m) eventCandidates.push({ base: m[1], fqn: n });
    }
  }
  if (eventCandidates.length) {
    eventCandidates.sort((a, b) => scoreName(b, key) - scoreName(a, key));
    if (eventCandidates[0].base) return eventCandidates[0].base;
  }

  return undefined;
}

function pickContractFileName(abi: AbiItem[], logicalKey: string): string {
  const fromAbi = getContractNameFromAbi(abi, logicalKey);
  const name = fromAbi ?? toPascalCase(logicalKey);
  return `${name}.json`;
}

// ---------- Load addresses ----------
const addrPath = resolve(process.cwd(), ADDR);
const addrMap = JSON.parse(readFileSync(addrPath, "utf8")) as Record<
  string,
  string
>;
const normalized: Record<string, string> = {};
for (const [k, v] of Object.entries(addrMap)) {
  normalized[k] = validateAndParseAddress(v);
}

// ---------- RPC ----------
const provider = new RpcProvider({ nodeUrl: RPC });

// ---------- Outputs ----------
const OUT_ABI_BY_NET_DIR = resolve(
  process.cwd(),
  "packages",
  "contracts",
  "src",
  "abi",
  NET
);
const OUT_ABI_BY_CLASS_DIR = resolve(
  process.cwd(),
  "packages",
  "contracts",
  "src",
  "abi",
  "by-class"
);
const OUT_MANIFEST_FILE = resolve(
  process.cwd(),
  "packages",
  "contracts",
  "src",
  "abi",
  NET,
  "manifest.json"
);
ensureDir(OUT_ABI_BY_NET_DIR);
ensureDir(OUT_ABI_BY_CLASS_DIR);

// ---------- Main ----------
(async () => {
  try {
    // getBlockNumber works across versions; manifest tolerates undefined
    let latest: number | undefined;
    try {
      latest = await provider.getBlockNumber();
    } catch {
      latest = undefined;
    }

    const manifest: Array<{
      key: string;
      address: string;
      class_hash: string;
      contract_file: string;
      by_class_file: string;
    }> = [];

    for (const [key, address] of Object.entries(normalized)) {
      // class hash at address (try both "latest" forms for devnet quirks)
      const classHash = await provider
        .getClassHashAt(address, "latest" as any)
        .catch(async () =>
          provider.getClassHashAt(address, { blockIdentifier: "latest" } as any)
        );

      // Fetch class → ABI (fallback to getClassAt if needed)
      const klass: any = await provider
        .getClass(classHash)
        .catch(async () => provider.getClassAt(address, "latest" as any));

      const abi = (klass?.abi ?? klass?.result?.abi) as AbiItem[];
      if (!Array.isArray(abi))
        throw new Error(`ABI missing for ${key} @ ${address}`);

      // by-class file (dedupe)
      const byClassFile = resolve(
        OUT_ABI_BY_CLASS_DIR,
        `${classHash}.abi.json`
      );
      writeJson(byClassFile, abi);

      // per-net, contract-centric filename (CamelCase)
      const contractFileName = pickContractFileName(abi, key);
      const outFile = resolve(OUT_ABI_BY_NET_DIR, contractFileName);
      writeJson(outFile, abi);

      console.log(
        `[abi-sync] ${key} → ${contractFileName} (class ${classHash})`
      );

      manifest.push({
        key,
        address,
        class_hash: classHash,
        contract_file: outFile.replace(resolve(process.cwd()) + "/", ""),
        by_class_file: byClassFile.replace(resolve(process.cwd()) + "/", ""),
      });
    }

    writeJson(OUT_MANIFEST_FILE, {
      network: NET,
      block_number: latest,
      generatedAt: new Date().toISOString(),
      entries: manifest,
    });
    console.log(`[abi-sync] manifest → ${OUT_MANIFEST_FILE}`);
  } catch (e: any) {
    console.error("[abi-sync] ERROR:", e?.message ?? e);
    process.exit(1);
  }
})();
