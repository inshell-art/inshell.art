import { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from "../../apps/thought/src/thought-v2-production-deployment";

export type ThoughtGalleryDeployment = {
  artifactId: string;
  manifestSha256: string;
  chainId: number;
  contractAddress: `0x${string}`;
  deployBlock: number;
};

const LOCKED_THOUGHT_GALLERY_DEPLOYMENT: ThoughtGalleryDeployment | null =
  THOUGHT_V2_PRODUCTION_DEPLOYMENT
    ? {
      artifactId: THOUGHT_V2_PRODUCTION_DEPLOYMENT.artifactId,
      manifestSha256: THOUGHT_V2_PRODUCTION_DEPLOYMENT.manifestSha256,
      chainId: THOUGHT_V2_PRODUCTION_DEPLOYMENT.chainId,
      contractAddress: THOUGHT_V2_PRODUCTION_DEPLOYMENT.contracts.thoughtNft,
      deployBlock: THOUGHT_V2_PRODUCTION_DEPLOYMENT.deployBlocks.thoughtNft,
    }
    : null;

let testDeployment: ThoughtGalleryDeployment | null | undefined;

export function getThoughtGalleryDeployment(): ThoughtGalleryDeployment | null {
  return testDeployment === undefined
    ? LOCKED_THOUGHT_GALLERY_DEPLOYMENT
    : testDeployment;
}

export function thoughtGallerySnapshotKey(
  deployment = getThoughtGalleryDeployment(),
): string | null {
  if (!deployment) return null;
  return [
    "thought-gallery",
    "v2",
    deployment.chainId,
    deployment.contractAddress.toLowerCase(),
    deployment.artifactId,
    deployment.manifestSha256,
  ].join(":");
}

export function setThoughtGalleryDeploymentForTest(
  deployment: ThoughtGalleryDeployment | null | undefined,
) {
  const runtimeProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  if (runtimeProcess?.env?.NODE_ENV !== "test") {
    throw new Error("THOUGHT gallery deployment override is test-only.");
  }
  testDeployment = deployment;
}
