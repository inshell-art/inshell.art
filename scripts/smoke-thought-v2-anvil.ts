import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ethersEntry = require.resolve("ethers", {
  paths: [fileURLToPath(new URL("../apps/thought", import.meta.url))],
});
const {
  Contract,
  JsonRpcProvider,
  getBytes,
} = await import(ethersEntry);

const localAddresses = JSON.parse(await readFile(
  process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim() ||
    fileURLToPath(new URL(
      "../apps/thought/contract-integration/local-runtime.thought-anvil.json",
      import.meta.url,
    )),
  "utf8",
)) as {
  artifact: {
    acceptanceOnly: true;
    artifactId: string;
    deploymentAuthorized: false;
    productionConsumable: true;
  };
  chainId: number;
  pathNft: { address: string };
  thoughtNft: { address: string };
  thoughtSpecRegistry: { address: string };
  thoughtRenderer: { address: string };
  protocolRegistry: { address: string };
  creationAttestationVerifier: { address: string };
  protocolRelease: {
    id: string;
    manifestHash: string;
    rendererIdHash: string;
    workProfileIdHash: string;
    contextProfileIdHash: string;
    metadataProfileIdHash: string;
    creationAttestationProfileIdHash: string;
  };
  thoughtSpecs: Array<{
    specName: string;
    specId: string;
    specHash: string;
    ref: string;
    byteLength: number;
  }>;
  pathFixtures?: {
    ownerSignerIndex?: number;
    tokens?: Array<{
      tokenId?: string;
    }>;
  };
  pulseAuction: { address: string };
  pathAuction: { openTime: number };
  rpcUrl?: string;
};
const rpcUrl =
  process.env.RPC_URL?.trim() ||
  localAddresses.rpcUrl?.trim() ||
  "http://127.0.0.1:8546";
const rpc = new URL(rpcUrl);
assert(
  rpc.hostname === "127.0.0.1" || rpc.hostname === "localhost" || rpc.hostname === "[::1]",
  "Anvil smoke test refuses a non-loopback RPC",
);
const selectedSpecText = await readFile(
  new URL("../apps/thought/spec/THOUGHT.v2.md", import.meta.url),
  "utf8",
);

(globalThis as typeof globalThis & {
  __INSHELL_THOUGHT_EVM_ADDRESSES__?: Record<string, unknown>;
}).__INSHELL_THOUGHT_EVM_ADDRESSES__ = {
  ...localAddresses,
  localContractIntegration: {
    acceptanceOnly: localAddresses.artifact.acceptanceOnly,
    deploymentAuthorized: localAddresses.artifact.deploymentAuthorized,
    id: localAddresses.artifact.artifactId,
    productionConsumable: localAddresses.artifact.productionConsumable,
  },
};

const {
  THOUGHT_V2_LOCAL_NFT_ABI,
  buildThoughtV2LocalProvenance,
} = await import("../apps/thought/src/thought-v2-local-mint");
const { THOUGHT_V2_LOCAL_RELEASE } = await import(
  "../apps/thought/src/thought-v2-local-release"
);
const { hashPathV050ConsumeAuthorization } = await import(
  "../apps/thought/src/thought-path-consume-authorization"
);
const release = THOUGHT_V2_LOCAL_RELEASE;
const provider = new JsonRpcProvider(rpcUrl, release.chainId, {
  staticNetwork: true,
  batchMaxCount: 1,
});
const network = await provider.getNetwork();
assert.equal(Number(network.chainId), release.chainId, "Anvil chain ID mismatch");
const pathAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getConsumeNonce(address claimer) view returns (uint256)",
  "function getPermissionEpoch(uint256 pathId) view returns (uint256)",
  "function getStage(uint256 tokenId) view returns (uint8)",
  "function getAuthorizedMinter(bytes32 movement) view returns (address)",
] as const;
const auctionAbi = [
  "function getCurrentPrice() view returns (uint256)",
  "function bid(uint256 maxPrice) payable returns (uint256)",
] as const;

