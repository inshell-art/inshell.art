export const PATH_OVERVIEW =
  "$PATH is the permission token for movements:";

// PATH v0.5 reserves this token-id range for Spark claims. Keep display
// serials aligned with the immutable release handoff.
export const PATH_SPARK_BASE = 1_000_000_000_000_000n;

export const PATH_OVERVIEW_LINES = [
  "THOUGHT WILL AWA",
  "One after another.",
  "Each work mint moves $PATH forward.",
] as const;

export const PATH_MINT_CAPACITY_NOTE =
  "Each movement has its own capacity.";

export const PATH_MINT_CAPACITY_LINES = [
  "One successful work mint uses one.",
  "Using the full capacity opens the next movement.",
  "Not available means no capacity is configured.",
] as const;
