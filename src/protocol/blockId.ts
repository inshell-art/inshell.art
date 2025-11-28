/**
 * Types and helpers for block identifiers to normalize "pending" (default by starknet.js) to "latest" (default by devnet).
 */
import { BlockIdentifier } from "starknet";

export type StarkBlockId = BlockIdentifier;

export type SafeBlockId =
  | "latest"
  | "pre_confirmed"
  | "l1_accepted"
  | { block_hash: string }
  | { block_number: number };

const envCache: Record<string, any> | undefined =
  (globalThis as any).__VITE_ENV__;

function getEnv(name: string): any {
  return envCache?.[name];
}

export const DEFAULT_SAFE_TAG: Extract<SafeBlockId, string> =
  (getEnv("VITE_DEFAULT_BLOCK_TAG") as any) ?? "latest";

export function normalizeBlockId(id?: StarkBlockId): SafeBlockId {
  if (id == null || id === "pending") return DEFAULT_SAFE_TAG;
  return id as SafeBlockId;
}
