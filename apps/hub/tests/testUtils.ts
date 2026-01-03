import { jest } from "@jest/globals";

export function encodeByteArray(value: string): string[] {
  const bytes = new globalThis.TextEncoder().encode(value);
  const fullWords = Math.floor(bytes.length / 31);
  const pendingLen = bytes.length % 31;
  const out: string[] = [];
  out.push(fullWords.toString());

  for (let i = 0; i < fullWords; i += 1) {
    let word = 0n;
    for (let j = 0; j < 31; j += 1) {
      word = (word << 8n) + BigInt(bytes[i * 31 + j]);
    }
    out.push(word.toString());
  }

  let pendingWord = 0n;
  for (let i = 0; i < pendingLen; i += 1) {
    pendingWord = (pendingWord << 8n) + BigInt(bytes[fullWords * 31 + i]);
  }
  out.push(pendingWord.toString());
  out.push(pendingLen.toString());
  return out;
}

export function mockAuctionCore(
  mockFn: jest.Mock,
  overrides: Partial<Record<string, unknown>> = {}
) {
  mockFn.mockReturnValue({
    data: {
      config: {
        openTimeSec: Date.UTC(2024, 0, 1) / 1000,
        genesisPrice: { dec: "1" },
        genesisFloor: { dec: "1" },
        k: { dec: "10" },
        pts: "1",
        ...overrides,
      },
    },
    ready: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
}
