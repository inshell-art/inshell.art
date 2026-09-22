import deploymentLockJson from "../production/deployment-lock.json";
import activationPolicyJson from "../production/activation-policy.json";
import { THOUGHT_V2_CONTRACT_RELEASE } from "./thought-v2-contract-release.generated";

export const DEPLOYMENT_LOCK_SCHEMA = "inshell.thought.production-deployment-lock.v2";
export const DEPLOYMENT_CONTRACT_NAMES = [
  "pathNft", "pulseAuction", "pathPulseAdapter", "thoughtNft", "thoughtRenderer",
  "thoughtSpecRegistry", "protocolRegistry", "creationAttestationVerifier",
] as const;
type ContractName = typeof DEPLOYMENT_CONTRACT_NAMES[number];
export type ThoughtV2ProductionDeployment = {
  artifactId: string;
  manifestSha256: string;
  chainId: number;
  contracts: Record<ContractName, `0x${string}`>;
  deployBlocks: Record<ContractName, number>;
  release: { protocolReleaseId: `0x${string}`; manifestKeccak256: `0x${string}` };
  attestation: { authority: `0x${string}`; authorityEpoch: number };
};
type LockReference = {
  schema: typeof DEPLOYMENT_LOCK_SCHEMA;
  revision: number;
  requiredRelease: { artifactId: string; manifestSha256: string };
  review: { reference: string };
};
export type ThoughtDeploymentLock = LockReference & (
  | { state: "no-approved-deployment"; deployment: null; evidence: null }
  | { state: "approved-deployment"; deployment: ThoughtV2ProductionDeployment;
      evidence: { reference: string; sha256: string } }
);
export type ThoughtActivationPolicy = {
  schema: "inshell.thought.activation-policy.v1";
  revision: number;
  deploymentRevision: number;
  frontendActivationApproved: boolean;
  signerActivationApproved: boolean;
  mintActivationApproved: boolean;
  review: { reference: string };
};

const drift = (field: string): never => {
  // Field names only: configuration values and credentials never enter errors.
  throw new Error(`Deployment integrity drift: ${field}.`);
};
const object = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return drift(label);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some((key) => !(key in record))) {
    return drift(`${label} fields`);
  }
  return record;
};
const integer = (value: unknown, label: string) => {
  if (!Number.isSafeInteger(value) || Number(value) < 1) return drift(label);
  return Number(value);
};
const text = (value: unknown, pattern: RegExp, label: string): string => {
  if (typeof value !== "string" || !pattern.test(value)) return drift(label);
  return value;
};
const reference = (value: unknown, label: string) =>
  text(value, /^(?:docs|evidence)\/[A-Za-z0-9_/-]+\.(?:md|json)$/, label);
const sha256 = (value: unknown, label: string) => text(value, /^[0-9a-f]{64}$/, label);
const hex = (value: unknown, size: number, label: string): `0x${string}` => {
  const result = text(value, new RegExp(`^0x[0-9a-fA-F]{${size}}$`), label).toLowerCase();
  if (/^0x0+$/.test(result)) return drift(label);
  return result as `0x${string}`;
};

/** Always validates, including the intentional absence of an approved deployment. */
export function readThoughtDeploymentLock(value: unknown = deploymentLockJson): ThoughtDeploymentLock {
  const lock = object(value, ["schema", "revision", "state", "requiredRelease", "deployment", "evidence", "review"], "lock");
  if (lock.schema !== DEPLOYMENT_LOCK_SCHEMA) return drift("lock.schema");
  const required = object(lock.requiredRelease, ["artifactId", "manifestSha256"], "requiredRelease");
  if (required.artifactId !== THOUGHT_V2_CONTRACT_RELEASE.artifactId ||
      required.manifestSha256 !== THOUGHT_V2_CONTRACT_RELEASE.manifestSha256) return drift("requiredRelease");
  const review = object(lock.review, ["reference"], "review");
  const base: LockReference = {
    schema: DEPLOYMENT_LOCK_SCHEMA,
    revision: integer(lock.revision, "revision"),
    requiredRelease: { artifactId: String(required.artifactId), manifestSha256: String(required.manifestSha256) },
    review: { reference: reference(review.reference, "review.reference") },
  };
  if (lock.state === "no-approved-deployment") {
    if (lock.deployment !== null || lock.evidence !== null) return drift("no-approved-deployment material");
    return { ...base, state: lock.state, deployment: null, evidence: null };
  }
  if (lock.state !== "approved-deployment") return drift("lock.state");
  const item = object(lock.deployment, ["artifactId", "manifestSha256", "chainId", "contracts", "deployBlocks", "release", "attestation"], "deployment");
  if (item.artifactId !== required.artifactId || item.manifestSha256 !== required.manifestSha256) return drift("deployment.release identity");
  const contracts = object(item.contracts, DEPLOYMENT_CONTRACT_NAMES, "contracts");
  const blocks = object(item.deployBlocks, DEPLOYMENT_CONTRACT_NAMES, "deployBlocks");
  const release = object(item.release, ["protocolReleaseId", "manifestKeccak256"], "release");
  const attestation = object(item.attestation, ["authority", "authorityEpoch"], "attestation");
  const evidence = object(lock.evidence, ["reference", "sha256"], "evidence");
  const deployment: ThoughtV2ProductionDeployment = {
    artifactId: String(item.artifactId), manifestSha256: String(item.manifestSha256),
    chainId: integer(item.chainId, "chainId"),
    contracts: Object.fromEntries(DEPLOYMENT_CONTRACT_NAMES.map((key) => [key, hex(contracts[key], 40, `contracts.${key}`)])) as ThoughtV2ProductionDeployment["contracts"],
    deployBlocks: Object.fromEntries(DEPLOYMENT_CONTRACT_NAMES.map((key) => [key, integer(blocks[key], `deployBlocks.${key}`)])) as ThoughtV2ProductionDeployment["deployBlocks"],
    release: { protocolReleaseId: hex(release.protocolReleaseId, 64, "protocolReleaseId"), manifestKeccak256: hex(release.manifestKeccak256, 64, "manifestKeccak256") },
    attestation: { authority: hex(attestation.authority, 40, "authority"), authorityEpoch: integer(attestation.authorityEpoch, "authorityEpoch") },
  };
  return { ...base, state: lock.state, deployment,
    evidence: { reference: reference(evidence.reference, "evidence.reference"), sha256: sha256(evidence.sha256, "evidence.sha256") } };
}

