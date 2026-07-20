export type MintFlowUiMode = "sheet" | "cli" | "dock";

export type ThoughtAuthorizationStage =
  | "preparing"
  | "wallet"
  | "nonce"
  | "digest"
  | "signature";

export type ThoughtAuthorizationErrorPresentation = {
  message: string;
  kind: "thought" | "spec" | "signature" | "wrong_network";
};

export const THOUGHT_V2_MINT_UNAVAILABLE_COPY =
  "Minting unavailable: this THOUGHT V2 build has no approved on-chain deployment yet.";

type ThoughtWorkReadyPresentationInput = {
  mintEnabled: boolean;
};

export const getThoughtWorkReadyPresentation = ({
  mintEnabled,
}: ThoughtWorkReadyPresentationInput) => ({
  canMint: mintEnabled,
  detail: mintEnabled
    ? "ready to mint"
    : THOUGHT_V2_MINT_UNAVAILABLE_COPY,
});

type WalletErrorLike = {
  cause?: unknown;
  code?: unknown;
  data?: unknown;
  error?: unknown;
  info?: unknown;
  message?: unknown;
  originalError?: unknown;
  reason?: unknown;
  shortMessage?: unknown;
};

const collectAuthorizationErrorDetails = (error: unknown) => {
  const messages: string[] = [];
  const codes: string[] = [];
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0 && visited.size < 12) {
    const value = queue.shift();
    if (value == null || visited.has(value)) continue;
    visited.add(value);

    if (typeof value === "string") {
      if (value.trim()) messages.push(value.trim());
      continue;
    }
    if (typeof value !== "object") continue;

    const item = value as WalletErrorLike;
    for (const candidate of [item.shortMessage, item.message, item.reason]) {
      if (typeof candidate === "string" && candidate.trim()) {
        messages.push(candidate.trim());
      }
    }
    if (typeof item.code === "string" || typeof item.code === "number") {
      codes.push(String(item.code).toUpperCase());
    }

    queue.push(
      item.error,
      item.cause,
      (item.info as WalletErrorLike | undefined)?.error,
      (item.data as WalletErrorLike | undefined)?.error,
      (item.data as WalletErrorLike | undefined)?.originalError,
    );
  }

  return {
    codes,
    messages,
    normalized: messages.join(" ").toLowerCase(),
    primaryMessage: messages[0] ?? "",
  };
};

export const formatThoughtAuthorizationError = (
  error: unknown,
  stage: ThoughtAuthorizationStage,
): ThoughtAuthorizationErrorPresentation => {
  const { codes, normalized, primaryMessage } = collectAuthorizationErrorDetails(error);
  const isWalletStage = stage === "wallet" || stage === "signature";

  if (
    /provenance (?:is )?\d+\s*\/\s*\d+ bytes|provenance (?:is )?.*too large|provenance too large/.test(normalized)
  ) {
    return {
      message: primaryMessage || "provenance too large.",
      kind: "thought",
    };
  }
  if (/^spec\b/.test(primaryMessage.toLowerCase()) || normalized.includes("thought.md")) {
    return { message: primaryMessage, kind: "spec" };
  }
  if (
    isWalletStage &&
    (
      codes.includes("4001") ||
      codes.includes("ACTION_REJECTED") ||
      /user (?:rejected|denied|cancelled|canceled)/.test(normalized)
    )
  ) {
    return { message: "signature rejected in wallet.", kind: "signature" };
  }
  if (
    isWalletStage &&
    (
      codes.includes("-32002") ||
      /already (?:processing|pending)|request is pending/.test(normalized)
    )
  ) {
    return { message: "signature request already pending in wallet.", kind: "signature" };
  }
  if (
    isWalletStage &&
    (
      codes.includes("NETWORK_ERROR") ||
      /wrong network|network changed|chain changed|chain id.*mismatch/.test(normalized)
    )
  ) {
    return { message: "wrong network.", kind: "wrong_network" };
  }
  if (
    isWalletStage &&
    (
      codes.includes("4200") ||
      codes.includes("-32601") ||
      codes.includes("UNSUPPORTED_OPERATION") ||
      /unsupported (?:method|operation)|method not found|does not support.*(?:sign|personal_sign)|personal_sign.*(?:unsupported|unavailable)/.test(normalized)
    )
  ) {
    return { message: "wallet cannot sign the $PATH permission.", kind: "signature" };
  }
  if (
    isWalletStage &&
    (
      codes.includes("4100") ||
      /wallet.*locked|unknown account|account.*(?:changed|unavailable|not found)|not connected|unauthorized/.test(normalized)
    )
  ) {
    return { message: "signing wallet unavailable. reconnect wallet.", kind: "signature" };
  }
  if (stage === "preparing") {
    return { message: "THOUGHT preparation unavailable.", kind: "thought" };
  }
  if (stage === "nonce") {
    return { message: "$PATH signature unavailable.", kind: "signature" };
  }
  if (stage === "wallet") {
    return { message: "signing wallet unavailable. reconnect wallet.", kind: "signature" };
  }
  return { message: "signature failed.", kind: "signature" };
};

// The THOUGHT creation surface owns $PATH selection, signing, and minting.
// Keep its default flow inside the control panel; `sheet` only supports legacy
// surfaces that opt into it explicitly.
export const THOUGHT_PANEL_MINT_UI_MODE: MintFlowUiMode = "dock";
