// Shared helpers for CLI flags, I/O, env, fetch, and address normalization.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { validateAndParseAddress } from "starknet";

export type Net = "devnet" | "sepolia" | "mainnet";
export type AddrMap = Record<string, string>;

// ----- CLI flags -----
export function flag(k: string): string | undefined {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export function required(k: string): string {
  const v = flag(k);
  if (!v) throw new Error(`Missing ${k}`);
  return v;
}
export function assertNet(s: string): asserts s is Net {
  if (s !== "devnet" && s !== "sepolia" && s !== "mainnet") {
    throw new Error(`--net must be one of devnet|sepolia|mainnet, got: ${s}`);
  }
}

// ----- types & guards -----
export function isAddrMap(x: any): x is AddrMap {
  return (
    x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Object.values(x).every((v) => typeof v === "string")
  );
}

// ----- fs/json -----
export function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}
export function readJson<T = any>(file: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as T;
}
export function writeJson(file: string, data: unknown) {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(data, null, 2));
}

// ----- fetch (Node 18+ or node-fetch fallback) -----
export async function getFetch(): Promise<typeof fetch> {
  const f = (globalThis as any).fetch;
  if (f) return f;
  try {
    // @ts-ignore types optional
    const mod = await import("node-fetch");
    return (mod.default || mod) as unknown as typeof fetch;
  } catch {
    throw new Error(
      "No fetch available. Use Node 18+ or install `node-fetch` (pnpm add -D node-fetch)"
    );
  }
}
export async function fetchJson<T = any>(url: string): Promise<T> {
  const f = await getFetch();
  const res = await f(url);
  if (!res.ok)
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

// ----- address normalization -----
export function normalizeAddressMap(map: AddrMap): AddrMap {
  const out: AddrMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = validateAndParseAddress(v); // -> 0x + 64 hex, padded, throws if invalid
  }
  return out;
}
