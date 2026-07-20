import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  THOUGHT_V2_LOCAL_NFT_ABI,
  buildThoughtV2LocalProvenance,
} from "../apps/thought/src/thought-v2-local-mint";
import { THOUGHT_V2_LOCAL_RELEASE } from "../apps/thought/src/thought-v2-local-release";

const require = createRequire(import.meta.url);
const ethersEntry = require.resolve("ethers", {
  paths: [fileURLToPath(new URL("../apps/thought", import.meta.url))],
});
const {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  getBytes,
  id,
  keccak256,
} = await import(ethersEntry);

const release = THOUGHT_V2_LOCAL_RELEASE;
const rpcUrl = process.env.RPC_URL?.trim() || "http://127.0.0.1:8545";
const rpc = new URL(rpcUrl);
assert(
  rpc.hostname === "127.0.0.1" || rpc.hostname === "localhost" || rpc.hostname === "[::1]",
  "Anvil smoke test refuses a non-loopback RPC",
);

const provider = new JsonRpcProvider(rpcUrl, release.chainId, {
  staticNetwork: true,
  batchMaxCount: 1,
});
const network = await provider.getNetwork();
assert.equal(Number(network.chainId), release.chainId, "Anvil chain ID mismatch");
const localAddresses = JSON.parse(await readFile(
  new URL("../apps/thought/evm/addresses.anvil.json", import.meta.url),
  "utf8",
)) as {
  devPathTokens: { firstId: number; lastId: number };
};
const pathAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getConsumeNonce(address claimer) view returns (uint256)",
  "function getStage(uint256 tokenId) view returns (uint8)",
  "function getAuthorizedMinter(bytes32 movement) view returns (address)",
] as const;

