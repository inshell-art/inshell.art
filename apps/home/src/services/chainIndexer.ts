const DEFAULT_INDEXER_REFRESH_API_URL = "/api/indexer/refresh";

export async function requestPulseAuctionRefresh(txHash: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return false;
  try {
    const response = await fetch(DEFAULT_INDEXER_REFRESH_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: "pulse-auction",
        tx: txHash,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