const runSmoke = async () => {
  const signerIndex = Number.parseInt(
    process.env.SIGNER_INDEX?.trim() ||
      String(localAddresses.pathFixtures?.ownerSignerIndex ?? 0),
    10,
  );
  assert(Number.isSafeInteger(signerIndex) && signerIndex >= 0, "SIGNER_INDEX must be a non-negative integer");
  const signer = await provider.getSigner(signerIndex);
  const minter = await signer.getAddress();
  const pathMovement = `0x${Buffer.from("THOUGHT").toString("hex").padEnd(64, "0")}`;
  const pathNft = new Contract(release.contracts.pathNft, pathAbi, signer);
  const thought = new Contract(release.contracts.thoughtNft, THOUGHT_V2_LOCAL_NFT_ABI, signer);
  const requestedPathId = process.env.PATH_ID?.trim();
  let pathId = requestedPathId ? BigInt(requestedPathId) : null;
  if (pathId === null) {
    for (const fixture of localAddresses.pathFixtures?.tokens ?? []) {
      if (!fixture.tokenId) continue;
      const candidate = BigInt(fixture.tokenId);
      try {
        const [owner, stage] = await Promise.all([
          pathNft.ownerOf(candidate) as Promise<string>,
          pathNft.getStage(candidate) as Promise<bigint>,
        ]);
        if (owner.toLowerCase() === minter.toLowerCase() && stage === 0n) {
          pathId = candidate;
          break;
        }
      } catch {
        // Ignore stale fixture descriptors and continue to the auction fallback.
      }
    }
  }
  if (pathId === null) {
    const latest = await provider.getBlock("latest");
    assert(latest, "latest Anvil block unavailable before $PATH acquisition");
    if (latest.timestamp < localAddresses.pathAuction.openTime) {
      try {
        await provider.send("evm_setNextBlockTimestamp", [localAddresses.pathAuction.openTime]);
        await provider.send("evm_mine", []);
      } catch (error) {
        // The persistent dev chain can be advanced by the running App between
        // the latest-block read and this timestamp update. Treat that race as
        // success only when a fresh uncached RPC read proves the auction is open.
        const currentBlock = await provider.send("eth_getBlockByNumber", ["latest", false]) as {
          timestamp?: string;
        };
        const currentTimestamp = Number.parseInt(currentBlock.timestamp ?? "0x0", 16);
        if (currentTimestamp < localAddresses.pathAuction.openTime) throw error;
      }
    }
    const auction = new Contract(localAddresses.pulseAuction.address, auctionAbi, signer);
    const price = await auction.getCurrentPrice() as bigint;
    const acquiredPathId = await auction.bid.staticCall(price, { value: price }) as bigint;
    await (await auction.bid(price, { value: price })).wait();
    pathId = acquiredPathId;
  }

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
  assert.equal((await thought.RENDERER_ID_HASH()).toLowerCase(), release.protocol.rendererProfile.keccak256);
  assert.equal((await thought.WORK_PROFILE_ID_HASH()).toLowerCase(), release.protocol.workProfile.keccak256);
  assert.equal((await thought.CONTEXT_PROFILE_ID_HASH()).toLowerCase(), release.protocol.contextProfile.keccak256);
  assert.equal((await thought.METADATA_PROFILE_ID_HASH()).toLowerCase(), release.protocol.metadataProfile.keccak256);

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
  const [permissionEpoch, nonce] = await Promise.all([
    pathNft.getPermissionEpoch(pathId) as Promise<bigint>,
    pathNft.getConsumeNonce(minter) as Promise<bigint>,
  ]);
  const structHash = hashPathV050ConsumeAuthorization({
    pathNft: release.contracts.pathNft,
    chainId: BigInt(release.chainId),
    pathId,
    movement: pathMovement,
    claimer: minter,
    executor: release.contracts.thoughtNft,
    permissionEpoch,
    nonce,
    deadline,
  });
  const pathSignature = await signer.signMessage(getBytes(structHash));
  const uniqueSuffix = `${latestBlock.number}-${Date.now().toString(36)}`;
  const promptLine = `local v mint ${uniqueSuffix}`;
  const agentLine = `anvil preserves ${uniqueSuffix}`;
  const provenanceJson = buildThoughtV2LocalProvenance({
    promptLine,
    agentLine,
    process: {
      kind: "manual",
      agent: {
        label: "Inshell THOUGHT App",
        source: "minter-supplied",
      },
      model: {
        label: "Local smoke",
        source: "minter-supplied",
      },
    },
    mintContext: {
      chainId: String(release.chainId),
      thoughtNft: release.contracts.thoughtNft,
      intendedMinter: minter,
    },
    selectedSpec: {
      name: release.spec.name,
      text: selectedSpecText,
    },
  });

  const supplyBefore = await thought.totalSupply();
  const tx = await thought.mint({
    promptLine,
    agentLine,
    agent: "Inshell THOUGHT App",
    model: "Local smoke",
    pathId,
    thoughtSpecId: release.spec.evmSpecId,
    thoughtSpecHash: release.spec.evmSpecHash,
    provenanceJson,
    deadline,
    pathSignature,
    creationAttestation: {
      runIdHash: `0x${"00".repeat(32)}`,
      deadline: 0,
      authorityEpoch: 0,
      signature: "0x",
    },
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