/** Compare independently selected runtime configuration, never rewrite the reference. */
export function deploymentConfigurationDrift(lock: ThoughtDeploymentLock, actual: unknown): string[] {
  const differences: string[] = [];
  const compare = (expected: unknown, received: unknown, field: string) => {
    if (expected && typeof expected === "object") {
      if (!received || typeof received !== "object" || Array.isArray(received)) { differences.push(field); return; }
      const left = expected as Record<string, unknown>;
      const right = received as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) compare(left[key], right[key], `${field}.${key}`);
    } else if (expected !== received) differences.push(field);
  };
  compare(lock.deployment, actual, "deployment");
  return differences;
}

/** Explicit environment overrides must agree with the reference, even before deployment. */
export function deploymentOverrideDrift(values: Record<string, unknown>, lock = THOUGHT_DEPLOYMENT_LOCK): string[] {
  const deployment = lock.deployment;
  const expected: Record<string, string | number | undefined> = {
    VITE_THOUGHT_CHAIN_ID: deployment?.chainId,
    VITE_PATH_CHAIN_ID: deployment?.chainId,
    VITE_THOUGHT_PATH_AUCTION_ADDRESS: deployment?.contracts.pulseAuction,
    VITE_PULSE_AUCTION: deployment?.contracts.pulseAuction,
    VITE_THOUGHT_PATH_ADAPTER_ADDRESS: deployment?.contracts.pathPulseAdapter,
    VITE_PATH_PULSE_ADAPTER: deployment?.contracts.pathPulseAdapter,
    VITE_PATH_NFT: deployment?.contracts.pathNft,
    VITE_THOUGHT_NFT_ADDRESS: deployment?.contracts.thoughtNft,
  };
  return Object.entries(expected).flatMap(([key, value]) => {
    const actual = values[key];
    if (actual === undefined || actual === "") return [];
    return value === undefined || String(actual).toLowerCase() !== String(value).toLowerCase() ? [key] : [];
  });
}

export function assertDeploymentOverrides(values: Record<string, unknown>) {
  const differences = deploymentOverrideDrift(values);
  if (differences.length) drift(differences.join(", "));
}

export function assertDeploymentConfiguration(actual: unknown) {
  const differences = deploymentConfigurationDrift(THOUGHT_DEPLOYMENT_LOCK, actual);
  if (differences.length) drift(differences.join(", "));
}

export function readThoughtActivationPolicy(value: unknown = activationPolicyJson, lock = readThoughtDeploymentLock()): ThoughtActivationPolicy {
  const policy = object(value, ["schema", "revision", "deploymentRevision", "frontendActivationApproved", "signerActivationApproved", "mintActivationApproved", "review"], "activationPolicy");
  if (policy.schema !== "inshell.thought.activation-policy.v1") return drift("activationPolicy.schema");
  const review = object(policy.review, ["reference"], "activationPolicy.review");
  for (const key of ["frontendActivationApproved", "signerActivationApproved", "mintActivationApproved"] as const) {
    if (typeof policy[key] !== "boolean") return drift(`activationPolicy.${key}`);
    if (policy[key] && lock.state !== "approved-deployment") return drift(`activationPolicy.${key} without approved deployment`);
  }
  if (policy.deploymentRevision !== lock.revision) return drift("activationPolicy.deploymentRevision");
  return { schema: "inshell.thought.activation-policy.v1", revision: integer(policy.revision, "activationPolicy.revision"),
    deploymentRevision: lock.revision, frontendActivationApproved: policy.frontendActivationApproved as boolean,
    signerActivationApproved: policy.signerActivationApproved as boolean, mintActivationApproved: policy.mintActivationApproved as boolean,
    review: { reference: reference(review.reference, "activationPolicy.review.reference") } };
}

export const THOUGHT_DEPLOYMENT_LOCK = readThoughtDeploymentLock();
export const THOUGHT_ACTIVATION_POLICY = readThoughtActivationPolicy();
// Nullable deployment is not a nullable/disabled lock. Validation above always runs.
export const readThoughtV2ProductionDeployment = () => readThoughtDeploymentLock().deployment;
export const THOUGHT_V2_PRODUCTION_DEPLOYMENT = THOUGHT_DEPLOYMENT_LOCK.deployment;
export const THOUGHT_DEPLOYMENT_LOCK_STATUS = {
  schema: THOUGHT_DEPLOYMENT_LOCK.schema, revision: THOUGHT_DEPLOYMENT_LOCK.revision,
  enforcement: "always" as const, state: THOUGHT_DEPLOYMENT_LOCK.state,
  integrity: "valid" as const, requiredRelease: THOUGHT_DEPLOYMENT_LOCK.requiredRelease,
};
