export type PreviewMode = "auto" | "wallet" | "off";
export type PreviewProviderKind = "wallet" | "preview-endpoint" | "none";
export type PreviewStatus = "not_attempted" | "unavailable" | "failed" | "accepted";

export const THOUGHT_PREVIEW_MODE_STORAGE_KEY = "thought-preview-mode";
export const THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY = "thought-current-candidate";
export const THOUGHT_PREVIEW_CACHE_LIMIT = 80;
export const THOUGHT_PREVIEW_TIMEOUT_MS = 8_000;
export const THOUGHT_PREVIEW_AUTO_RATE_LIMIT = { minute: 3, hour: 20 } as const;
export const THOUGHT_PREVIEW_MANUAL_RATE_LIMIT = { minute: 5, hour: 30 } as const;

export type ThoughtCandidatePrevalidation =
  | {
      ok: true;
      normalized: string;
      canonical: string;
    }
  | {
      ok: false;
      normalized: string;
      canonical: string;
      reasonCode: number;
      reasonLabel: string;
    };

const encoder = new TextEncoder();

const byteLength = (value: string) => encoder.encode(value).length;

export const previewModes = ["auto", "wallet", "off"] as const;

export const isPreviewMode = (value: string): value is PreviewMode =>
  previewModes.includes(value as PreviewMode);

export const normalizePreviewMode = (value: unknown): PreviewMode =>
  typeof value === "string" && isPreviewMode(value.trim().toLowerCase())
    ? value.trim().toLowerCase() as PreviewMode
    : "auto";

export const previewRejectionReasonLabel = (reasonCode: number) => {
  if (reasonCode === 1) return "empty after normalization";
  if (reasonCode === 2) return "raw return too large";
  if (reasonCode === 3) return "text too long";
  if (reasonCode === 4) return "unsupported characters";
  if (reasonCode === 5) return "not canonical";
  if (reasonCode === 6) return "multi-line output";
  return "unknown preview error";
};

export const previewUnavailableCliLines = (mode: PreviewMode, reason = "") => {
  const lines = [
    "model return saved as candidate.",
    "contract preview unavailable.",
    ...(reason ? [`reason: ${reason}`] : []),
    "",
  ];

  if (mode === "wallet") {
    return [
      ...lines,
      "connect wallet or switch preview back to auto.",
      "use: wallet connect",
      "use: config preview auto",
    ];
  }

  if (mode === "off") {
    return [
      ...lines,
      "preview is off.",
      "use: config preview auto",
    ];
  }

  return [
    ...lines,
    "preview service unavailable or wallet not connected.",
    "use: preview retry",
    "use: wallet connect",
  ];
};

const canonicalThoughtCandidate = (value: string) =>
  value.replace(/[^A-Za-z]+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();

export const prevalidateThoughtCandidate = (
  rawReturn: string,
  options: {
    maxRawBytes: number;
    maxTextBytes: number;
  },
): ThoughtCandidatePrevalidation => {
  const normalized = rawReturn.replace(/\r\n?/g, "\n").trim();
  const canonical = canonicalThoughtCandidate(normalized);

  if (!normalized) {
    return {
      ok: false,
      normalized,
      canonical,
      reasonCode: 1,
      reasonLabel: previewRejectionReasonLabel(1),
    };
  }

  if (byteLength(rawReturn) > options.maxRawBytes) {
    return {
      ok: false,
      normalized,
      canonical,
      reasonCode: 2,
      reasonLabel: previewRejectionReasonLabel(2),
    };
  }

  if (normalized.includes("\n")) {
    return {
      ok: false,
      normalized,
      canonical,
      reasonCode: 6,
      reasonLabel: previewRejectionReasonLabel(6),
    };
  }

  if (/[^A-Za-z ]/.test(normalized)) {
    return {
      ok: false,
      normalized,
      canonical,
      reasonCode: 4,
      reasonLabel: previewRejectionReasonLabel(4),
    };
  }

  if (byteLength(canonical) > options.maxTextBytes) {
    return {
      ok: false,
      normalized,
      canonical,
      reasonCode: 3,
      reasonLabel: previewRejectionReasonLabel(3),
    };
  }

  return {
    ok: true,
    normalized,
    canonical,
  };
};
