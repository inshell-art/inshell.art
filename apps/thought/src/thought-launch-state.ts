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

export type ThoughtLaunchGuidance = {
  eyebrow: string;
  title: string;
  detail: string;
  meta: string;
  tone: "studio" | "countdown" | "open" | "attention";
};

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

export const thoughtLaunchNetworkLabel = (
  environment: ThoughtLaunchEnvironment,
) => {
  if (environment === "mainnet") return "Ethereum Mainnet";
  if (environment === "public-beta-sepolia") return "Sepolia Public Beta";
  return "Local development";
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

export const formatThoughtLaunchCountdown = (
  openTime: string,
  nowMs: number,
) => {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((Date.parse(openTime) - nowMs) / 1000),
  );
  if (remainingSeconds === 0) return "waiting for public confirmation";
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

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

export const getThoughtLaunchGuidance = ({
  state,
  workExists,
  workCompatible,
  nowMs,
}: {
  state: ThoughtLaunchState;
  workExists: boolean;
  workCompatible: boolean;
  nowMs: number;
}): ThoughtLaunchGuidance => {
  const network = thoughtLaunchNetworkLabel(state.environment);
  if (state.phase === "studio-preview") {
    return {
      eyebrow: "CREATE",
      title: workExists ? "Your work is ready" : "Create a THOUGHT",
      detail: workExists
        ? "Save this work in your browser so you can return to it later. Minting is not available yet."
        : "Write a prompt and choose an Agent. Save the finished work in this browser if you want to keep it.",
      meta: "saved on this device · no wallet needed",
      tone: "studio",
    };
  }

  if (state.phase === "onchain-countdown") {
    const opening = state.openTime
      ? `opens ${formatLaunchTime(state.openTime)}`
      : "public launch clock is syncing";
    const countdown = state.openTime
      ? formatThoughtLaunchCountdown(state.openTime, nowMs)
      : "mint stays locked";
    return {
      eyebrow: "CREATE NOW · MINT LATER",
      title: state.openTime ? `Minting ${opening}` : "Minting date is being confirmed",
      detail: workExists
        ? "Save this work in your browser. When minting opens, you can mint it using one available THOUGHT mint from a $PATH token."
        : "Create a THOUGHT now and save it in your browser. The mint option will appear after minting opens and your work is ready.",
      meta: `${network} · ${countdown}`,
      tone: "countdown",
    };
  }

  if (workExists && !workCompatible) {
    return {
      eyebrow: "BEFORE MINTING",
      title: "Run this work again",
      detail: "This preview was created with an older approved version. Your saved prompt stays unchanged.",
      meta: `${network} · mint locked for this work`,
      tone: "attention",
    };
  }

  return {
    eyebrow: workExists ? "READY TO MINT" : "CREATE · THEN MINT",
    title: workExists
      ? "Your work is ready to mint"
      : "Create a THOUGHT",
    detail: workExists
      ? "Minting uses one available THOUGHT mint from a $PATH token. Continue when you are ready."
      : "Write a prompt and choose an Agent. The mint option appears after your Agent returns the finished work.",
    meta: `${network} · minting open`,
    tone: "open",
  };
};
