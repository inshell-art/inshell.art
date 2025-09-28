//
// Usage:
//   pnpm tsx scripts/sync-addresses.ts --net devnet  --from ../path/output/addresses.devnet.json
//   pnpm tsx scripts/sync-addresses.ts --net sepolia --from ../path/output/addresses.sepolia.json
//   pnpm tsx scripts/sync-addresses.ts --net sepolia --url https://raw.githubusercontent.com/inshell-art/path/main/output/addresses.sepolia.json
//
// Output:
//   addresses/addresses.<net>.json   // values normalized to 0x + 64-hex

import {
  AddrMap,
  Net,
  assertNet,
  flag,
  required,
  isAddrMap,
  readJson,
  writeJson,
  fetchJson,
  normalizeAddressMap,
  ensureDir,
} from "./utils";
import { resolve } from "path";

const NET = required("--net");
assertNet(NET as string);
const net = NET as Net;

const SRC = flag("--from"); // local JSON file
const URL = flag("--url"); // remote JSON URL

const OUT_DIR = resolve(process.cwd(), "addresses");
const OUT = resolve(OUT_DIR, `addresses.${net}.json`);
ensureDir(OUT_DIR);

(async () => {
  try {
    if (SRC && URL) throw new Error("Provide only one source: --from OR --url");
    if (!SRC && !URL)
      throw new Error("Provide one source: --from <file> OR --url <http(s)>");

    let raw: unknown;
    if (SRC) raw = readJson(SRC);
    else raw = await fetchJson(URL!);

    if (!isAddrMap(raw))
      throw new Error(
        "Invalid addresses JSON shape (expected { key: '0x...' })"
      );

    const normalized = normalizeAddressMap(raw);
    writeJson(OUT, normalized);
    console.log(`[addresses] wrote ${OUT}`);
  } catch (e: any) {
    console.error("[addresses] ERROR:", e?.message ?? e);
    process.exit(1);
  }
})();
