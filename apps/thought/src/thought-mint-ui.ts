export type MintFlowUiMode = "sheet" | "cli" | "dock";

// The THOUGHT creation surface owns PATH selection, authorization, and minting.
// Keep its default flow inside the control panel; `sheet` only supports legacy
// surfaces that opt into it explicitly.
export const THOUGHT_PANEL_MINT_UI_MODE: MintFlowUiMode = "dock";
