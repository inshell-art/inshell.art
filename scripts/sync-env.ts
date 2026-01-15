// Purpose: Write .env.<net>.local containing RPC and (optionally) addresses.
//          Use this to prep FE env for Vite. Secrets (RPC keys) stay local.
//
// Usage examples:
//   # with local addresses file (writes apps/home + apps/thought .env.<net>.local)
//   pnpm tsx scripts/sync-env.ts --net devnet  --rpc http://127.0.0.1:5050 --addr packages/contracts/src/addresses/addresses.devnet.json
//
//   # or fetch addresses from a URL you host
//   pnpm tsx scripts/sync-env.ts --net sepolia --rpc "$VITE_SEPOLIA_RPC" --addr-url https://.../addresses.sepolia.json
//
// Output:
//   apps/home/.env.<net>.local
//   apps/thought/.env.<net>.local
//   (gitignore these!)

import {
  AddrMap,
  Net,
  assertNet,
  flag,
  required,
  isAddrMap,
  readJson,
  fetchJson,
  normalizeAddressMap,
} from "./utils";
import { writeFileSync } from "fs";
import { resolve } from "path";

const NET = required("--net");
assertNet(NET as string);
const net = NET as Net;

const RPC = required("--rpc"); // may contain key => keep private (local .env)
const ADDR_FILE = flag("--addr"); // local addresses JSON
const ADDR_URL = flag("--addr-url"); // remote addresses JSON
const OUT = flag("--out"); // optional single output path

if (ADDR_FILE && ADDR_URL) {
  throw new Error("Provide only one addresses source: --addr OR --addr-url");
}
if (!ADDR_FILE && !ADDR_URL) {
  throw new Error("Provide addresses: --addr <file> OR --addr-url <http(s)>");
}

(async () => {
  try {
    // load addresses (public) then normalize
    let addrRaw: unknown;
    if (ADDR_FILE) addrRaw = readJson(ADDR_FILE);
    else addrRaw = await fetchJson(ADDR_URL!);

    if (!isAddrMap(addrRaw)) throw new Error("Invalid addresses JSON shape");
    const addrs = normalizeAddressMap(addrRaw);

    // write .env.<net>.local
    const targets = OUT
      ? [resolve(OUT)]
      : [
          resolve(`apps/home/.env.${net}.local`),
          resolve(`apps/thought/.env.${net}.local`),
        ];

    // RPC (private), always as STARKNET_RPC consumed uniformly
    const lines: string[] = [];
    lines.push(`VITE_STARKNET_RPC=${RPC}`);

    const toEnvName = (k: string) =>
      "VITE_" + k.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    for (const [k, v] of Object.entries(addrs)) {
      lines.push(`${toEnvName(k)}=${v}`);
    }
    lines.push(""); // trailing newline

    for (const outPath of targets) {
      writeFileSync(outPath, lines.join("\n"));
      console.log(`[env] wrote ${outPath}`);
    }
  } catch (e: any) {
    console.error("[env] ERROR:", e?.message ?? e);
    process.exit(1);
  }
})();
