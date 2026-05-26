import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { onRequestGet as onPathTokensGet } from "../../../functions/api/path-tokens";

const originalFetch = globalThis.fetch;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;
const OWNER = "0x1111222233334444555566667777888899990000";
const PATH_NFT = "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function word(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function addressWord(address: string) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function tokenTopic(tokenId: bigint) {
  return `0x${word(tokenId)}`;
}

function addressTopic(address: string) {
  return `0x${addressWord(address)}`;
}

function encodeStringResult(value: string) {
  const data = Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const padded = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
  return `0x${word(32n)}${word(BigInt(value.length))}${padded}`;
}

function encodeAddressResult(address: string) {
  return `0x${addressWord(address)}`;
}

function rpcResponse(result: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

class TestHeaders {
  values = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    for (const [key, value] of Object.entries(init ?? {})) {
      this.set(key, value);
    }
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }
}

class TestResponse {
  status: number;
  headers: unknown;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers;
    this.bodyText = typeof body === "string" ? body : "";
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

describe("chain cache Pages functions", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Response = originalResponse;
    globalThis.Headers = originalHeaders;
    jest.restoreAllMocks();
  });

  test("indexes PATH transfer logs behind the same-origin JSON API", async () => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: any[];
      };
      if (body.method === "eth_blockNumber") {
        return rpcResponse("0xa5a7ec");
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([
          {
            address: PATH_NFT,
            blockNumber: "0xa5a7ec",
            data: "0x",
            logIndex: "0x0",
            topics: [TRANSFER_TOPIC, ZERO_TOPIC, addressTopic(OWNER), tokenTopic(1n)],
            transactionHash: `0x${"1".padStart(64, "0")}`,
          },
        ]);
      }
      if (body.method === "eth_call") {
        const data = String(body.params?.[0]?.data ?? "");
        if (data.startsWith("0x6352211e")) {
          return rpcResponse(encodeAddressResult(OWNER));
        }
        if (data.startsWith("0xc87b56dd")) {
          return rpcResponse(
            encodeStringResult(
              `data:application/json;utf8,${encodeURIComponent(
                JSON.stringify({ name: "PATH #1" })
              )}`
            )
          );
        }
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onPathTokensGet({
      request: {} as Request,
      env: {
        PATH_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
      },
    });
    const payload = (await response.json()) as { items?: Array<{ tokenIdLabel: string; metadata: any }> };

    expect(response.status).toBe(200);
    expect(payload.items?.map((item) => item.tokenIdLabel)).toEqual(["1"]);
    expect(payload.items?.[0]?.metadata.name).toBe("PATH #1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://path-rpc.example/sepolia",
      expect.objectContaining({ method: "POST" })
    );
  });
});