const runSmoke = async () => {
  const signer = await provider.getSigner(0);
  const minter = await signer.getAddress();
  const pathMovement = `0x${Buffer.from("THOUGHT").toString("hex").padEnd(64, "0")}`;
  const pathNft = new Contract(release.contracts.pathNft, pathAbi, signer);
  const thought = new Contract(release.contracts.thoughtNft, THOUGHT_V2_LOCAL_NFT_ABI, signer);
  const requestedPathId = process.env.PATH_ID?.trim();
  let pathId = requestedPathId ? BigInt(requestedPathId) : null;
  if (pathId === null) {
    for (let tokenId = localAddresses.devPathTokens.firstId; tokenId <= localAddresses.devPathTokens.lastId; tokenId += 1) {
      const candidate = BigInt(tokenId);
      const [owner, stage] = await Promise.all([
        pathNft.ownerOf(candidate) as Promise<string>,
        pathNft.getStage(candidate) as Promise<bigint>,
      ]);
      if (owner.toLowerCase() === minter.toLowerCase() && Number(stage) === 0) {
        pathId = candidate;
        break;
      }
    }
  }
  assert(pathId !== null, "no unused seeded PATH is available for the Anvil signer");

  assert.equal((await pathNft.ownerOf(pathId)).toLowerCase(), minter.toLowerCase());
  assert.equal(Number(await pathNft.getStage(pathId)), 0, `PATH #${pathId} is already consumed`);
  assert.equal(
    (await pathNft.getAuthorizedMinter(pathMovement)).toLowerCase(),
    release.contracts.thoughtNft.toLowerCase(),
  );
  assert.equal((await thought.pathNft()).toLowerCase(), release.contracts.pathNft.toLowerCase());
  assert.equal(
    (await thought.thoughtSpecRegistry()).toLowerCase(),
    release.contracts.thoughtSpecRegistry.toLowerCase(),
  );
  assert.equal((await thought.thoughtRenderer()).toLowerCase(), release.contracts.thoughtRenderer.toLowerCase());
  assert.equal((await thought.protocolRegistry()).toLowerCase(), release.contracts.protocolRegistry.toLowerCase());
  assert.equal((await thought.protocolReleaseId()).toLowerCase(), release.protocol.protocolReleaseId);
  assert.equal((await thought.protocolManifestHash()).toLowerCase(), release.protocol.manifestKeccak256);
  assert.equal((await thought.RENDERER_PROFILE_KECCAK256()).toLowerCase(), release.protocol.rendererProfile.keccak256);
  assert.equal((await thought.WORK_PROFILE_KECCAK256()).toLowerCase(), release.protocol.workProfile.keccak256);

  const latestBlock = await provider.getBlock("latest");
  assert(latestBlock, "latest Anvil block unavailable");
  // A persistent Anvil node can sit idle long enough for its latest mined block
  // to trail wall-clock time by more than the authorization TTL. Anvil advances
  // the next block to wall-clock time, so a deadline based only on the stale
  // head can already be expired by the time gas estimation runs.
  const wallClockTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const authorizationBaseTimestamp = BigInt(latestBlock.timestamp) > wallClockTimestamp
    ? BigInt(latestBlock.timestamp)
    : wallClockTimestamp;
  const deadline = authorizationBaseTimestamp + 3600n;
  const nonce = await pathNft.getConsumeNonce(minter);
  const consumeTypehash = id(
    "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 nonce,uint256 deadline)",
  );
  const structHash = keccak256(AbiCoder.defaultAbiCoder().encode(
    [
      "bytes32",
      "address",
      "uint256",
      "uint256",
      "bytes32",
      "address",
      "address",
      "uint256",
      "uint256",
    ],
    [
      consumeTypehash,
      release.contracts.pathNft,
      BigInt(release.chainId),
      pathId,
      pathMovement,
      minter,
      release.contracts.thoughtNft,
      nonce,
      deadline,
    ],
  ));
  const pathSignature = await signer.signMessage(getBytes(structHash));
  const uniqueSuffix = `${latestBlock.number}-${Date.now().toString(36)}`;
  const promptLine = `local V2 mint ${uniqueSuffix}`;
  const agentLine = `Anvil preserves ${uniqueSuffix}`;
  const provenanceJson = buildThoughtV2LocalProvenance({
    promptLine,
    agentLine,
    process: { kind: "manual" },
    mintContext: {
      chainId: String(release.chainId),
      thoughtNft: release.contracts.thoughtNft,
      pathNft: release.contracts.pathNft,
      minter,
      movement: "THOUGHT",
      pathId: pathId.toString(),
    },
  });

  const supplyBefore = await thought.totalSupply();
  const tx = await thought.mint({
    promptLine,
    agentLine,
    pathId,
    thoughtSpecId: release.spec.evmSpecId,
    thoughtSpecHash: release.spec.evmSpecHash,
    provenanceJson,
    deadline,
    pathSignature,
  });
  const receipt = await tx.wait();
  assert(receipt, "mint receipt unavailable");
  const mintedLog = receipt.logs
    .map((log: { topics: readonly string[]; data: string }) => {
      try {
        return thought.interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((log: { name?: string } | null) => log?.name === "ThoughtMinted");
  assert(mintedLog, "ThoughtMinted event missing");
  const tokenId = mintedLog.args.tokenId;
  assert.equal(await thought.totalSupply(), supplyBefore + 1n);
  assert.equal(await thought.promptLineOf(tokenId), promptLine);
  assert.equal(await thought.agentLineOf(tokenId), agentLine);
  assert.equal(await thought.provenanceOf(tokenId), provenanceJson);
  assert.equal(Number(await pathNft.getStage(pathId)), 1);

  return {
    chainId: release.chainId,
    tokenId: tokenId.toString(),
    pathId: pathId.toString(),
    transactionHash: receipt.hash,
    promptLine,
    agentLine,
  };
};

const persist = process.env.PERSIST?.trim() === "1";
const snapshotId = persist ? null : await provider.send("evm_snapshot", []);
let result: Awaited<ReturnType<typeof runSmoke>>;
try {
  result = await runSmoke();
} finally {
  if (snapshotId !== null) {
    assert.equal(await provider.send("evm_revert", [snapshotId]), true, "failed to restore Anvil smoke snapshot");
  }
}

console.log(JSON.stringify({
  ...result,
  persisted: persist,
}, null, 2));
