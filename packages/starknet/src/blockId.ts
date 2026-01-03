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

export const DEFAULT_SAFE_TAG: Extract<SafeBlockId, string> = "latest";

export function normalizeBlockId(id?: StarkBlockId): SafeBlockId {
  if (id == null || id === "pending") return DEFAULT_SAFE_TAG;
  return id as SafeBlockId;
}
