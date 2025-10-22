import { hash } from "starknet";

// get event selectors for bid-like events from ABI, with fallbacks
export function getBidEventSelectors(
  abi: readonly any[] | undefined,
  fallbackNames: string[] = ["Sale"]
): Set<string> {
  if (!Array.isArray(abi)) {
    return new Set(fallbackNames.map((n) => hash.getSelectorFromName(n)));
  } // fallback

  const names = new Set(
    abi
      ?.filter((e) => e?.type === "event" && typeof e?.name === "string")
      .map((e) => e.name as string)
  );
  const picked = fallbackNames.filter((n) => names.has(n)); // fallbackNames as allow list too, to filter other events not relevant to bids
  const base = picked.length > 0 ? picked : fallbackNames;
  return new Set(base.map((n) => hash.getSelectorFromName(n)));
}
