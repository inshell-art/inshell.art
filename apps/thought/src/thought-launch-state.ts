export type ThoughtLaunchPhase =
  | "studio-preview"
  | "onchain-countdown"
  | "onchain-open";

export type ThoughtLaunchEnvironment =
  | "internal-sepolia"
  | "public-beta-sepolia"
  | "mainnet";

export type ThoughtLaunchState = {
  environment: ThoughtLaunchEnvironment;
  phase: ThoughtLaunchPhase;
  chainId: number | null;
  openTime: string | null;
  deploymentVerified: boolean;
  mintEnabled: boolean;
};

export type ThoughtLaunchDeployment = {
  artifactId: string;
  manifestSha256: string;
  chainId: number;
  pulseAuction: string;
};

export type ThoughtLaunchReadModel = {
  schema: "inshell.thought.launch-state.v1";
  artifactId: string;
  manifestSha256: string;
  chainId: number;
  pulseAuction: string;
  openTime: string;
  observedAt: string;
  status: "countdown" | "open";
};

export const THOUGHT_LAUNCH_READ_MODEL_MAX_AGE_MS = 5 * 60 * 1000;

export const shouldFetchThoughtLaunchReadModel = ({
  deployment,
  localRuntime,
  simulatedPhase,
}: {
  deployment: ThoughtLaunchDeployment | null;
  localRuntime: boolean;
  simulatedPhase: string | null;
}) => Boolean(deployment && !localRuntime && !simulatedPhase);

export type ThoughtSavedWorkLaunchEvidence = {
  thoughtSpecId?: string;
  thoughtSpecHash?: string;
  previewMethod?: string;
  previewEndpointLabel?: string;
};

