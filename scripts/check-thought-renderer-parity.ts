import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { Contract, JsonRpcProvider } from "../apps/thought/node_modules/ethers/lib.esm/index.js";
import { buildThoughtRawSvg } from "../apps/thought/src/svg-raw-renderer";
import { prevalidateThoughtCandidate } from "../apps/thought/src/thought-preview-policy";

type ThoughtRelease = {
  chain_id?: number;
  contracts?: {
    thought_nft?: string;
  };
};

type AbiSnapshot = {
  abi?: unknown[];
};

type TokenMetadata = {
  image?: unknown;
  thought?: {
    text?: unknown;
  };
  properties?: {
    rawText?: unknown;
  };
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const releasePath = resolve(repoRoot, "packages/contracts/src/releases/thought-release.sepolia.json");
const abiPath = resolve(repoRoot, "packages/contracts/src/abi/sepolia/ThoughtNFT.json");
const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const PREVIEW_CASES = [
  "hi",
  "quiet green sky",
  "HELLO THOUGHT",
  "ONE\nTWO",
  "  ",
  "ONE!",
];
const TOKEN_URI_GAS_LIMIT = 100_000_000n;

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const rpcUrl = () =>
  process.env.THOUGHT_RENDER_PARITY_RPC_URL ||
  process.env.VITE_THOUGHT_RPC_URL ||
  process.env.VITE_WALLET_CHAIN_RPC_URL ||
  DEFAULT_SEPOLIA_RPC;

const rpcLabel = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return "configured RPC";
  }
};

const requireEqual = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label} drift: expected ${String(expected)}, got ${String(actual)}`);
  }
};

const requireSameText = (actual: string, expected: string, label: string) => {
  if (actual !== expected) {
    throw new Error(
      `${label} drift: expected sha256=${sha256(expected)}, got sha256=${sha256(actual)}`,
    );
  }
};

const decodeDataUriText = (value: string) => {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  if (!trimmed.startsWith("data:") || commaIndex < 0) {
    throw new Error("Expected data URI");
  }
  const header = trimmed.slice(0, commaIndex);
  const payload = trimmed.slice(commaIndex + 1);
  return header.includes(";base64")
    ? Buffer.from(payload, "base64").toString("utf8")
    : decodeURIComponent(payload);
};

const decodeTokenMetadata = (tokenUri: string): TokenMetadata =>
  JSON.parse(decodeDataUriText(tokenUri)) as TokenMetadata;

const decodeMetadataImageSvg = (metadata: TokenMetadata) => {
  if (typeof metadata.image !== "string") {
    throw new Error("tokenURI metadata missing image");
  }
  return decodeDataUriText(metadata.image);
};

const metadataText = (metadata: TokenMetadata) => {
  const text = metadata.thought?.text ?? metadata.properties?.rawText;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("tokenURI metadata missing thought text");
  }
  return text;
};

const uniqueSampleIds = (totalSupply: bigint) => {
  if (totalSupply <= 0n) return [];
  return [...new Set([1n, totalSupply])];
};

async function main() {
  const release = readJson<ThoughtRelease>(releasePath);
  const abiSnapshot = readJson<AbiSnapshot>(abiPath);
  const chainId = release.chain_id;
  const thoughtNft = release.contracts?.thought_nft;
  if (!Number.isInteger(chainId) || !thoughtNft) {
    throw new Error("Invalid THOUGHT release contract metadata");
  }
  if (!Array.isArray(abiSnapshot.abi)) {
    throw new Error("Invalid ThoughtNFT ABI snapshot");
  }

  const configuredRpcUrl = rpcUrl();
  const provider = new JsonRpcProvider(configuredRpcUrl, chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
  const token = new Contract(thoughtNft, abiSnapshot.abi, provider);
  const maxRawBytes = Number(await token.MAX_RAW_RETURN_BYTES());
  const maxTextBytes = Number(await token.MAX_TEXT_BYTES());

  const previewResults: Array<{ raw: string; ok: boolean; text: string; reasonCode: number }> = [];
  for (const raw of PREVIEW_CASES) {
    const [ok, text, svg, reasonCode] = await token.previewWork(raw) as [
      boolean,
      string,
      string,
      bigint | number,
    ];
    const local = prevalidateThoughtCandidate(raw, {
      maxRawBytes,
      maxTextBytes,
    });
    requireEqual(local.ok, Boolean(ok), `previewWork(${JSON.stringify(raw)}).ok`);
    requireEqual(local.canonical, String(text), `previewWork(${JSON.stringify(raw)}).text`);
    requireEqual(
      local.ok ? 0 : local.reasonCode,
      Number(reasonCode),
      `previewWork(${JSON.stringify(raw)}).reasonCode`,
    );
    if (local.ok) {
      requireSameText(
        buildThoughtRawSvg({ text: local.canonical }),
        String(svg),
        `previewWork(${JSON.stringify(raw)}).svg`,
      );
    }
    previewResults.push({
      raw,
      ok: Boolean(ok),
      text: String(text),
      reasonCode: Number(reasonCode),
    });
  }

  const totalSupply = BigInt(await token.totalSupply());
  const tokenIds = uniqueSampleIds(totalSupply);
  const tokenUriResults: Array<{ tokenId: string; text: string; imageHash: string }> = [];
  for (const tokenId of tokenIds) {
    const tokenUri = String(await token.tokenURI(tokenId, { gasLimit: TOKEN_URI_GAS_LIMIT }));
    const metadata = decodeTokenMetadata(tokenUri);
    const text = metadataText(metadata);
    const contractSvg = decodeMetadataImageSvg(metadata);
    const expectedSvg = buildThoughtRawSvg({ text });
    requireSameText(expectedSvg, contractSvg, `tokenURI(${tokenId}).image`);
    tokenUriResults.push({
      tokenId: tokenId.toString(),
      text,
      imageHash: sha256(contractSvg),
    });
  }

  console.log(JSON.stringify({
    ok: true,
    check: "thought-renderer-parity",
    rpc: rpcLabel(configuredRpcUrl),
    chainId,
    thoughtNft,
    maxRawBytes,
    maxTextBytes,
    previewResults,
    tokenUriResults,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[check-thought-renderer-parity] ${message}`);
  process.exitCode = 1;
});
