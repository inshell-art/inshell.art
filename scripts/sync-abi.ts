// scripts/sync-abi.ts
//
// Pull ABIs from a live node (Devnet/Sepolia/Mainnet) and write:
//   1) src/abi/<net>/<NAME>.json
//   2) src/abi/by-class/<CLASS_HASH>.abi.json
//   3) src/abi/<net>/manifest.json
//
// Usage:
//   pnpm tsx scripts/sync-abi.ts --net devnet  --rpc http://127.0.0.1:5050 --addr addresses/addresses.devnet.json
//   pnpm tsx scripts/sync-abi.ts --net sepolia --rpc "$VITE_SEPOLIA_RPC"    --addr addresses/addresses.sepolia.json

import { validateAndParseAddress } from "starknet";
import {
  Net,
  AddrMap,
  assertNet,
  flag,
  required,
  readJson,
  writeJson,
  ensureDir,
  getFetch,
} from "./utils";
import { resolve } from "path";

// ---- CLI ----
const NET = required("--net");
assertNet(NET as string);
const net = NET as Net;

const RPC_URL = required("--rpc");
const ADDR_FILE = required("--addr");

const OUT_PER_NET_DIR = resolve(process.cwd(), `src/abi/${net}`);
const OUT_BY_CLASS_DIR = resolve(process.cwd(), `src/abi/by-class`);
const OUT_MANIFEST_FILE = resolve(
  process.cwd(),
  `src/abi/${net}/manifest.json`
);

ensureDir(OUT_PER_NET_DIR);
ensureDir(OUT_BY_CLASS_DIR);

// ---- Minimal JSON-RPC helper ----
let rpcId = 0;
async function rpcCall<T>(method: string, params: any): Promise<T> {
  const f = await getFetch();
  const res = await f(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const j = await res.json();
  if (j?.error)
    throw new Error(`[${method}] ${j.error.code}: ${j.error.message}`);
  return j.result as T;
}

// ---- Get numeric "latest" (works on strict devnets) ----
async function getLatestBlockNumber(): Promise<number> {
  try {
    // Most nodes support this
    const n = await rpcCall<number>("starknet_blockNumber", []);
    if (typeof n === "number") return n;
  } catch {}
  // Fallback: hash+number
  const hn = await rpcCall<{ block_hash: string; block_number: number }>(
    "starknet_blockHashAndNumber",
    []
  );
  return hn.block_number;
}

async function getClassAtAtBlock(address: string, block_number: number) {
  // Strict object shape with block_number
  return await rpcCall<any>("starknet_getClassAt", {
    block_id: { block_number },
    contract_address: address,
  });
}

async function getClassHashAtBlock(address: string, block_number: number) {
  const r = await rpcCall<any>("starknet_getClassHashAt", {
    block_id: { block_number },
    contract_address: address,
  });
  return (r?.class_hash ?? r) as string;
}

function safeName(s: string) {
  return s.replace(/[^A-Za-z0-9_]+/g, "_");
}

// ---- Main ----
(async () => {
  try {
    const addrs = readJson<AddrMap>(ADDR_FILE);
    const latest = await getLatestBlockNumber();
    console.log(`[abi-sync] using block_number=${latest}`);

    const manifest: Record<
      string,
      { address: string; classHash: string; file: string }
    > = {};

    for (const [nameRaw, addrRaw] of Object.entries(addrs)) {
      const name = safeName(nameRaw);
      const address = validateAndParseAddress(addrRaw); // -> 0x + 64-hex

      const [klass, classHash] = await Promise.all([
        getClassAtAtBlock(address, latest),
        getClassHashAtBlock(address, latest),
      ]);

      const abi = klass?.abi;
      if (!abi) throw new Error(`No ABI at ${address} (${name})`);

      const perNetFile = resolve(OUT_PER_NET_DIR, `${name}.json`);
      const byClassFile = resolve(OUT_BY_CLASS_DIR, `${classHash}.abi.json`);

      writeJson(perNetFile, abi);
      writeJson(byClassFile, abi);

      manifest[name] = { address, classHash, file: `./${name}.json` };

      console.log(
        `[abi-sync] ${net}:${name}\n` +
          `  address    ${address}\n` +
          `  classHash  ${classHash}\n` +
          `  -> ${perNetFile}`
      );
    }

    writeJson(OUT_MANIFEST_FILE, {
      network: net,
      block_number: latest,
      generatedAt: new Date().toISOString(),
      entries: manifest,
    });
    console.log(`[abi-sync] manifest -> ${OUT_MANIFEST_FILE}`);
  } catch (e: any) {
    console.error("[abi-sync] ERROR:", e?.message ?? e);
    process.exit(1);
  }
})();
