import type { ThoughtGalleryItem } from "./thoughtGallery";
import thoughtContractIntegrationLock from "../../../thought/contract-integration/current/integration-lock.json";
import thoughtContractSelectedSpecUrl from "../../../thought/contract-integration/current/thought.selected-spec.md?url";

function getEnvValue(name: string): unknown {
  const runtimeEnv: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, unknown> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env as
    | Record<string, unknown>
    | undefined;
  return runtimeEnv?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

export function resolveThoughtSpecHref(item: ThoughtGalleryItem): string | null {
  const ref = item.thoughtSpecRef?.trim() ?? "";
  if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;
  const isDevnet =
    String(getEnvValue("VITE_NETWORK") ?? "").trim().toLowerCase() === "devnet";
  if (isDevnet) {
    const selectedSpec =
      thoughtContractIntegrationLock.runtimeBaseline.selectedSpec;
    const matchesSelectedSpec =
      item.thoughtSpecId.toLowerCase() === selectedSpec.id.toLowerCase() &&
      item.thoughtSpecHash.toLowerCase() === selectedSpec.hash.toLowerCase();
    return matchesSelectedSpec ? thoughtContractSelectedSpecUrl : null;
  }
  return `/api/thought-spec?id=${encodeURIComponent(String(item.tokenId))}`;
}
