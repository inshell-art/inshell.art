export const INSHELL_OPEN_WALLET_EVENT = "inshell:wallet:open";
export const INSHELL_WALLET_VISIBILITY_EVENT = "inshell:wallet:visibility";

export type InshellWalletVisibilityDetail = {
  open: boolean;
};

export function openInshellWallet(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new globalThis.Event(INSHELL_OPEN_WALLET_EVENT));
}

export function announceInshellWalletVisibility(open: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new globalThis.CustomEvent<InshellWalletVisibilityDetail>(
      INSHELL_WALLET_VISIBILITY_EVENT,
      { detail: { open } }
    )
  );
}