export type ThoughtActiveRelease = {
  manifestSha256: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const normalizeAddress = (value: string) => value.trim().toLowerCase();
const normalizeHash = (value: string) => value.trim().toLowerCase();

const validIsoTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

const launchEnvironmentForChainId = (
  chainId: number,
): ThoughtLaunchEnvironment | null => {
  if (chainId === 1) return "mainnet";
  if (chainId === 11155111) return "public-beta-sepolia";
  return null;
};

export const studioPreviewLaunchState = (): ThoughtLaunchState => ({
  environment: "public-beta-sepolia",
  phase: "studio-preview",
  chainId: null,
  openTime: null,
  deploymentVerified: false,
  mintEnabled: false,
});

export const localThoughtLaunchState = (chainId: number): ThoughtLaunchState => ({
  environment: "internal-sepolia",
  phase: "onchain-open",
  chainId,
  openTime: null,
  deploymentVerified: true,
  mintEnabled: true,
});

export const parseThoughtLaunchReadModel = (
  value: unknown,
): ThoughtLaunchReadModel | null => {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const candidate = (
    root.launch && typeof root.launch === "object"
      ? root.launch
      : root
  ) as Record<string, unknown>;
  const openTime = typeof candidate.openTime === "string"
    ? validIsoTime(candidate.openTime)
    : null;
  const observedAt = typeof candidate.observedAt === "string"
    ? validIsoTime(candidate.observedAt)
    : null;
  if (
    candidate.schema !== "inshell.thought.launch-state.v1" ||
    typeof candidate.artifactId !== "string" ||
    !candidate.artifactId.trim() ||
    typeof candidate.manifestSha256 !== "string" ||
    !SHA256_PATTERN.test(candidate.manifestSha256) ||
    !Number.isSafeInteger(candidate.chainId) ||
    Number(candidate.chainId) < 1 ||
    typeof candidate.pulseAuction !== "string" ||
    !ADDRESS_PATTERN.test(candidate.pulseAuction) ||
    !openTime ||
    !observedAt ||
    (candidate.status !== "countdown" && candidate.status !== "open")
  ) {
    return null;
  }
  return {
    schema: "inshell.thought.launch-state.v1",
    artifactId: candidate.artifactId.trim(),
    manifestSha256: normalizeHash(candidate.manifestSha256),
    chainId: Number(candidate.chainId),
    pulseAuction: normalizeAddress(candidate.pulseAuction),
    openTime,
    observedAt,
    status: candidate.status,
  };
};

const readModelMatchesDeployment = (
  deployment: ThoughtLaunchDeployment,
  readModel: ThoughtLaunchReadModel,
) => (
  deployment.artifactId === readModel.artifactId &&
  normalizeHash(deployment.manifestSha256) === readModel.manifestSha256 &&
  deployment.chainId === readModel.chainId &&
  normalizeAddress(deployment.pulseAuction) === readModel.pulseAuction
);

export const deriveThoughtLaunchState = ({
  deployment,
  readModel,
  nowMs = Date.now(),
  maxReadModelAgeMs = THOUGHT_LAUNCH_READ_MODEL_MAX_AGE_MS,
}: {
  deployment: ThoughtLaunchDeployment | null;
  readModel: ThoughtLaunchReadModel | null;
  nowMs?: number;
  maxReadModelAgeMs?: number;
}): ThoughtLaunchState => {
  if (!deployment) return studioPreviewLaunchState();
  const environment = launchEnvironmentForChainId(deployment.chainId);
  if (!environment) return studioPreviewLaunchState();
  if (!readModel || !readModelMatchesDeployment(deployment, readModel)) {
    return {
      environment,
      phase: "onchain-countdown",
      chainId: deployment.chainId,
      openTime: null,
      deploymentVerified: true,
      mintEnabled: false,
    };
  }

  const openTimeMs = Date.parse(readModel.openTime);
  const observedAtMs = Date.parse(readModel.observedAt);
  const readModelIsFresh =
    observedAtMs <= nowMs + maxReadModelAgeMs &&
    nowMs - observedAtMs <= maxReadModelAgeMs;
  const isAuthoritativelyOpen =
    readModelIsFresh &&
    readModel.status === "open" &&
    observedAtMs >= openTimeMs;
  return {
    environment,
    phase: isAuthoritativelyOpen ? "onchain-open" : "onchain-countdown",
    chainId: deployment.chainId,
    openTime: readModel.openTime,
    deploymentVerified: true,
    mintEnabled: isAuthoritativelyOpen,
  };
};

const formatLaunchTime = (openTime: string) => new Intl.DateTimeFormat(
  undefined,
  {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  },
).format(new Date(openTime));

export const thoughtSavedWorkMatchesRelease = (
  evidence: ThoughtSavedWorkLaunchEvidence,
  release: ThoughtActiveRelease | null,
) => {
  if (!release) return false;
  const expectedEndpoint = `pinned:${normalizeHash(release.manifestSha256)}`;
  return (
    evidence.previewMethod === "frontendRender" &&
    normalizeHash(evidence.previewEndpointLabel ?? "") === expectedEndpoint &&
    normalizeHash(evidence.thoughtSpecId ?? "") ===
      normalizeHash(release.thoughtSpecId) &&
    normalizeHash(evidence.thoughtSpecHash ?? "") ===
      normalizeHash(release.thoughtSpecHash)
  );
};

export type ThoughtMintClosedNotice = {
  title: string;
  detail: string;
  nextStep: string;
};

// Copy for the moment a visitor reaches for the mint CTA while minting is
// closed. It answers the action they just took, so it opens with what is true
// of minting rather than describing the surface they are already looking at.
export const getThoughtMintClosedNotice = ({
  state,
  workCompatible,
}: {
  state: ThoughtLaunchState;
  workCompatible: boolean;
}): ThoughtMintClosedNotice => {
  if (!state.mintEnabled) {
    const opening = state.openTime ? formatLaunchTime(state.openTime) : null;
    return {
      // The title carries the state. The opening time is a fact about that
      // state, so it leads the body instead, ahead of what the visitor can do.
      title: "Minting is not open yet",
      detail: opening
        ? `Minting opens ${opening}. Save this work in your browser and it will be here then.`
        : "Save this work in your browser and it will be here when minting opens.",
      nextStep: "Save this work in your browser",
    };
  }
  if (!workCompatible) {
    return {
      title: "Run this work again first",
      detail:
        "This work was created with an older approved version. Run it again with your Agent and the new result can be minted. Your saved prompt stays unchanged.",
      nextStep: "Run this work again with your Agent",
    };
  }
  return {
    title: "This work cannot be minted yet",
    detail: "Check the Work panel for what this work still needs.",
    nextStep: "Review the Work panel",
  };
};
