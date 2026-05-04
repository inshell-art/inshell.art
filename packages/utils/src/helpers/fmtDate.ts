/** unix‑seconds → "YYYY/MM/DD hh:mm:ss" (UTC) */
export const fmtDate = (sec: number) =>
  new Date(sec * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19)
    .replace(/-/g, "/");

/** wei → "0.00 ETH" */
export const fmtPrice = (wei: bigint) => {
  const ETH = BigInt(10 ** 18); // 1 ETH = 10^18 wei
  const price = Number(wei) / Number(ETH);
  return `${price.toFixed(2)} ETH`;
};
