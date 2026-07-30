export const INSHELL_OPEN_WALLET_EVENT = "inshell:wallet:open";

export function openInshellWallet(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new globalThis.Event(INSHELL_OPEN_WALLET_EVENT));
}
