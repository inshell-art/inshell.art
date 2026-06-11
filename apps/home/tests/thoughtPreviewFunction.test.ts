import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  __clearThoughtPreviewCachesForTests,
  onRequestGet,
  onRequestPost,
} from "../../../functions/api/thought-preview";

type MockFetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};
type MockFetch = (...args: unknown[]) => Promise<MockFetchResponse>;

const originalFetch = globalThis.fetch;
const originalResponse = globalThis.Response;
const originalCrypto = globalThis.crypto;

class TestResponse {
  status: number;
  headers: unknown;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers;
    this.bodyText = typeof body === "string" ? body : "";
  }

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  async text(): Promise<string> {
    return this.bodyText;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

const wordHex = (value: bigint) => value.toString(16).padStart(64, "0");

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const encodeAbiStringTail = (value: string) => {
  const data = bytesToHex(new TextEncoder().encode(value));
  return `${wordHex(BigInt(data.length / 2))}${data.padEnd(Math.ceil(data.length / 64) * 64, "0")}`;
};

const encodePreviewResult = (preview: {
  ok: boolean;
  text: string;
  svg: string;
  reasonCode: number;
}) => {
  const textTail = encodeAbiStringTail(preview.text);
  const svgTail = encodeAbiStringTail(preview.svg);
  const textOffset = 32n * 4n;
  const svgOffset = textOffset + BigInt(textTail.length / 2);
  return `0x${[
    wordHex(preview.ok ? 1n : 0n),
    wordHex(textOffset),
    wordHex(svgOffset),
    wordHex(BigInt(preview.reasonCode)),
    textTail,
    svgTail,
  ].join("")}`;
};

function previewRequest(payload: unknown, headers: Record<string, string> = {}): Request {
  return {
    text: async () => JSON.stringify(payload),
    headers: new Headers(headers),
  } as Request;
}

function postPreview(payload: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return onRequestPost({
    request: previewRequest(payload, headers),
    env: {
      THOUGHT_PREVIEW_RPC_UPSTREAM: "https://rpc.example/sepolia",
      THOUGHT_PREVIEW_NFT_ADDRESS: "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a",
      THOUGHT_PREVIEW_CHAIN_ID: "11155111",
    },
  });
}

function postPreviewWithEnv(
  payload: unknown,
  env: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return onRequestPost({
    request: previewRequest(payload, headers),
    env: {
      THOUGHT_PREVIEW_NFT_ADDRESS: "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a",
      THOUGHT_PREVIEW_CHAIN_ID: "11155111",
      ...env,
    },
  });
}

describe("Cloudflare THOUGHT preview endpoint", () => {
  beforeEach(() => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: async () => new Uint8Array(32).buffer,
        },
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Response = originalResponse;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    __clearThoughtPreviewCachesForTests();
    jest.restoreAllMocks();
  });

  test("rejects browser GET access", async () => {
    const response = await onRequestGet();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Use POST for THOUGHT preview.",
    });
  });

  test("rejects invalid candidates before touching RPC", async () => {
    const fetchMock = jest.fn<MockFetch>();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await postPreview({ rawReturn: "ONE!" });

    await expect(response.json()).resolves.toEqual({
      ok: false,
      text: "",
      svg: "",
      reasonCode: 4,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("checks chain and calls previewWork on the configured contract", async () => {
    const fetchMock = jest
      .fn<MockFetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: encodePreviewResult({
            ok: true,
            text: "QUIET SKY",
            svg: "<svg />",
            reasonCode: 0,
          }),
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await postPreview({ rawReturn: "quiet sky" });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      text: "QUIET SKY",
      svg: "<svg />",
      reasonCode: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const ethCallInit = fetchMock.mock.calls[1]?.[1] as { body?: unknown } | undefined;
    const ethCallBody = JSON.parse(String(ethCallInit?.body)) as {
      method: string;
      params: Array<{ to: string; data: string }>;
    };
    expect(ethCallBody.method).toBe("eth_call");
    expect(ethCallBody.params[0].to).toBe("0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a");
    expect(ethCallBody.params[0].data.startsWith("0xc159a6d9")).toBe(true);
  });

  test("prefers target THOUGHT primary preview fallback over compatibility alias", async () => {
    const fetchMock = jest
      .fn<MockFetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: encodePreviewResult({
            ok: true,
            text: "QUIET SKY",
            svg: "<svg />",
            reasonCode: 0,
          }),
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      (
        await postPreviewWithEnv(
          { rawReturn: "quiet sky" },
          {
            THOUGHT_PRIMARY_RPC_UPSTREAM: "https://target-thought-rpc.example/sepolia",
            THOUGHT_RPC_UPSTREAM: "https://legacy-thought-rpc.example/sepolia",
          },
        )
      ).json()
    ).resolves.toMatchObject({
      ok: true,
      text: "QUIET SKY",
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://target-thought-rpc.example/sepolia",
      "https://target-thought-rpc.example/sepolia",
    ]);
  });

  test("falls preview RPC through dedicated preview to THOUGHT primary", async () => {
    const fetchMock = jest.fn(async (url: unknown): Promise<MockFetchResponse> => {
      if (url === "https://preview-rpc.example/sepolia") {
        return {
          ok: false,
          json: async () => ({ jsonrpc: "2.0", id: 1, error: { message: "capacity" } }),
        };
      }
      if (url === "https://target-thought-rpc.example/sepolia") {
        const callIndex = fetchMock.mock.calls.filter((call) => call[0] === url).length;
        return callIndex === 1
          ? {
              ok: true,
              json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
            }
          : {
              ok: true,
              json: async () => ({
                jsonrpc: "2.0",
                id: 1,
                result: encodePreviewResult({
                  ok: true,
                  text: "QUIET SKY",
                  svg: "<svg />",
                  reasonCode: 0,
                }),
              }),
            };
      }
      throw new Error("unexpected RPC upstream");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      (
        await postPreviewWithEnv(
          { rawReturn: "quiet sky" },
          {
            THOUGHT_PREVIEW_RPC_UPSTREAM: "https://preview-rpc.example/sepolia",
            THOUGHT_PRIMARY_RPC_UPSTREAM: "https://target-thought-rpc.example/sepolia",
          },
        )
      ).json()
    ).resolves.toMatchObject({
      ok: true,
      text: "QUIET SKY",
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://preview-rpc.example/sepolia",
      "https://target-thought-rpc.example/sepolia",
      "https://target-thought-rpc.example/sepolia",
    ]);
  });

  test("caches matching preview requests", async () => {
    const fetchMock = jest
      .fn<MockFetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: encodePreviewResult({
            ok: true,
            text: "QUIET SKY",
            svg: "<svg />",
            reasonCode: 0,
          }),
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect((await postPreview({ rawReturn: "quiet sky" })).json()).resolves.toMatchObject({
      ok: true,
      text: "QUIET SKY",
    });
    await expect((await postPreview({ rawReturn: "quiet sky" })).json()).resolves.toMatchObject({
      ok: true,
      text: "QUIET SKY",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("rate-limits preview requests per client", async () => {
    const fetchMock = jest
      .fn<MockFetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: encodePreviewResult({
            ok: true,
            text: "QUIET SKY",
            svg: "<svg />",
            reasonCode: 0,
          }),
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    for (let index = 0; index < 20; index += 1) {
      const response = await postPreview({ rawReturn: "quiet sky" }, { "x-forwarded-for": "203.0.113.10" });
      expect(response.status).toBe(200);
    }

    const limited = await postPreview({ rawReturn: "quiet sky" }, { "x-forwarded-for": "203.0.113.10" });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      error: "THOUGHT preview rate limit reached.",
    });
  });
});
