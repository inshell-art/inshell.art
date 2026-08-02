import {
  JsonRpcProvider,
  getAddress,
  type Signer,
} from "ethers";

import {
  buildThoughtV2MockOfficialMint,
  type ThoughtV2AppMintFacts,
  type ThoughtV2MintInput,
} from "../src/thought-v2-app-mint";
import {
  createThoughtV2VerifierContract,
  verifyThoughtV2CurrentRuntime,
  type ThoughtV2AnvilRuntime,
} from "../src/thought-v2-contract-client";
import {
  CREATION_ATTESTATION_TYPES,
  creationAttestationDomain,
  hashCreationAttestationClaim,
} from "../contract-integration/current/reference/thought-v2-current-creation-attestation";

const isLoopbackRpc = (value: string) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" ||
    hostname === "::1" || hostname === "[::1]";
};

export const buildBackendOnlyMockThoughtV2Mint = async (
  runtime: ThoughtV2AnvilRuntime,
  facts: ThoughtV2AppMintFacts,
  options: {
    provider?: JsonRpcProvider;
    signer?: Signer;
    attestationDeadline: bigint;
  },
): Promise<ThoughtV2MintInput> => {
  if (!isLoopbackRpc(runtime.rpcUrl) || runtime.chainId !== 31_337) {
    throw new Error("Mock THOUGHT signer is restricted to loopback Anvil chain 31337.");
  }
  const provider = options.provider ?? new JsonRpcProvider(runtime.rpcUrl, runtime.chainId);
  const verification = await verifyThoughtV2CurrentRuntime(provider, runtime);
  if (!verification.compatible) {
    throw new Error(`Mock THOUGHT signer rejected runtime: ${verification.issues.join("; ")}`);
  }
  const signer = options.signer ?? await provider.getSigner(runtime.attestation.authority);
  const signerAddress = await signer.getAddress();
  if (getAddress(signerAddress) !== getAddress(runtime.attestation.authority)) {
    throw new Error("Mock THOUGHT signer is not the verifier authority.");
  }
  const verifier = createThoughtV2VerifierContract(
    runtime.contracts.creationAttestationVerifier,
    provider,
  );
  const authorityEpoch = BigInt(await verifier.authorityEpoch());
  if (authorityEpoch !== BigInt(runtime.attestation.authorityEpoch)) {
    throw new Error("Mock THOUGHT signer authority epoch mismatch.");
  }

  return buildThoughtV2MockOfficialMint(facts, {
    authorityEpoch,
    attestationDeadline: options.attestationDeadline,
    sign: async (claim) => {
      const signature = await signer.signTypedData(
        creationAttestationDomain(
          BigInt(runtime.chainId),
          runtime.contracts.creationAttestationVerifier.toLowerCase() as `0x${string}`,
        ),
        CREATION_ATTESTATION_TYPES,
        claim,
      ) as `0x${string}`;
      const localDigest = hashCreationAttestationClaim(
        BigInt(runtime.chainId),
        runtime.contracts.creationAttestationVerifier.toLowerCase() as `0x${string}`,
        claim,
      );
      const contractDigest = await verifier.hashClaim(claim) as string;
      if (contractDigest.toLowerCase() !== localDigest.toLowerCase()) {
        throw new Error("Mock THOUGHT signer EIP-712 digest parity failed.");
      }
      return signature;
    },
  });
};
