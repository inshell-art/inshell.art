import type { ThoughtGalleryItem } from "./thoughtGallery";
import thoughtContractIntegrationLock from "../../../thought/contract-integration/current/integration-lock.json";
import thoughtContractSelectedSpecUrl from "../../../thought/contract-integration/current/thought.selected-spec.md?url";

const selectedSpec = thoughtContractIntegrationLock.runtimeBaseline.selectedSpec;

function matchesSelectedThoughtSpec(
  item: Pick<ThoughtGalleryItem, "thoughtSpecId" | "thoughtSpecHash">,
): boolean {
  return (
    item.thoughtSpecId.toLowerCase() === selectedSpec.id.toLowerCase() &&
    item.thoughtSpecHash.toLowerCase() === selectedSpec.hash.toLowerCase()
  );
}

export function resolveThoughtSpecHref(
  item: Pick<ThoughtGalleryItem, "tokenId" | "thoughtSpecId" | "thoughtSpecHash">,
): string {
  return matchesSelectedThoughtSpec(item)
    ? thoughtContractSelectedSpecUrl
    : `/api/thought-spec?id=${encodeURIComponent(String(item.tokenId))}`;
}

export function resolveThoughtSpecName(): string {
  return selectedSpec.name;
}
