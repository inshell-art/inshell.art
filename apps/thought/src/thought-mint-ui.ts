export type MintFlowUiMode = "sheet" | "cli" | "dock";

export const THOUGHT_V2_MINT_UNAVAILABLE_COPY =
  "Minting unavailable: this THOUGHT V2 build has no approved onchain deployment yet.";

type ThoughtWorkReadyPresentationInput = {
  mintEnabled: boolean;
  walletConnected: boolean;
};

export const getThoughtWorkReadyPresentation = ({
  mintEnabled,
  walletConnected,
}: ThoughtWorkReadyPresentationInput) => ({
  canMint: mintEnabled,
  detail: mintEnabled
    ? walletConnected
      ? "ready to mint"
      : "connect wallet to mint"
    : THOUGHT_V2_MINT_UNAVAILABLE_COPY,
});

// The THOUGHT creation surface owns PATH selection, authorization, and minting.
// Keep its default flow inside the control panel; `sheet` only supports legacy
// surfaces that opt into it explicitly.
export const THOUGHT_PANEL_MINT_UI_MODE: MintFlowUiMode = "dock";
