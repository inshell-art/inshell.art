/** unix‑seconds → "YYYY/MM/DD hh:mm:ss" (UTC) */
export const fmtDate = (sec: number) =>
  new Date(sec * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19)
    .replace(/-/g, "/");

/** wei → "0.00 STRK" */
export const fmtPrice = (wei: bigint) => {
  const STRK = BigInt(10 ** 18); // 1 STRK = 10^18 wei
  const price = Number(wei) / Number(STRK);
  return `${price.toFixed(2)} STRK`;
};
