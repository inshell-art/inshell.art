import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/500.css";
import "@fontsource/source-code-pro/600.css";
import "@fontsource/source-code-pro/700.css";
import "@fontsource/source-code-pro/800.css";
import "@fontsource/source-code-pro/900.css";
import "@fontsource-variable/roboto-mono/wght.css";
import "@inshell/shared/design.css";
import {
  AbiCoder,
  BrowserProvider,
  Contract,
  formatEther,
  getBytes,
  id,
  keccak256,
  toUtf8Bytes,
  type JsonRpcProvider,
  type JsonRpcSigner,
  type Log,
} from "ethers";
import {
  getProtocolReleaseAddress,
  getProtocolReleaseDeployBlock,
  getThoughtRelease,
  getThoughtReleaseContract,
  getThoughtReleaseDeployBlock,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  PUBLIC_NETWORK_CONFIG,
  PUBLIC_SEPOLIA_WALLET_RPC_URL,
  PREVIEW_WATERMARK_LABEL,
  SURFACE_TERMINOLOGY,
  buildReportBugLink,
  buildContractStatusSections,
  findContractStatusRow,
  installInshellAnonymousAnalytics,
  isPathMintHandoffId,
  maybeInstallCloudflareWebAnalytics,
  readPathMintReturnRecord,
  removePathMintReturnRecord,
  writePathMintReturnRecord,
  resolveWalletChainRpcUrls,
  shouldShowPreviewWatermark,
  trackInshellAnonymousAnalytics,
  type PublicLaunchMode,
} from "@inshell/shared";
import { openInshellWallet } from "@inshell/inshell-shell";
import {
  THOUGHT_CODEX_CLIENT_ROUTE,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_SHA256_PREFIX,
  THOUGHT_V2_PROTOCOL_RELEASE,
  assertThoughtLine,
  buildThoughtCodexTask,
  sha256Hex,
} from "@inshell/thought-agent-protocol";
import colorFontRaw from "../colorFontJSON/colorfont.byToolv2.json?raw";
import colorFontText from "../spec/COLOR_FONT.v1.txt?raw";
import localThoughtInstructions from "../spec/THOUGHT.v2.local.md?raw";
import addresses from "../evm/addresses.anvil.json";
import {
  COLOR_FONT_DOC_FORMAT,
  buildColorFontPlainText,
  validateColorFontDataShape,
  type ColorFontDoc,
} from "./color-font-doc";
import {
  createThoughtSurfaceShellAdapter,
  redactThoughtShellInput,
  shouldRecordThoughtShellInput,
} from "./surfaceShell/thoughtDispatcherAdapter";
import type { ThoughtShellState } from "./surfaceShell/thoughtShellState";
import {
  appendThoughtWork,
  getLatestWork,
  getNextWork,
  getPreviousWork,
  getWorkById,
  formatSavedWorkPromptLabel,
  parseWorkId,
  readThoughtWorks,
  writeThoughtWorks,
  type ThoughtWorkRecord,
  type WorkStorage,
} from "./works";
import {
  THOUGHT_MAX_OUTPUT_TOKENS,
  buildThoughtRunPayload,
  thoughtRunProvenanceConfig,
  toAnthropicMessagesPayload,
  toOllamaGeneratePayload,
  toOpenAIResponsesPayload,
  toOpenRouterChatPayload,
  type ThoughtRunPayload,
  type ThoughtRunProvider,
  type ThoughtRunProvenanceRequestConfig,
  type ThoughtRunWebConfig,
} from "./thought-run-payload";
import {
  THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY,
  THOUGHT_PREVIEW_AUTO_RATE_LIMIT,
  THOUGHT_PREVIEW_CACHE_LIMIT,
  THOUGHT_PREVIEW_MANUAL_RATE_LIMIT,
  THOUGHT_PREVIEW_MODE_STORAGE_KEY,
  THOUGHT_PREVIEW_TIMEOUT_MS,
  formatThoughtByteLimitUsage,
  isPreviewMode,
  normalizePreviewMode,
  prevalidateThoughtCandidate,
  previewUnavailableCliLines,
  previewRejectionReasonLabel,
  type PreviewMode,
  type PreviewProviderKind,
  type PreviewStatus,
  type ThoughtByteLimitUsage,
} from "./thought-preview-policy";
import { createSingleRequestJsonRpcProvider } from "./rpc-provider";
import {
  formatThoughtAuthorizationError,
  getThoughtWorkReadyPresentation,
  THOUGHT_PANEL_MINT_UI_MODE,
  THOUGHT_V2_MINT_UNAVAILABLE_COPY,
  type MintFlowUiMode,
  type ThoughtAuthorizationStage,
} from "./thought-mint-ui";
import {
  THOUGHT_CONSOLE_HISTORY_STORAGE_KEY,
  appendThoughtConsoleContextBoundary,
  appendThoughtConsoleEvent,
  buildThoughtConsoleLines,
  createThoughtConsoleHistory,
  parseThoughtConsoleHistory,
  serializeThoughtConsoleHistory,
  type ThoughtConsoleContext,
  type ThoughtConsoleEntry,
  type ThoughtConsoleTone,
} from "./thought-console";
import {
  presentThoughtMint,
  type ThoughtMintPresentation,
} from "./thought-mint-presentation";
import {
  THOUGHT_PATH_ACQUISITION_STORAGE_KEY,
  parsePendingThoughtPathAcquisition,
  pendingThoughtPathAcquisitionMatches,
  serializePendingThoughtPathAcquisition,
  withThoughtPathAcquisitionLock,
  type PendingThoughtPathAcquisition,
  type ThoughtPathAcquisitionState,
} from "./thought-path-acquisition";
import {
  THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY,
  THOUGHT_PENDING_MINT_TX_STORAGE_KEY,
  classifyMintTrackingFailure,
  createMintSubmissionContext,
  createPendingMintTransaction,
  mintReceiptStatusOutcome,
  parsePendingMintTransaction,
  parseConflictingMintTransactions,
  parseMintTransactionReplacement,
  pendingMintTransactionMatches,
  planPendingMintRestore,
  replacePendingMintTransactionHash,
  serializePendingMintTransaction,
  serializeConflictingMintTransactions,
  type MintSubmissionContext,
  type PendingMintTransaction,
} from "./thought-mint-transaction";
import {
  createMintAttemptId,
  waitForMintSubmissionOrRelease,
  withMintSubmissionLock,
  type MintSubmissionLockEnvironment,
} from "./thought-mint-submission-lock";
import { canonicalThoughtTitle, thoughtProtocolText } from "./thought-display-text";
import {
  THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES,
  THOUGHT_V2_LOCAL_NFT_ABI,
  buildThoughtV2LocalProvenance,
  thoughtV2AgentLineHash,
  type ThoughtV2LocalProcess,
} from "./thought-v2-local-mint";
import {
  buildThoughtV2LocalAgentProcess,
  buildThoughtV2LocalAgentResult,
  parseThoughtV2LocalAgentResult,
  type ThoughtV2LocalAgentEvidence,
} from "./thought-v2-local-agent";
import {
  buildThoughtAgentFixtureLine,
  shouldUseThoughtAgentFixture,
} from "./thought-agent-fixture";
import {
  THOUGHT_V2_LOCAL_RELEASE,
  isThoughtV2LocalMintRuntime,
} from "./thought-v2-local-release";
import {
  THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,
  isThoughtV2LocalDeploymentError,
  verifyThoughtV2LocalDeployment,
} from "./thought-v2-local-deployment";
import {
  createThoughtPollWakeScheduler,
  hasThoughtPollDeadlineExpired,
} from "./thought-poll-wake";
import {
  buildThoughtV2Svg,
  measureThoughtV2Line,
  type ThoughtV2LineKind,
} from "./thought-v2-renderer";
import {
  describeThoughtTextPolicyIssue,
  type ThoughtTextPolicyIssue,
} from "./thought-text-policy";
import {
  getThoughtShellWallet,
  mountThoughtShell,
  subscribeThoughtShellWallet,
} from "./thought-shell";

declare global {
  var __INSHELL_VITE_ENV__: Record<string, unknown> | undefined;
  var __VITE_ENV__: Record<string, unknown> | undefined;
}

const runtimeEnv: Record<string, unknown> = {
  ...(globalThis.__INSHELL_VITE_ENV__ ?? {}),
  ...import.meta.env,
  VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
};

globalThis.__VITE_ENV__ = runtimeEnv;
maybeInstallCloudflareWebAnalytics({ env: runtimeEnv });
installInshellAnonymousAnalytics({ env: runtimeEnv });

type ColorFontFile = {
  colors: Array<{
    index: number;
    hex: string;
  }>;
};

type DrawImage = {
  char: string;
  fill: string;
};

type Mode = "connect" | "direct" | "local" | "my-brain" | "codex";

type DirectProviderId = "openai" | "openrouter" | "anthropic";

type ModelSourceId = DirectProviderId | "ollama" | "my-brain" | "codex";

type ProviderConfig = {
  id: DirectProviderId;
  label: string;
  defaultModel: string;
};

type ModelOption = {
  id: string;
  label: string;
};

type ThoughtTextAreaElement = HTMLElement & {
  autocomplete: string;
  placeholder: string;
  readOnly: boolean;
  rows: number;
  spellcheck: boolean;
  value: string;
  focus(): void;
};

type PendingMyBrainRound = {
  route: "my-brain";
  provider: "me";
  model: "my-brain";
  prompt: string;
  thoughtSpecId: string;
  thoughtSpecRef: string;
  thoughtSpecHash: string;
  startedAt: string;
  payload: ThoughtRunPayload;
};

type ThoughtInstructionsOverride = {
  name: string;
  content: string;
};

type ThoughtSessionState = {
  routeConfigured: boolean;
  mode: Mode;
  prompt: string;
  connect: {
    apiKey: string;
    model: string;
  };
  direct: {
    provider: DirectProviderId;
    apiKeys: Record<DirectProviderId, string>;
    model: string;
  };
  local: {
    available: boolean | null;
    endpoint: string;
    model: string;
  };
  codex: {
    model: string;
  };
};

type StoredThoughtSessionState = {
  version: 1;
  routeConfigured: boolean;
  mode: Mode;
  prompt: string;
  connect: {
    model: string;
  };
  direct: {
    provider: DirectProviderId;
    model: string;
  };
  local: {
    endpoint: string;
    model: string;
  };
  codex?: {
    model: string;
  };
};

type EvmAddresses = {
  rpcUrl?: string;
  chainId?: number;
  explorerUrl?: string;
  recommendedThoughtSpecName?: string;
  recommendedThoughtSpecId?: string;
  recommendedThoughtSpecHash?: string;
  pathNft?: {
    address?: string;
  };
  pathPulseAdapter?: {
    address?: string;
  };
  pulseAuction?: {
    address?: string;
  };
  paymentToken?: {
    address?: string;
  };
  thoughtSpecRegistry?: {
    address?: string;
  };
  protocolRegistry?: {
    address?: string;
  };
  thoughtRenderer?: {
    address?: string;
  };
  thoughtNft?: {
    address?: string;
  };
  protocolRelease?: {
    id?: string;
    manifestHash?: string;
    rendererProfileHash?: string;
    workProfileHash?: string;
    status?: string;
  };
  thoughtSpec?: {
    specName?: string;
    id?: string;
    hash?: string;
    ref?: string;
  };
  thoughtSpecs?: Array<{
    specName?: string;
    specId?: string;
    specHash?: string;
    ref?: string;
    pointer?: string;
    byteLength?: number;
  }>;
  colorFontV1?: {
    address?: string;
  };
};

type EthereumProvider = {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

type MintTxState = "idle" | "awaiting_signature" | "submitted" | "failed";
type MintFlowErrorKind =
  | "none"
  | "thought"
  | "spec"
  | "path_invalid"
  | "path_not_found"
  | "path_consumed"
  | "path_not_ready"
  | "path_unknown"
  | "path_mint_pending"
  | "path_mint_chain_mismatch"
  | "wallet_account_mismatch"
  | "wrong_network"
  | "funds"
  | "signature"
  | "mint";
type MintFlowState =
  | "closed"
  | "thought_checking"
  | "text_taken"
  | "wallet_required"
  | "path_required"
  | "path_checking"
  | "path_ready"
  | "authorizing"
  | "authorized"
  | "minting"
  | "minted"
  | "error";

type ThoughtRunState = "idle" | "running" | "candidate_ready" | "output_ready" | "run_failed";

type PrimaryActionState =
  | "run"
  | "retry_run"
  | "connect_wallet"
  | "switch_wallet"
  | "mint"
  | "retry_mint"
  | "none";

type SecondaryActionState = "reset" | "view_thought" | "view_tx" | "none";

type ThoughtDebugCtaOverride =
  | "auto"
  | "run"
  | "running"
  | "retry"
  | "mint"
  | "view_thought";

type ThoughtDebugCtaStatusOverride =
  | "auto"
  | "none"
  | "ready"
  | "minted"
  | "model_needed"
  | "generation_failed"
  | "mint_unavailable";

type ThoughtDebugWarningOverride =
  | "auto"
  | "none"
  | "prompt_required"
  | "model_required"
  | "openrouter_required"
  | "api_key_required"
  | "ollama_not_found"
  | "spec_unavailable"
  | "provider_error"
  | "external_service"
  | "openrouter_connect_constraint"
  | "wallet_missing"
  | "wallet_connect_failed"
  | "wallet_switch_failed"
  | "thought_too_large"
  | "mint_contract_unavailable";

type PanelWarningLevel = "info" | "warn" | "error";

type ThoughtDebugState = {
  open: boolean;
  enabled: boolean;
  cta: ThoughtDebugCtaOverride;
  ctaStatus: ThoughtDebugCtaStatusOverride;
  warning: ThoughtDebugWarningOverride;
};

type ActionPresentation = {
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryAction: PrimaryActionState;
  status: string;
  secondaryLabel: string;
  secondaryAction: SecondaryActionState;
  hidePrimary?: boolean;
};

type MintSheetAction =
  | "none"
  | "continue"
  | "connect_wallet"
  | "disconnect_wallet"
  | "authorize"
  | "confirm_mint"
  | "view_tx"
  | "view_thought"
  | "choose_another"
  | "enter_path_manually"
  | "mint_path"
  | "confirm_path_mint"
  | "view_path_tx"
  | "recover_submission"
  | "reset"
  | "switch_network";

type MintSheetActionConfig = {
  action: MintSheetAction;
  disabled?: boolean;
  hidden?: boolean;
  label: string;
};

type MintSheetReviewRow = {
  href?: string;
  label: string;
  value: string;
};

type MintSheetReviewConfig = {
  note?: string;
  rows?: MintSheetReviewRow[];
  verifyLink?: boolean;
};

type CliEntryKind = "intro" | "command" | "output" | "error";

type CliEntry = {
  kind: CliEntryKind;
  lines: string[];
};

type CliSuggestion = {
  label: string;
  command: string;
};

type WalletDotState = "off" | "on" | "pending" | "warn" | "error";

type ThoughtWalletState = {
  detected: boolean;
  address: string;
  chainId: number | null;
  txState: MintTxState;
  txHash: string;
  txError: string;
  balance: bigint | null;
  preflightLoading: boolean;
  preflightError: string;
  mintedTokenId: number | null;
};

type MintFlowData = {
  rawText: string;
  textHash: string;
  promptHash: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
  provenanceJson: string;
  existingTokenId: number | null;
  pathIdInput: string;
  pathId: bigint | null;
  deadline: bigint | null;
  signature: string;
  txHash: string;
  error: string;
  errorKind: MintFlowErrorKind;
};

type PathMintHandoff = {
  version: 1;
  attemptId: string;
  workHash: string;
  account: string;
  chainId?: number | null;
  work?: {
    output: string;
    svg: string;
    runContext: ThoughtRunContext | null;
    workId: number | null;
  };
  createdAt: number;
};

type PathInventoryItem = {
  pathId: bigint;
  status: string;
};

type PathInventoryState = {
  status: "idle" | "loading" | "loaded" | "unavailable" | "error";
  wallet: string;
  chainId: number | null;
  items: PathInventoryItem[];
  error: string;
};

type PathInventoryReadResult =
  | {
      kind: "ok";
      items: PathInventoryItem[];
    }
  | {
      kind: "unavailable";
      message: string;
    };

type ThoughtRunContext = {
  mode: Mode;
  provider: ThoughtRunProvider;
  model: string;
  prompt: string;
  returnedText?: string;
  clientGeneratedAt: string;
  previewProvider?: ThoughtPreviewProviderTrace;
  request?: ThoughtRunProvenanceRequestConfig;
  web?: ThoughtRunWebConfig;
  thoughtSpec?: {
    id: string;
    ref: string;
    hash: string;
  };
  agentEvidence?: ThoughtV2LocalAgentEvidence;
};

type ThoughtSpecAnchor = {
  id: string;
  ref: string;
  hash: string;
};

type ThoughtPreviewProviderTrace = {
  kind: PreviewProviderKind;
  chainId?: number;
  endpointLabel?: string;
  contractAddress?: string;
  method: "frontendRender" | "previewWork" | "previewSvg";
  fetchedAt: string;
};

type ThoughtPreviewProvider = {
  kind: Exclude<PreviewProviderKind, "none">;
  chainId: number;
  endpointLabel?: string;
  preview(rawReturn: string, context?: { prompt?: string }): Promise<ContractWorkPreview>;
  trace(): ThoughtPreviewProviderTrace;
};

type ThoughtCandidate = {
  id: string;
  prompt: string;
  rawModelReturn: string;
  route: Mode;
  provider: ThoughtRunProvider;
  model: string;
  specAnchor: ThoughtSpecAnchor;
  createdAt: string;
  status: "candidate";
  previewStatus: PreviewStatus;
  previewError?: string;
  payload: ThoughtRunPayload;
  normalizedCandidate?: string;
  rawReturnHash: string;
  normalizedCandidateHash?: string;
  automaticPreviewAttempted: boolean;
  previewProvider?: ThoughtPreviewProviderTrace;
  agentEvidence?: ThoughtV2LocalAgentEvidence;
};

type ThoughtAgentRunCreateResponse = {
  protocolVersion?: string;
  runId?: string;
  state?: string;
  launchUri?: string;
  browserToken?: string;
  statusUrl?: string;
  createdAt?: string;
  claimExpiresAt?: string;
  devAutoRun?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

type ThoughtAgentRunStatusResponse = {
  protocolVersion?: string;
  runId?: string;
  state?: string;
  stage?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  claimAuthorization?: ThoughtClaimAuthorization;
  request?: {
    promptLine?: {
      text?: string | null;
      sha256?: string | null;
    };
    requestedAgent?: {
      adapterId?: string | null;
      model?: string | null;
    };
    thoughtSpec?: {
      id?: string | null;
      ref?: string | null;
      sha256?: string | null;
      contractSpecHash?: string | null;
    };
    agentInput?: {
      mediaType?: string | null;
      text?: string | null;
      sha256?: string | null;
    };
  };
  result?: {
    raw?: string | null;
    rawSha256?: string | null;
    agentLine?: string | null;
    receipt?: {
      receiptVersion?: string | null;
      receiptSha256?: string | null;
      adapterId?: string | null;
      model?: string | null;
      providerAttested?: boolean | null;
    };
  };
  validation?: {
    status?: string | null;
    canonicalText?: string | null;
    error?: string | null;
  };
  error?: {
    code?: string | null;
    message?: string | null;
  };
};

type ThoughtClaimAuthorization = {
  state?: "pending" | "authorized" | "consumed";
  claimRequestId?: string;
  verificationCode?: string;
  bridge?: {
    bridgeId?: string;
    platform?: string;
  };
  adapter?: {
    adapterId?: string;
    adapterVersion?: string;
  };
  requestedAt?: string;
  expiresAt?: string;
  authorizedAt?: string | null;
};

type PendingThoughtAgentRun = {
  runId: string;
  statusUrl: string;
  browserToken: string;
  payload: ThoughtRunPayload;
  createdAt: string;
};

type ContractPreviewAttemptResult =
  | {
      kind: "accepted";
      preview: ContractWorkPreview;
      trace: ThoughtPreviewProviderTrace;
      fromCache: boolean;
    }
  | {
      kind: "unavailable";
      lines: string[];
    }
  | {
      kind: "rejected";
      error: ContractWorkPreviewError;
    };

type ThoughtNFTMetadata = {
  name?: string;
  image?: string;
  thought?: {
    text?: string;
    provenance?: string;
  };
  properties?: {
    rawText?: string;
    provenanceJson?: string;
    textHash?: string;
    promptHash?: string;
    provenanceHash?: string;
    thoughtSpecId?: string;
    thoughtSpecHash?: string;
    pathId?: string | number;
    minter?: string;
    mintedAt?: string | number;
  };
};

type ThoughtNFTUriPayload = {
  metadata: ThoughtNFTMetadata;
  image: string;
};

type GalleryThought = {
  tokenId: number;
  pathId: string;
  minter: string;
  textHash: string;
  promptHash: string;
  provenanceHash: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
  mintedAt: number | null;
  rawText: string;
  prompt: string;
  mode: string;
  provider: string;
  model: string;
  returnedText: string;
  returnedTextHash: string;
  provenanceJson: string;
  image: string;
  tokenUri: string;
  txHash: string;
  blockNumber: number;
};

type GalleryThoughtCachePayload = {
  cachedAt: number;
  thoughts: GalleryThought[];
};

type ThoughtDetailSpec = {
  id: string;
  ref: string;
  hash: string;
  text: string;
};

type ThoughtDetail = {
  tokenId: number;
  rawText: string;
  prompt: string;
  returnedText: string;
  pathId: string;
  minter: string;
  mintedAt: number | null;
  txHash: string;
  textHash: string;
  promptHash: string;
  returnedTextHash: string;
  provenanceHash: string;
  mode: string;
  provider: string;
  model: string;
  thoughtSpec: ThoughtDetailSpec;
  provenanceJson: string;
  image: string;
};

type ActiveThoughtSpec = {
  specId: string;
  specHash: string;
  ref: string;
  pointer: string;
  byteLength: number;
  text: string;
  fetchedAt: string;
};

const CANVAS_WIDTH = 960;
const MIN_CANVAS_SIZE = 180;
const STACKED_MIN_CLI_HEIGHT = 160;
const IMAGE_SIZE = 29;
const IMAGE_GAP = 6;
const CANVAS_PADDING = 28;
const IMAGE_RADIUS = 0;
const BACKGROUND_FILL = "#000000";
const CANVAS_LABEL_FILL = "#ffffff";
const THOUGHT_SESSION_STORAGE_KEY = "thought-provider-session";
const THOUGHT_CLI_HISTORY_STORAGE_KEY = "thought-cli-command-history";
const THOUGHT_CLI_TRANSCRIPT_STORAGE_KEY = "thought-cli-transcript";
const THOUGHT_OUTPUT_STORAGE_KEY = "thought-current-output";
const THOUGHT_INSTRUCTIONS_OVERRIDE_KEY = "thought-instructions-override";
const THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY = "thought-agent-pending-run";
const THOUGHT_PATH_MINT_HANDOFF_STORAGE_KEY = "thought-path-mint-handoff-v1";
const ENABLE_THOUGHT_UPLOAD = window.location.port === "5188";
const OPENROUTER_PKCE_VERIFIER_KEY = "thought-openrouter-pkce-verifier";
const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_MODEL_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const MANUAL_MODEL_VALUE = "__manual__";
const OPENROUTER_DEFAULT_MODEL = "openrouter/free";
const LOCAL_MODEL_SOURCE_ID = "ollama";
const LOCAL_MODEL_LABEL = "ollama";
const LOCAL_DEFAULT_MODEL = "llama3.2:1b";
const MY_BRAIN_MODE = "my-brain";
const MY_BRAIN_MODEL_SOURCE_ID = "my-brain";
const MY_BRAIN_MODEL = "my-brain";
const MY_BRAIN_PROVIDER = "me";
const MY_BRAIN_DESCRIPTION = "human model route. you write the model return.";
const CODEX_MODE = "codex";
const CODEX_MODEL_SOURCE_ID = "codex";
const CODEX_MODEL = "codex";
const CODEX_PROVIDER = "codex";
const CODEX_DESCRIPTION = "local Bridge route. opens Codex for one THOUGHT round.";
const getStorageOrNull = (storage: () => Storage | null | undefined) => {
  try {
    const resolved = storage();
    resolved?.getItem("__thought_storage_probe__");
    return resolved ?? null;
  } catch {
    return null;
  }
};

const getSessionStorage = () => getStorageOrNull(() => window.sessionStorage);

const mintSubmissionLockEnvironment = (): MintSubmissionLockEnvironment => ({
  locks: typeof navigator.locks?.request === "function"
    ? navigator.locks as unknown as MintSubmissionLockEnvironment["locks"]
    : null,
  crypto: window.crypto,
});

const safeStorageGet = (storage: Storage | null, key: string) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeStorageSet = (storage: Storage | null, key: string, value: string) => {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeStorageRemove = (storage: Storage | null, key: string) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Browser storage is only the durable copy; live state remains in memory.
  }
};

const getPathMintReturnStorageHost = () => ({
  localStorage: getStorageOrNull(() => window.localStorage),
  sessionStorage: getSessionStorage(),
});

const readSharedBrowserItem = (key: string) => {
  const local = getStorageOrNull(() => window.localStorage);
  const session = getSessionStorage();
  const raw = safeStorageGet(local, key);
  if (raw !== null) {
    return raw;
  }

  const legacy = safeStorageGet(session, key);
  if (legacy !== null && safeStorageSet(local, key, legacy)) {
    safeStorageRemove(session, key);
  }
  return legacy;
};

const writeSharedBrowserItem = (key: string, value: string) => {
  const local = getStorageOrNull(() => window.localStorage);
  const session = getSessionStorage();
  if (safeStorageSet(local, key, value)) {
    safeStorageRemove(session, key);
    return;
  }
  safeStorageSet(session, key, value);
};

const removeSharedBrowserItem = (key: string) => {
  safeStorageRemove(getStorageOrNull(() => window.localStorage), key);
  safeStorageRemove(getSessionStorage(), key);
};

const readPendingPathAcquisition = () => {
  const pending = parsePendingThoughtPathAcquisition(
    readSharedBrowserItem(THOUGHT_PATH_ACQUISITION_STORAGE_KEY),
  );
  if (!pending) {
    removeSharedBrowserItem(THOUGHT_PATH_ACQUISITION_STORAGE_KEY);
  }
  return pending;
};

const writePendingPathAcquisition = (pending: PendingThoughtPathAcquisition | null) => {
  if (!pending) {
    removeSharedBrowserItem(THOUGHT_PATH_ACQUISITION_STORAGE_KEY);
    return;
  }
  writeSharedBrowserItem(
    THOUGHT_PATH_ACQUISITION_STORAGE_KEY,
    serializePendingThoughtPathAcquisition(pending),
  );
};

const thoughtBrowserStorage: WorkStorage = {
  getItem: readSharedBrowserItem,
  setItem: writeSharedBrowserItem,
  removeItem: removeSharedBrowserItem,
};

const readPendingMintTransaction = (): PendingMintTransaction | null => {
  const local = getStorageOrNull(() => window.localStorage);
  const session = getSessionStorage();
  const plan = planPendingMintRestore({
    currentRaw: safeStorageGet(local, THOUGHT_PENDING_MINT_TX_STORAGE_KEY),
    legacySessionRaw: safeStorageGet(session, THOUGHT_PENDING_MINT_TX_STORAGE_KEY),
  });

  if (plan.persistedRaw) {
    writeSharedBrowserItem(THOUGHT_PENDING_MINT_TX_STORAGE_KEY, plan.persistedRaw);
  } else if (!plan.transaction) {
    removeSharedBrowserItem(THOUGHT_PENDING_MINT_TX_STORAGE_KEY);
  }
  return plan.transaction;
};

const writePendingMintTransaction = (transaction: PendingMintTransaction | null) => {
  if (!transaction) {
    removeSharedBrowserItem(THOUGHT_PENDING_MINT_TX_STORAGE_KEY);
    return;
  }
  writeSharedBrowserItem(
    THOUGHT_PENDING_MINT_TX_STORAGE_KEY,
    serializePendingMintTransaction(transaction),
  );
};

const readConflictingMintTransactions = () =>
  [...parseConflictingMintTransactions(
    readSharedBrowserItem(THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY),
  )];

const writeConflictingMintTransactions = (
  transactions: readonly PendingMintTransaction[],
) => {
  if (transactions.length === 0) {
    removeSharedBrowserItem(THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY);
    return;
  }
  writeSharedBrowserItem(
    THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY,
    serializeConflictingMintTransactions(transactions),
  );
};

const pathMintHandoffStorageKey = (attemptId: string) =>
  `${THOUGHT_PATH_MINT_HANDOFF_STORAGE_KEY}:${attemptId}`;

const writePathMintHandoff = (handoff: PathMintHandoff) => {
  writeSharedBrowserItem(
    pathMintHandoffStorageKey(handoff.attemptId),
    JSON.stringify(handoff),
  );
};

const removePathMintHandoff = (attemptId: string) => {
  removeSharedBrowserItem(pathMintHandoffStorageKey(attemptId));
  removeSharedBrowserItem(THOUGHT_PATH_MINT_HANDOFF_STORAGE_KEY);
};

const readPathMintHandoff = (): PathMintHandoff | null => {
  const handoffId = new URLSearchParams(window.location.search).get("pathHandoff")?.trim() ?? "";
  if (handoffId && !isPathMintHandoffId(handoffId)) {
    return null;
  }
  const storageKey = handoffId
    ? pathMintHandoffStorageKey(handoffId)
    : THOUGHT_PATH_MINT_HANDOFF_STORAGE_KEY;
  const raw = readSharedBrowserItem(storageKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PathMintHandoff>;
    const work = value.work as Partial<NonNullable<PathMintHandoff["work"]>> | undefined;
    if (
      value.version !== 1 ||
      !isPathMintHandoffId(value.attemptId) ||
      typeof value.workHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(value.workHash) ||
      typeof value.account !== "string" ||
      (value.account !== "" && !/^0x[0-9a-fA-F]{40}$/.test(value.account)) ||
      (value.chainId !== undefined && value.chainId !== null && typeof value.chainId !== "number") ||
      (work !== undefined && (
        typeof work.output !== "string" ||
        !work.output ||
        typeof work.svg !== "string" ||
        (work.workId !== null && work.workId !== undefined &&
          (!Number.isSafeInteger(work.workId) || Number(work.workId) <= 0))
      )) ||
      typeof value.createdAt !== "number" ||
      Date.now() - value.createdAt > 86_400_000
    ) {
      removeSharedBrowserItem(storageKey);
      return null;
    }
    if (handoffId && value.attemptId !== handoffId) {
      removeSharedBrowserItem(storageKey);
      return null;
    }
    return value as PathMintHandoff;
  } catch {
    removeSharedBrowserItem(storageKey);
    return null;
  }
};

const readStoredThoughtWorks = () => readThoughtWorks(thoughtBrowserStorage);

const writeStoredThoughtWorks = (works: ThoughtWorkRecord[]) => {
  writeThoughtWorks(thoughtBrowserStorage, works);
};
const ROUTE_COPY: Record<Mode, {
  provider: string;
  defaultModelLabel: string;
  brief: string;
  stateLabel: string;
  useLines: string[];
}> = {
  local: {
    provider: LOCAL_MODEL_SOURCE_ID,
    defaultModelLabel: "<ollama model>",
    brief: "local model route. runs on this machine.",
    stateLabel: "ollama",
    useLines: [
      "config local detect",
      "config local endpoint <url>",
      "config local model list",
      "config local model <id>",
      "run",
    ],
  },
  connect: {
    provider: "openrouter",
    defaultModelLabel: "<openrouter model>",
    brief: "delegated model route. uses openrouter authorization.",
    stateLabel: "openrouter",
    useLines: [
      "config connect authorize",
      "config connect disconnect",
      "config connect model list",
      "config connect model <id>",
      "run",
    ],
  },
  direct: {
    provider: "<provider>",
    defaultModelLabel: "<provider model>",
    brief: "raw-key model route. uses a session provider key.",
    stateLabel: "api key",
    useLines: [
      "config direct provider list",
      "config direct provider <id>",
      "config direct key <api-key>",
      "config direct key clear",
      "config direct model list",
      "config direct model <id>",
      "run",
    ],
  },
  "my-brain": {
    provider: MY_BRAIN_PROVIDER,
    defaultModelLabel: MY_BRAIN_MODEL,
    brief: MY_BRAIN_DESCRIPTION,
    stateLabel: MY_BRAIN_MODEL,
    useLines: [
      "prompt <text>",
      "run",
    ],
  },
  codex: {
    provider: CODEX_PROVIDER,
    defaultModelLabel: CODEX_MODEL,
    brief: CODEX_DESCRIPTION,
    stateLabel: "THOUGHT Bridge",
    useLines: [
      "config codex",
      "prompt <text>",
      "run",
    ],
  },
};
const NOTICE_FLASH_MS = 2400;
const AGENT_REQUEST_TIMEOUT_MS = 45000;
const THOUGHT_AGENT_STATUS_POLL_MS = 1000;
const THOUGHT_AGENT_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const THOUGHT_DOCK_RETURN_RECEIVED_MS = 420;
const PREFLIGHT_REQUEST_TIMEOUT_MS = 15000;
const PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS = 15000;
const WALLET_TX_SUBMIT_TIMEOUT_MS = 60000;
const MINT_RECEIPT_TIMEOUT_MS = 120000;
const MINT_RECEIPT_WAIT_TIMEOUT_MS = 15000;
const MINT_RECEIPT_POLL_MS = 1000;
const MINT_RECOVERY_NONCE_RECHECK_MS = 1200;
const MINT_RECEIPT_MONITOR_TIMEOUT_MESSAGE = "mint receipt monitoring timed out.";
const CHAIN_LOADING_DETAIL_MS = 1400;
const CLI_PROGRESS_DETAIL_ROTATE_TICKS = 3;
const CLI_COMMAND_HISTORY_LIMIT = 80;
const APP_VERSION = "0.0.2";
const APP_BUILD = typeof import.meta.env.VITE_APP_BUILD === "string" && import.meta.env.VITE_APP_BUILD
  ? import.meta.env.VITE_APP_BUILD
  : "dev";
const IS_DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === "development";
const MAX_RAW_RETURN_BYTES = 512;
const MAX_TEXT_BYTES = 128;
const COLOR_FONT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COLOR_FONT_CANONICAL_URL = "https://inshell.art/color-font";
const SVG_TEXT_MIN_SIZE = 9;
const SVG_TEXT_MAX_SIZE = 18;
const SVG_TEXT_CHAR_ADVANCE = 0.6;
const CANVAS_TEXT_FAMILY =
  '"Roboto Mono Variable", "Roboto Mono", "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const OPENROUTER_PREFERRED_MODELS = [
  OPENROUTER_DEFAULT_MODEL,
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.6-plus",
  "mistralai/mistral-small-2603",
  "openai/gpt-5.4-mini",
  "meta-llama/llama-3.3-70b-instruct:free",
];
const FRONTEND_NETWORK =
  typeof runtimeEnv.VITE_NETWORK === "string" && runtimeEnv.VITE_NETWORK.trim()
    ? runtimeEnv.VITE_NETWORK.trim().toLowerCase()
    : import.meta.env.MODE === "sepolia"
      ? "sepolia"
      : "";

const buildSepoliaEvmAddresses = (): EvmAddresses | null => {
  const release = getThoughtRelease("sepolia");
  if (!release) {
    return null;
  }
  const spec = release.recommended_thought_spec;
  const pathNft = release.path_dependency?.pathNft || getThoughtReleaseContract("path_nft", "sepolia") || "";
  const thoughtNft = getThoughtReleaseContract("thought_nft", "sepolia") || "";
  const thoughtSpecRegistry = getThoughtReleaseContract("thought_spec_registry", "sepolia") || "";
  const colorFontV1 = getThoughtReleaseContract("color_font_v1", "sepolia") || "";

  return {
    rpcUrl: PUBLIC_SEPOLIA_WALLET_RPC_URL,
    chainId: release.chain_id,
    explorerUrl: PUBLIC_NETWORK_CONFIG.explorerBaseUrl,
    recommendedThoughtSpecName: spec?.name,
    recommendedThoughtSpecId: spec?.id,
    recommendedThoughtSpecHash: spec?.hash,
    pathNft: { address: pathNft },
    thoughtSpecRegistry: { address: thoughtSpecRegistry },
    thoughtNft: { address: thoughtNft },
    colorFontV1: { address: colorFontV1 },
    thoughtSpec: spec
      ? {
          specName: spec.name,
          id: spec.id,
          hash: spec.hash,
          ref: spec.ref,
        }
      : undefined,
    thoughtSpecs: spec
      ? [
          {
            specName: spec.name,
            specId: spec.id,
            specHash: spec.hash,
            ref: spec.ref,
            byteLength: spec.byteLength,
          },
        ]
      : undefined,
  };
};

const EVM_ADDRESSES = FRONTEND_NETWORK === "sepolia"
  ? buildSepoliaEvmAddresses() ?? (addresses as EvmAddresses)
  : (addresses as EvmAddresses);
const THOUGHT_CHAIN_ID = EVM_ADDRESSES.chainId ?? 31337;
const THOUGHT_CHAIN_ID_HEX = `0x${THOUGHT_CHAIN_ID.toString(16)}`;
const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const RECOMMENDED_THOUGHT_SPEC_ID =
  EVM_ADDRESSES.recommendedThoughtSpecId?.trim() ||
  EVM_ADDRESSES.thoughtSpec?.id?.trim() ||
  EVM_ADDRESSES.thoughtSpecs?.[0]?.specId?.trim() ||
  "";
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const THOUGHT_AGENT_FIXTURE_MODE = shouldUseThoughtAgentFixture({
  dev: IS_DEV_MODE,
  hostname: window.location.hostname,
  search: window.location.search,
});
const DEPLOY_ENV =
  typeof import.meta.env.VITE_DEPLOY_ENV === "string"
    ? import.meta.env.VITE_DEPLOY_ENV.trim().toLowerCase()
    : "";
const DEPLOY_HOSTNAME = window.location.hostname.toLowerCase();
const isPreviewHostname = (hostname: string) =>
  hostname === "preview.inshell.art" ||
  hostname.endsWith(".preview.inshell.art") ||
  hostname === "staging.inshell-art.pages.dev" ||
  hostname === "staging.thought-inshell-art.pages.dev" ||
  (hostname.startsWith("staging.") && hostname.endsWith(".pages.dev"));
const IS_PREVIEW_DEPLOYMENT =
  DEPLOY_ENV === "preview" || isPreviewHostname(DEPLOY_HOSTNAME);

const readConfiguredUrl = (name: string) => {
  const value = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
};

const normalizeThoughtRouteBase = (value: string) => {
  const raw = value.trim().replace(/\/+$/g, "");
  if (!raw || raw === "/") return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const inferThoughtRouteBase = () => {
  const pathname = window.location.pathname.replace(/\/+$/g, "") || "/";
  return pathname === "/thought" || pathname.startsWith("/thought/") ? "/thought" : "";
};

const THOUGHT_ROUTE_BASE = normalizeThoughtRouteBase(
  readConfiguredUrl("VITE_THOUGHT_ROUTE_BASE") || inferThoughtRouteBase(),
);

const thoughtRoutePath = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!THOUGHT_ROUTE_BASE) return normalized;
  if (normalized === "/") return THOUGHT_ROUTE_BASE;
  return `${THOUGHT_ROUTE_BASE}${normalized}`;
};

const sameOriginAppOrigin = () => {
  if (LOCAL_BROWSER_HOSTS.has(window.location.hostname) && window.location.port === "5174") {
    return "http://127.0.0.1:5173";
  }
  return window.location.origin;
};

const sameOriginAppUrl = (path: string) => new URL(path, sameOriginAppOrigin()).toString();

const logicalThoughtRoutePathname = (pathname: string) => {
  const normalized = pathname.replace(/\/+$/g, "") || "/";
  if (!THOUGHT_ROUTE_BASE) return normalized;
  if (normalized === THOUGHT_ROUTE_BASE) return "/";
  if (!normalized.startsWith(`${THOUGHT_ROUTE_BASE}/`)) return normalized;
  const suffix = normalized.slice(THOUGHT_ROUTE_BASE.length) || "/";
  if (/^\/[1-9]\d*$/.test(suffix)) {
    return `${THOUGHT_ROUTE_BASE}${suffix}`;
  }
  return suffix;
};

const resolveBrowserRpcUrl = (rpcUrl: string) => {
  try {
    return new URL(rpcUrl, window.location.origin).toString();
  } catch {
    return rpcUrl;
  }
};

const THOUGHT_AGENT_API_BASE = resolveBrowserRpcUrl(
  readConfiguredUrl("VITE_THOUGHT_AGENT_API_BASE") || "/api/thought-agent/v2",
).replace(/\/+$/g, "");

const thoughtAgentApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${THOUGHT_AGENT_API_BASE}/`).toString();
};

const THOUGHT_DOCK_AGENT_API_BASE = resolveBrowserRpcUrl("/api/thought-agent/v2").replace(/\/+$/g, "");

const thoughtDockAgentApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${THOUGHT_DOCK_AGENT_API_BASE}/`).toString();
};

const thoughtDockAgentApiOrigin = () =>
  new URL(`${THOUGHT_DOCK_AGENT_API_BASE}/`, window.location.origin).origin;

const resolveThoughtDockAgentStatusUrl = (statusUrl: string) => {
  try {
    return new URL(statusUrl).toString();
  } catch {
    const base = new URL(`${THOUGHT_DOCK_AGENT_API_BASE}/`, window.location.origin);
    if (statusUrl.startsWith("/")) {
      return new URL(statusUrl, base.origin).toString();
    }
    return new URL(statusUrl, base).toString();
  }
};

const resolveThoughtDockAgentLaunchUri = (launchUri: string) => {
  try {
    const url = new URL(launchUri);
    url.searchParams.set("api_origin", thoughtDockAgentApiOrigin());
    return url.toString();
  } catch {
    return launchUri;
  }
};

const THOUGHT_BRIDGE_NOT_CONNECTED_MESSAGE = "THOUGHT Bridge not connected.";

const shouldShowLocalThoughtBridgeCommand = () => {
  if (!IS_DEV_MODE || !LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return false;
  }
  const origin = thoughtAgentApiOrigin();
  return origin === "http://127.0.0.1:5176" || origin === "http://localhost:5176";
};

const localThoughtBridgeServeCommand = () => "node scripts/thought-bridge-dev.mjs serve";

const thoughtBridgeOpenLines = () => [
  "open THOUGHT Bridge on this machine.",
  "",
  "normal user:",
  "open the installed THOUGHT Bridge app.",
  "keep it running while this page uses Codex.",
  "",
  ...(shouldShowLocalThoughtBridgeCommand()
    ? [
        "this dev build:",
        "run in repo:",
        localThoughtBridgeServeCommand(),
        "",
      ]
    : []),
  "then return here.",
  "use: retry run",
];

const thoughtBridgeInstallLines = () => [
  "install THOUGHT Bridge on this machine.",
  "",
  "normal user:",
  "download and install the THOUGHT Bridge app,",
  "then open it before running Codex.",
  "",
  ...(shouldShowLocalThoughtBridgeCommand()
    ? [
        "this dev build has no packaged installer yet.",
        "use the local bridge script instead:",
        localThoughtBridgeServeCommand(),
        "",
      ]
    : []),
  "then return here.",
  "use: retry run",
];

const thoughtBridgeNotConnectedLines = () => [
  "run blocked.",
  THOUGHT_BRIDGE_NOT_CONNECTED_MESSAGE,
  "",
  "Codex runs through a local bridge app.",
  "It must be installed and open on this machine.",
  "",
  "use: open bridge",
  "use: install bridge",
  "use: retry run",
];

const thoughtAgentApiOrigin = () =>
  new URL(`${THOUGHT_AGENT_API_BASE}/`, window.location.origin).origin;

const resolveThoughtAgentStatusUrl = (statusUrl: string) => {
  try {
    return new URL(statusUrl).toString();
  } catch {
    const base = new URL(`${THOUGHT_AGENT_API_BASE}/`, window.location.origin);
    if (statusUrl.startsWith("/")) {
      return new URL(statusUrl, base.origin).toString();
    }
    return new URL(statusUrl, base).toString();
  }
};

const resolveThoughtAgentLaunchUri = (launchUri: string) => {
  try {
    const url = new URL(launchUri);
    url.searchParams.set("api_origin", thoughtAgentApiOrigin());
    return url.toString();
  } catch {
    return launchUri;
  }
};

const shellSingleQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const shouldShowThoughtAgentDevBridgeCommand = () => {
  if (!IS_DEV_MODE || !LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return false;
  }
  const origin = thoughtAgentApiOrigin();
  return origin === "http://127.0.0.1:5174" || origin === "http://localhost:5174";
};

const appendThoughtAgentDevBridgeCommand = (launchUri: string) => {
  if (!shouldShowThoughtAgentDevBridgeCommand()) {
    return;
  }

  appendCliOutput([
    "if THOUGHT Bridge did not open:",
    "run in repo:",
    `pnpm thought-bridge:dev run-url ${shellSingleQuote(launchUri)}`,
  ]);
};

const resolveThoughtRpcUrl = () => {
  const envRpcUrl =
    typeof import.meta.env.VITE_THOUGHT_RPC_URL === "string" ? import.meta.env.VITE_THOUGHT_RPC_URL.trim() : "";
  const configuredRpcUrl = envRpcUrl || EVM_ADDRESSES.rpcUrl?.trim() || "";
  if (!configuredRpcUrl || envRpcUrl || THOUGHT_CHAIN_ID !== 31337 || !LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return resolveBrowserRpcUrl(configuredRpcUrl);
  }

  try {
    const parsed = new URL(configuredRpcUrl, window.location.origin);
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString();
  } catch {
    return configuredRpcUrl;
  }
};
const THOUGHT_RPC_URL = resolveThoughtRpcUrl();
const resolvePathRpcUrl = () => {
  const configuredPathRpcUrl = readConfiguredUrl("VITE_PATH_RPC_URL") || readConfiguredUrl("VITE_ETH_RPC");
  if (configuredPathRpcUrl) {
    return resolveBrowserRpcUrl(configuredPathRpcUrl);
  }
  if (LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return THOUGHT_RPC_URL;
  }
  return resolveBrowserRpcUrl("/api/path-rpc");
};
const PATH_RPC_URL = resolvePathRpcUrl();
const thoughtPreviewEndpointEnabledEnv =
  typeof import.meta.env.VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED === "string"
    ? import.meta.env.VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED.trim().toLowerCase()
    : "";
const THOUGHT_PREVIEW_ENDPOINT_ENABLED = thoughtPreviewEndpointEnabledEnv
  ? thoughtPreviewEndpointEnabledEnv === "true"
  : IS_DEV_MODE && LOCAL_BROWSER_HOSTS.has(window.location.hostname);
const THOUGHT_PREVIEW_ENDPOINT_URL =
  typeof import.meta.env.VITE_THOUGHT_PREVIEW_ENDPOINT_URL === "string" &&
  import.meta.env.VITE_THOUGHT_PREVIEW_ENDPOINT_URL.trim()
    ? import.meta.env.VITE_THOUGHT_PREVIEW_ENDPOINT_URL.trim()
    : "/api/thought-preview";
const walletChainRpcUrl =
  typeof import.meta.env.VITE_WALLET_CHAIN_RPC_URL === "string"
    ? import.meta.env.VITE_WALLET_CHAIN_RPC_URL.trim()
    : "";
const THOUGHT_WALLET_RPC_URLS = resolveWalletChainRpcUrls({
  chainId: THOUGHT_CHAIN_ID,
  readRpcUrl: THOUGHT_RPC_URL,
  walletRpcUrl: walletChainRpcUrl,
  currentOrigin: window.location.origin,
  localFallbackRpcUrl: "http://127.0.0.1:8546",
});
const PATH_NFT_ADDRESS = EVM_ADDRESSES.pathNft?.address?.trim() ?? "";
const PATH_PULSE_ADAPTER_ADDRESS =
  (typeof import.meta.env.VITE_THOUGHT_PATH_ADAPTER_ADDRESS === "string"
    ? import.meta.env.VITE_THOUGHT_PATH_ADAPTER_ADDRESS.trim()
    : "") ||
  EVM_ADDRESSES.pathPulseAdapter?.address?.trim() ||
  "";
const PATH_AUCTION_ADDRESS =
  (typeof import.meta.env.VITE_THOUGHT_PATH_AUCTION_ADDRESS === "string"
    ? import.meta.env.VITE_THOUGHT_PATH_AUCTION_ADDRESS.trim()
    : "") ||
  EVM_ADDRESSES.pulseAuction?.address?.trim() ||
  "";
const defaultPathMintUrl = () => {
  if (LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return sameOriginAppUrl("/path");
  }
  return IS_PREVIEW_DEPLOYMENT ? "https://preview.inshell.art/path" : "https://inshell.art/path";
};
const PATH_MINT_URL =
  typeof import.meta.env.VITE_PATH_MINT_URL === "string" && import.meta.env.VITE_PATH_MINT_URL.trim()
    ? import.meta.env.VITE_PATH_MINT_URL.trim()
    : defaultPathMintUrl();
const PATH_MINT_ABSOLUTE_URL = new URL(PATH_MINT_URL, sameOriginAppOrigin()).toString();
const INSHELL_HOME_URL = LOCAL_BROWSER_HOSTS.has(window.location.hostname)
  ? sameOriginAppUrl("/")
  : IS_PREVIEW_DEPLOYMENT
    ? "https://preview.inshell.art/"
    : "https://inshell.art/";
const PATH_VERIFY_CONTRACTS_URL = new URL("/verify#verify-contracts", PATH_MINT_ABSOLUTE_URL).toString();
const GALLERY_URL =
  readConfiguredUrl("VITE_GALLERY_URL") ||
  readConfiguredUrl("VITE_THOUGHT_GALLERY_URL") ||
  (LOCAL_BROWSER_HOSTS.has(window.location.hostname)
    ? sameOriginAppUrl("/gallery")
    : IS_PREVIEW_DEPLOYMENT
      ? "https://preview.inshell.art/gallery"
      : "https://inshell.art/gallery");
const THOUGHT_APP_URL =
  readConfiguredUrl("VITE_THOUGHT_URL") ||
  (LOCAL_BROWSER_HOSTS.has(window.location.hostname)
    ? sameOriginAppUrl(thoughtRoutePath("/"))
    : IS_PREVIEW_DEPLOYMENT
      ? "https://preview.inshell.art/thought"
      : "https://inshell.art/thought");
const defaultThoughtDetailBaseUrl = () => {
  if (LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
    return sameOriginAppUrl(thoughtRoutePath("/"));
  }
  return IS_PREVIEW_DEPLOYMENT ? "https://preview.inshell.art/thought" : "https://inshell.art/thought";
};
const THOUGHT_DETAIL_BASE_URL = (() => {
  const configured = readConfiguredUrl("VITE_THOUGHT_DETAIL_BASE_URL");
  const fallback = defaultThoughtDetailBaseUrl();
  if (!configured) return fallback;
  try {
    const url = new URL(configured, window.location.origin);
    const host = url.hostname.toLowerCase();
    if (
      host.startsWith("gallery.") ||
      host.includes(".gallery.") ||
      host.startsWith("thought.") ||
      host.includes(".thought.")
    ) {
      return fallback;
    }
    if (
      IS_PREVIEW_DEPLOYMENT &&
      host !== "preview.inshell.art" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
      return fallback;
    }
    if (
      !IS_PREVIEW_DEPLOYMENT &&
      !LOCAL_BROWSER_HOSTS.has(window.location.hostname) &&
      host !== "inshell.art"
    ) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
})();

const GALLERY_API_URL =
  readConfiguredUrl("VITE_GALLERY_API_URL") ||
  readConfiguredUrl("VITE_THOUGHT_GALLERY_API_URL") ||
  "/api/thought-gallery";
const PATH_TOKENS_API_URL = readConfiguredUrl("VITE_PATH_TOKENS_API_URL") || "/api/path-tokens";
const THOUGHT_SPEC_REGISTRY_ADDRESS = EVM_ADDRESSES.thoughtSpecRegistry?.address?.trim() ?? "";
const THOUGHT_PROTOCOL_REGISTRY_ADDRESS = EVM_ADDRESSES.protocolRegistry?.address?.trim() ?? "";
const THOUGHT_RENDERER_ADDRESS = EVM_ADDRESSES.thoughtRenderer?.address?.trim() ?? "";
const THOUGHT_NFT_ADDRESS = EVM_ADDRESSES.thoughtNft?.address?.trim() ?? "";
const THOUGHT_SPEC_BYTE_LENGTH = EVM_ADDRESSES.thoughtSpecs?.[0]?.byteLength ?? 0;
const IS_LOCAL_THOUGHT_V2 = isThoughtV2LocalMintRuntime({
  dev: IS_DEV_MODE,
  hostname: window.location.hostname.toLowerCase(),
  rpcUrl: THOUGHT_RPC_URL,
  pathRpcUrl: PATH_RPC_URL,
  chainId: THOUGHT_CHAIN_ID,
  contracts: {
    pathNft: PATH_NFT_ADDRESS,
    thoughtNft: THOUGHT_NFT_ADDRESS,
    thoughtSpecRegistry: THOUGHT_SPEC_REGISTRY_ADDRESS,
    thoughtRenderer: THOUGHT_RENDERER_ADDRESS,
    protocolRegistry: THOUGHT_PROTOCOL_REGISTRY_ADDRESS,
  },
  protocolReleaseId: EVM_ADDRESSES.protocolRelease?.id?.trim() ?? "",
  manifestHash: EVM_ADDRESSES.protocolRelease?.manifestHash?.trim() ?? "",
  rendererProfileHash: EVM_ADDRESSES.protocolRelease?.rendererProfileHash?.trim() ?? "",
  workProfileHash: EVM_ADDRESSES.protocolRelease?.workProfileHash?.trim() ?? "",
  specId: RECOMMENDED_THOUGHT_SPEC_ID,
  specHash: EVM_ADDRESSES.recommendedThoughtSpecHash?.trim() ?? "",
  specByteLength: THOUGHT_SPEC_BYTE_LENGTH,
});
const protocolLineInput = (value: string) => IS_LOCAL_THOUGHT_V2 ? value : value.trim();
const THOUGHT_AGENT_REGISTERED_SPEC_ID = IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId
  : THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId;
const THOUGHT_V2_MINT_ENABLED =
  THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled || IS_LOCAL_THOUGHT_V2;
const thoughtInstructions = IS_LOCAL_THOUGHT_V2
  ? localThoughtInstructions
  : THOUGHT_V2_PROTOCOL_RELEASE.spec.text;
const thoughtInstructionsUrl = IS_LOCAL_THOUGHT_V2
  ? `data:text/markdown;charset=utf-8,${encodeURIComponent(localThoughtInstructions)}`
  : THOUGHT_V2_PROTOCOL_RELEASE.publicSpecPath;
const MAX_PROVENANCE_BYTES = IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES
  : 2048;
const COLOR_FONT_V1_ADDRESS = EVM_ADDRESSES.colorFontV1?.address?.trim() ?? "";
const THOUGHT_CHAIN_NAME =
  THOUGHT_CHAIN_ID === 31337 ? "Anvil Local" : THOUGHT_CHAIN_ID === 11155111 ? "Sepolia" : "THOUGHT";
const THOUGHT_ENVIRONMENT_LABEL = THOUGHT_CHAIN_ID === 31337 ? "Local development" : PUBLIC_NETWORK_CONFIG.environmentLabel;
const THOUGHT_CURRENCY_LABEL = THOUGHT_CHAIN_ID === 31337 ? "local ETH" : PUBLIC_NETWORK_CONFIG.currencyLabel;
const configuredExplorerBaseUrl =
  typeof import.meta.env.VITE_THOUGHT_EXPLORER_BASE_URL === "string" &&
  import.meta.env.VITE_THOUGHT_EXPLORER_BASE_URL.trim()
    ? import.meta.env.VITE_THOUGHT_EXPLORER_BASE_URL.trim().replace(/\/$/, "")
    : "";
const addressExplorerBaseUrl = EVM_ADDRESSES.explorerUrl?.trim().replace(/\/$/, "") ?? "";
const chainExplorerBaseUrl =
  THOUGHT_CHAIN_ID === 1
    ? "https://etherscan.io"
    : THOUGHT_CHAIN_ID === 11155111
      ? "https://sepolia.etherscan.io"
      : "";
const THOUGHT_EXPLORER_BASE_URL = configuredExplorerBaseUrl || addressExplorerBaseUrl || chainExplorerBaseUrl;
const thoughtTxUrl = (txHash: string) => (THOUGHT_EXPLORER_BASE_URL ? `${THOUGHT_EXPLORER_BASE_URL}/tx/${txHash}` : "");
const thoughtAddressUrl = (address: string) =>
  THOUGHT_EXPLORER_BASE_URL && address ? `${THOUGHT_EXPLORER_BASE_URL}/address/${address}` : "";
const PATH_MOVEMENT_THOUGHT = "0x54484f5547485400000000000000000000000000000000000000000000000000";
const PATH_NFT_DEPLOY_BLOCK =
  THOUGHT_CHAIN_ID === 31337
    ? 0
    : getProtocolReleaseDeployBlock("path_nft") ??
      getProtocolReleaseDeployBlock("path_nft", "sepolia") ??
      0;
const PATH_LOG_CHUNK_SIZE = 5_000;
const THOUGHT_NFT_DEPLOY_BLOCK =
  THOUGHT_CHAIN_ID === 11155111
    ? getThoughtReleaseDeployBlock("thought_nft") ??
      getThoughtReleaseDeployBlock("thought_nft", "sepolia") ??
      0
    : 0;
const THOUGHT_LOG_CHUNK_SIZE = 5_000;
const THOUGHT_GALLERY_CACHE_TTL_MS = 60_000;
const THOUGHT_GALLERY_LOADING_DETAILS = [
  "checking latest block",
  "scanning THOUGHT mint logs",
  "collecting token ids",
  "reading token metadata",
  "building gallery",
] as const;
const PATH_LIST_LOADING_DETAILS = [
  "reading from chain: wallet $PATH inventory",
  "reading from chain: checking latest block",
  "reading from chain: scanning $PATH transfer logs",
  "reading from chain: collecting token ids",
  "reading from chain: checking current owners",
  "reading from chain: checking THOUGHT quota status",
] as const;
const PATH_CHECK_LOADING_DETAILS = [
  "reading from chain: checking wallet",
  "reading from chain: owner",
  "reading from chain: stage and quota",
  "reading from chain: THOUGHT mint status",
] as const;
const MINT_PREP_LOADING_DETAILS = [
  "preparing THOUGHT mint.",
  "checking THOUGHT.md.",
  "checking duplicate text.",
  "checking wallet state.",
] as const;
const ERC721_TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const CONSUME_AUTHORIZATION_TYPEHASH = id(
  "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 nonce,uint256 deadline)",
);
const PATH_CONSUME_AUTH_TTL_SECONDS = 3600n;
const ROUTE_SEARCH_PARAMS = new URLSearchParams(window.location.search);
const ROUTE_PATHNAME = logicalThoughtRoutePathname(window.location.pathname);
const IS_COLOR_FONT_PAGE = ROUTE_PATHNAME === "/color-font";
const IS_VERIFY_PAGE = ROUTE_PATHNAME === "/verify";
const IS_AGENT_DEMO_PAGE = ROUTE_PATHNAME === "/agent-demo";
const ROUTE_RUN_MATCH = /^\/runs\/([A-Za-z0-9_-]+)$/.exec(ROUTE_PATHNAME);
const ROUTE_RUN_ID = ROUTE_RUN_MATCH?.[1] ?? "";
const IS_RUN_PAGE = Boolean(ROUTE_RUN_ID);
const ROUTE_PLUGIN_MATCH = /^\/plugin(?:\/(codex|claude))?$/.exec(ROUTE_PATHNAME);
const ROUTE_PLUGIN_AGENT = (ROUTE_PLUGIN_MATCH?.[1] ?? "") as "" | ThoughtDockAgentAdapterId;
const IS_PLUGIN_PAGE = Boolean(ROUTE_PLUGIN_MATCH);
const IS_CLI_DEBUG = ROUTE_SEARCH_PARAMS.get("debug") === "cli";
if (IS_VERIFY_PAGE && !LOCAL_BROWSER_HOSTS.has(window.location.hostname)) {
  window.location.replace(PATH_VERIFY_CONTRACTS_URL);
}
const RAW_PRESELECTED_PATH_ID = ROUTE_SEARCH_PARAMS.get("path")?.trim() ?? "";
const PRESELECTED_PATH_ID = /^[1-9]\d*$/.test(RAW_PRESELECTED_PATH_ID) ? RAW_PRESELECTED_PATH_ID : "";
const ROUTE_THOUGHT_PATH_MATCH = /^\/thought\/([1-9]\d*)$/.exec(ROUTE_PATHNAME);
const ROUTE_THOUGHT_HASH_MATCH = /^#thought-([1-9]\d*)$/.exec(window.location.hash);
const IS_GALLERY_HOST =
  window.location.hostname === "gallery.inshell.art" ||
  window.location.hostname === "gallery.preview.inshell.art";
const IS_GALLERY_PATH = ROUTE_PATHNAME === "/gallery";
const IS_GALLERY_PAGE =
  !IS_COLOR_FONT_PAGE &&
  !IS_VERIFY_PAGE &&
  !IS_AGENT_DEMO_PAGE &&
  !IS_PLUGIN_PAGE &&
  !IS_RUN_PAGE &&
  (IS_GALLERY_HOST ||
    IS_GALLERY_PATH ||
    ROUTE_SEARCH_PARAMS.get("gallery") === "1" ||
    window.location.hash === "#gallery" ||
    ROUTE_THOUGHT_HASH_MATCH !== null);
const RAW_ROUTE_THOUGHT_NFT_ID =
  ROUTE_THOUGHT_PATH_MATCH?.[1] ??
  ROUTE_THOUGHT_HASH_MATCH?.[1] ??
  ROUTE_SEARCH_PARAMS.get("thought")?.trim() ??
  "";
const ROUTE_THOUGHT_NFT_ID = /^[1-9]\d*$/.test(RAW_ROUTE_THOUGHT_NFT_ID)
  ? Number(RAW_ROUTE_THOUGHT_NFT_ID)
  : null;
const GALLERY_TARGET_TOKEN_ID = IS_GALLERY_PAGE ? ROUTE_THOUGHT_NFT_ID : null;
const IS_THOUGHT_PAGE =
  !IS_COLOR_FONT_PAGE &&
  !IS_VERIFY_PAGE &&
  !IS_AGENT_DEMO_PAGE &&
  !IS_PLUGIN_PAGE &&
  !IS_RUN_PAGE &&
  !IS_GALLERY_PAGE &&
  ROUTE_THOUGHT_NFT_ID !== null;
const THOUGHT_MINTED_TOPIC = id(
  IS_LOCAL_THOUGHT_V2
    ? "ThoughtMinted(uint256,address,bytes32,bytes32,bytes32,bytes32,bytes32,uint256,uint256,bytes32,bytes32)"
    : "ThoughtMinted(uint256,address,uint256,bytes32,bytes32,bytes32,bytes32,uint64)",
);
const TOKEN_URI_CALL_GAS_LIMIT = 100_000_000n;
const THOUGHT_V1_NFT_ABI = [
  "error EmptyProvenance()",
  "error EmptyThoughtText()",
  "error NonCanonicalThoughtText()",
  "error ProvenanceTooLarge(uint256 size, uint256 max)",
  "error ThoughtAlreadyMinted(bytes32 textHash, uint256 tokenId)",
  "error ThoughtTextTooLarge(uint256 actual, uint256 max)",
  "error InvalidThoughtSpecPair(bytes32 thoughtSpecId, bytes32 thoughtSpecHash)",
  "function mint(string rawText, uint256 pathId, bytes32 thoughtSpecId, bytes32 thoughtSpecHash, bytes32 promptHash, string provenanceJson, uint256 deadline, bytes pathSignature) returns (uint256)",
  "function previewText(string input) pure returns (string normalized, bool valid, uint8 reasonCode)",
  "function previewWork(string rawReturn) pure returns (bool ok, string text, string svg, uint8 reasonCode)",
  "function renderThoughtSvg(string canonicalText) pure returns (string)",
  "function textHashOf(string canonicalText) pure returns (bytes32)",
  "function tokenOfThought(bytes32 textHash) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function rawTextOf(uint256 tokenId) view returns (string)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function recordOf(uint256 tokenId) view returns (bytes32 textHash, bytes32 promptHash, bytes32 provenanceHash, bytes32 thoughtSpecId, bytes32 thoughtSpecHash, uint256 pathId, address minter, uint64 mintedAt)",
  "function thoughtSpecOf(uint256 tokenId) view returns (bytes32 specId, bytes32 specHash, string specName, string ref)",
  "function totalSupply() view returns (uint256)",
  "function thoughtText(uint256 tokenId) view returns (string)",
  "function authorOf(uint256 tokenId) view returns (address)",
  "function colorFont() view returns (address)",
  "function colorFontId() view returns (string)",
  "function colorFontVersion() view returns (string)",
  "function colorFontLength() view returns (uint8)",
  "function colorFontData() view returns (string)",
  "function colorFontHash() view returns (bytes32)",
  "function colorFontGlyph(uint8 index) view returns (string letter, uint8 ordinal, string aliasTerm, string hexColor)",
  "function colorFontGlyphOf(bytes1 letter) view returns (uint8 ordinal, string aliasTerm, string hexColor)",
  "event ThoughtMinted(uint256 indexed tokenId, address indexed minter, uint256 indexed pathId, bytes32 textHash, bytes32 provenanceHash, bytes32 thoughtSpecId, bytes32 thoughtSpecHash, uint64 mintedAt)",
] as const;
const THOUGHT_NFT_ABI = IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_NFT_ABI
  : THOUGHT_V1_NFT_ABI;
const COLOR_FONT_V1_ABI = [
  "function id() pure returns (string)",
  "function version() pure returns (string)",
  "function length() pure returns (uint8)",
  "function data() pure returns (string)",
  "function hash() pure returns (bytes32)",
  "function glyph(uint8 index) pure returns (string letter, uint8 ordinal, string aliasTerm, string hexColor)",
  "function glyphOf(bytes1 letter) pure returns (uint8 ordinal, string aliasTerm, string hexColor)",
] as const;
const PATH_NFT_ABI = [
  "function getConsumeNonce(address claimer) view returns (uint256)",
  "function getAuthorizedMinter(bytes32 movement) view returns (address)",
  "function getMovementQuota(bytes32 movement) view returns (uint32)",
  "function isMovementFrozen(bytes32 movement) view returns (bool)",
  "function getStage(uint256 tokenId) view returns (uint8)",
  "function getStageMinted(uint256 tokenId) view returns (uint32)",
  "function ownerOf(uint256 tokenId) view returns (address)",
] as const;
const PATH_PULSE_ADAPTER_ABI = [
  "function auction() view returns (address)",
  "function pathNft() view returns (address)",
  "function wiringFrozen() view returns (bool)",
] as const;
const PATH_AUCTION_ABI = [
  "function bid(uint256 maxPrice) payable",
  "function curveActive() view returns (bool)",
  "function getCurrentPrice() view returns (uint256)",
  "function mintAdapter() view returns (address)",
  "function paymentToken() view returns (address)",
] as const;
const THOUGHT_SPEC_REGISTRY_ABI = [
  "function latestThoughtSpecId() view returns (bytes32)",
  "function thoughtSpecMeta(bytes32 specId) view returns (bool exists, string specName, bytes32 specHash, string ref, address pointer, uint32 byteLength, uint64 registeredAt)",
  "function thoughtSpecText(bytes32 specId) view returns (string)",
  "function validateThoughtSpec(bytes32 specId, bytes32 specHash) view returns (bool)",
  "function isRegisteredThoughtSpec(bytes32 specId, bytes32 specHash) view returns (bool)",
] as const;
const EVM_ABI_CODER = AbiCoder.defaultAbiCoder();

const DIRECT_PROVIDERS: Record<DirectProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "openai",
    defaultModel: "gpt-5-mini",
  },
  openrouter: {
    id: "openrouter",
    label: "openrouter",
    defaultModel: OPENROUTER_DEFAULT_MODEL,
  },
  anthropic: {
    id: "anthropic",
    label: "anthropic",
    defaultModel: "claude-3-5-haiku-latest",
  },
};

const STATIC_MODEL_OPTIONS: Record<ModelSourceId, ModelOption[]> = {
  openai: [
    { id: "gpt-5-mini", label: "gpt-5-mini" },
    { id: "gpt-5", label: "gpt-5" },
    { id: "gpt-5.4-mini", label: "gpt-5.4-mini" },
    { id: "gpt-5.4", label: "gpt-5.4" },
  ],
  openrouter: OPENROUTER_PREFERRED_MODELS.map((model) => ({ id: model, label: model })),
  anthropic: [
    { id: "claude-3-5-haiku-latest", label: "claude-3-5-haiku-latest" },
    { id: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
    { id: "claude-opus-4-5", label: "claude-opus-4-5" },
  ],
  ollama: [{ id: LOCAL_DEFAULT_MODEL, label: LOCAL_DEFAULT_MODEL }],
  "my-brain": [{ id: MY_BRAIN_MODEL, label: MY_BRAIN_MODEL }],
  codex: [{ id: CODEX_MODEL, label: CODEX_MODEL }],
};

const parsedColorFont = JSON.parse(colorFontRaw) as ColorFontFile;
const COLOR_FONT = Object.fromEntries(
  parsedColorFont.colors
    .slice()
    .sort((left, right) => left.index - right.index)
    .map((entry, index) => [COLOR_FONT_ALPHABET[index] ?? "?", entry.hex])
    .filter(([letter]) => letter !== "?"),
) as Record<string, string>;

const frontpageShell = document.querySelector(".frontpage-shell") as HTMLElement | null;
const thoughtShellRoot = document.getElementById("thought-shell-root") as HTMLElement | null;
const frontpageStage = document.querySelector(".frontpage-stage") as HTMLElement | null;
const frontpageMain = document.querySelector(".frontpage-main") as HTMLElement | null;
const frontpageTitle = document.getElementById("frontpage-title") as HTMLElement | null;
const modeConnectButton = document.getElementById("mode-connect") as HTMLButtonElement | null;
const modeDirectButton = document.getElementById("mode-direct") as HTMLButtonElement | null;
const modeLocalButton = document.getElementById("mode-local") as HTMLButtonElement | null;
const modeCodexButton = document.getElementById("mode-codex") as HTMLButtonElement | null;
const thoughtCliTranscript = document.getElementById("thought-cli-transcript") as HTMLElement | null;
const thoughtCliSuggestions = document.getElementById("thought-cli-suggestions") as HTMLElement | null;
const thoughtCliForm = document.getElementById("thought-cli-form") as HTMLFormElement | null;
const thoughtCliPrompt = document.querySelector(".thought-cli__prompt") as HTMLLabelElement | null;
const thoughtCliInput = document.getElementById("thought-cli-input") as HTMLInputElement | null;
const connectPanel = document.getElementById("connect-panel") as HTMLElement | null;
const connectOpenRouterButton = document.getElementById("connect-openrouter") as HTMLButtonElement | null;
const connectStatusRow = document.getElementById("connect-status-row") as HTMLElement | null;
const connectStatusCopy = document.getElementById("connect-status-copy") as HTMLElement | null;
const disconnectOpenRouterButton = document.getElementById("disconnect-openrouter") as HTMLButtonElement | null;
const providerField = document.getElementById("provider-field") as HTMLElement | null;
const providerBox = document.getElementById("provider-box") as HTMLSelectElement | null;
const apiKeyField = document.getElementById("api-key-field") as HTMLElement | null;
const apiKeyLabel = document.querySelector('label[for="api-key-box"]') as HTMLLabelElement | null;
const apiKeyBox = document.getElementById("api-key-box") as HTMLInputElement | null;
const localModelField = document.getElementById("local-model-field") as HTMLElement | null;
const localModelValue = document.getElementById("local-model-value") as HTMLElement | null;
const localStatus = document.getElementById("local-status") as HTMLElement | null;
const localHelper = document.getElementById("local-helper") as HTMLElement | null;
const thoughtCanvasPanel = document.querySelector(".thought-canvas-panel") as HTMLElement | null;
const thoughtCanvasFrame = document.querySelector(".thought-canvas-frame") as HTMLElement | null;
const thoughtPanel = document.getElementById("thought-panel") as HTMLElement | null;
const thoughtDock = document.getElementById("thought-dock") as HTMLElement | null;
const thoughtDockPrompt = document.getElementById("thought-dock-prompt") as HTMLInputElement | null;
const thoughtDockPath = document.getElementById("thought-dock-path") as HTMLElement | null;
const thoughtDockPathInventory = document.getElementById("thought-dock-path-inventory") as HTMLElement | null;
const thoughtDockPathInventoryLabel = document.getElementById("thought-dock-path-inventory-label") as HTMLElement | null;
const thoughtDockPathInventorySelect = document.getElementById("thought-dock-path-inventory-select") as HTMLSelectElement | null;
const thoughtDockPathFlow = document.getElementById("thought-dock-path-flow") as HTMLElement | null;
const thoughtDockMintStep = document.getElementById("thought-dock-mint-step") as HTMLElement | null;
const thoughtDockPathTitle = document.getElementById("thought-dock-path-title") as HTMLElement | null;
const thoughtDockPathPrimary = document.getElementById("thought-dock-path-primary") as HTMLButtonElement | null;
const thoughtDockPathSecondary = document.getElementById("thought-dock-path-secondary") as HTMLButtonElement | null;
const thoughtDockPathTertiary = document.getElementById("thought-dock-path-tertiary") as HTMLButtonElement | null;
const thoughtDockWorks = document.getElementById("thought-dock-works") as HTMLElement | null;
const thoughtDockWorksLabel = document.getElementById("thought-dock-works-label") as HTMLLabelElement | null;
const thoughtDockWorksSelect = document.getElementById("thought-dock-works-select") as HTMLSelectElement | null;
const thoughtDockActionArea = document.getElementById("thought-dock-action-area") as HTMLElement | null;
const thoughtDockDetails = document.getElementById("thought-dock-details") as HTMLElement | null;
const thoughtDockDetailsBody = document.getElementById("thought-dock-details-body") as HTMLElement | null;
const modelBox = document.getElementById("model-box") as HTMLSelectElement | null;
const modelManualBox = document.getElementById("model-manual-box") as HTMLInputElement | null;
const promptBox = document.getElementById("prompt-box") as HTMLInputElement | null;
const thoughtFileField = document.getElementById("thought-file-field") as HTMLElement | null;
const uploadThoughtFileButton = document.getElementById("upload-thought-file") as HTMLButtonElement | null;
const clearThoughtFileButton = document.getElementById("clear-thought-file") as HTMLButtonElement | null;
const thoughtFileInput = document.getElementById("thought-file-input") as HTMLInputElement | null;
const thoughtFileStatus = document.getElementById("thought-file-status") as HTMLElement | null;
const runAgentButton = document.getElementById("run-agent") as HTMLButtonElement | null;
const actionStatusCopy = document.getElementById("action-status-copy") as HTMLElement | null;
const resetThoughtButton = document.getElementById("reset-thought") as HTMLButtonElement | null;
const runStatus = document.getElementById("run-status") as HTMLElement | null;
const warningBox = document.getElementById("input-warning") as HTMLElement | null;
const thoughtDebug = document.getElementById("thought-debug") as HTMLElement | null;
const thoughtDebugToggle = document.getElementById("thought-debug-toggle") as HTMLButtonElement | null;
const thoughtDebugPanel = document.getElementById("thought-debug-panel") as HTMLElement | null;
const thoughtDebugEnabled = document.getElementById("thought-debug-enabled") as HTMLInputElement | null;
const thoughtDebugReset = document.getElementById("thought-debug-reset") as HTMLButtonElement | null;
const thoughtDebugCta = document.getElementById("thought-debug-cta") as HTMLSelectElement | null;
const thoughtDebugCtaStatus = document.getElementById("thought-debug-cta-status") as HTMLSelectElement | null;
const thoughtDebugWarning = document.getElementById("thought-debug-warning") as HTMLSelectElement | null;
const thoughtReportBugLink = document.getElementById("thought-report-bug-link") as HTMLAnchorElement | null;
const thoughtInstructionsLink = document.getElementById("thought-instructions-link") as HTMLAnchorElement | null;
const thoughtGalleryLink = document.getElementById("thought-gallery-link") as HTMLAnchorElement | null;
const galleryPage = document.getElementById("gallery-page") as HTMLElement | null;
const galleryStatus = document.getElementById("gallery-status") as HTMLElement | null;
const galleryCreateLink = document.getElementById("gallery-create-link") as HTMLAnchorElement | null;
const galleryHomeLink = document.getElementById("gallery-home-link") as HTMLAnchorElement | null;
const galleryGrid = document.getElementById("gallery-grid") as HTMLElement | null;
const pluginPage = document.getElementById("plugin-page") as HTMLElement | null;
const pluginTitle = document.getElementById("plugin-title") as HTMLElement | null;
const pluginSummary = document.getElementById("plugin-summary") as HTMLElement | null;
const pluginCodexCard = document.getElementById("plugin-codex-card") as HTMLElement | null;
const pluginClaudeCard = document.getElementById("plugin-claude-card") as HTMLElement | null;
const colorFontPage = document.getElementById("color-font-page") as HTMLElement | null;
const colorFontSource = document.getElementById("color-font-source") as HTMLElement | null;
const colorFontId = document.getElementById("color-font-id") as HTMLElement | null;
const colorFontVersion = document.getElementById("color-font-version") as HTMLElement | null;
const colorFontChain = document.getElementById("color-font-chain") as HTMLElement | null;
const colorFontContract = document.getElementById("color-font-contract") as HTMLElement | null;
const colorFontHash = document.getElementById("color-font-hash") as HTMLElement | null;
const colorFontRawBlock = document.getElementById("color-font-raw") as HTMLElement | null;
const colorFontOpenRaw = document.getElementById("color-font-open-raw") as HTMLAnchorElement | null;
const colorFontStatus = document.getElementById("color-font-status") as HTMLElement | null;
const verifyPage = document.getElementById("verify-page") as HTMLElement | null;
const verifyHomeDomain = document.getElementById("verify-home-domain") as HTMLAnchorElement | null;
const verifyThoughtDomain = document.getElementById("verify-thought-domain") as HTMLAnchorElement | null;
const verifyPathRole = document.getElementById("verify-path-role") as HTMLElement | null;
const verifyThoughtRole = document.getElementById("verify-thought-role") as HTMLElement | null;
const verifyNetwork = document.getElementById("verify-network") as HTMLElement | null;
const verifyChain = document.getElementById("verify-chain") as HTMLElement | null;
const verifyChainId = document.getElementById("verify-chain-id") as HTMLElement | null;
const verifyCurrency = document.getElementById("verify-currency") as HTMLElement | null;
const verifyPathNft = document.getElementById("verify-path-nft") as HTMLElement | null;
const verifyThoughtNft = document.getElementById("verify-thought-nft") as HTMLElement | null;
const verifyPulseAuction = document.getElementById("verify-pulse-auction") as HTMLElement | null;
const verifySpecName = document.getElementById("verify-spec-name") as HTMLElement | null;
const verifySpecId = document.getElementById("verify-spec-id") as HTMLElement | null;
const verifySpecHash = document.getElementById("verify-spec-hash") as HTMLElement | null;
const verifyColorFontAuthority = document.getElementById("verify-color-font-authority") as HTMLElement | null;
const verifyColorFontLoadedFrom = document.getElementById("verify-color-font-loaded-from") as HTMLElement | null;
const verifyColorFontHash = document.getElementById("verify-color-font-hash") as HTMLElement | null;
const agentDemoPage = document.getElementById("agent-demo-page") as HTMLElement | null;
const agentDemoPrompt = document.getElementById("agent-demo-prompt") as ThoughtTextAreaElement | null;
const agentDemoRunButton = document.getElementById("agent-demo-run") as HTMLButtonElement | null;
const agentDemoRunId = document.getElementById("agent-demo-run-id") as HTMLElement | null;
const agentDemoCallback = document.getElementById("agent-demo-callback") as HTMLElement | null;
const agentDemoPoll = document.getElementById("agent-demo-poll") as HTMLElement | null;
const agentDemoPromptHash = document.getElementById("agent-demo-prompt-hash") as HTMLElement | null;
const agentDemoSealedTask = document.getElementById("agent-demo-sealed-task") as HTMLElement | null;
const agentDemoPaste = document.getElementById("agent-demo-paste") as ThoughtTextAreaElement | null;
const agentDemoPasteSubmit = document.getElementById("agent-demo-paste-submit") as HTMLButtonElement | null;
const agentDemoDemoReturn = document.getElementById("agent-demo-demo-return") as HTMLButtonElement | null;
const agentDemoPreviewGrid = document.getElementById("agent-demo-preview-grid") as HTMLElement | null;
const agentDemoCandidate = document.getElementById("agent-demo-candidate") as HTMLElement | null;
const agentDemoContractStatus = document.getElementById("agent-demo-contract-status") as HTMLElement | null;
const agentDemoDockStatus = document.getElementById("agent-demo-dock-status") as HTMLElement | null;
const agentDemoAgentCodex = document.getElementById("agent-demo-agent-codex") as HTMLButtonElement | null;
const agentDemoOpenCodex = document.getElementById("agent-demo-open-codex") as HTMLAnchorElement | null;
const agentDemoCopyLink = document.getElementById("agent-demo-copy-link") as HTMLButtonElement | null;
const agentDemoMint = document.getElementById("agent-demo-mint") as HTMLButtonElement | null;
const agentDemoReset = document.getElementById("agent-demo-reset") as HTMLButtonElement | null;
const thoughtPage = document.getElementById("thought-page") as HTMLElement | null;
const thoughtDetailTitleToken = document.getElementById("thought-detail-token-id") as HTMLElement | null;
const thoughtDetailGalleryLink = document.getElementById("thought-detail-gallery-link") as HTMLAnchorElement | null;
const thoughtDetailCreateLink = document.getElementById("thought-detail-create-link") as HTMLAnchorElement | null;
const thoughtDetailStatus = document.getElementById("thought-detail-status") as HTMLElement | null;
const thoughtDetailBody = document.getElementById("thought-detail-body") as HTMLElement | null;
const thoughtDetailRail = document.querySelector(".thought-detail__rail") as HTMLElement | null;
const thoughtDetailImage = document.getElementById("thought-detail-image") as HTMLImageElement | null;
const thoughtDetailCanonicalTitle = document.getElementById("thought-detail-canonical-title") as HTMLElement | null;
const thoughtDetailPrompt = document.getElementById("thought-detail-prompt") as HTMLElement | null;
const thoughtDetailModel = document.getElementById("thought-detail-model") as HTMLElement | null;
const thoughtDetailModelReturn = document.getElementById("thought-detail-model-return") as HTMLElement | null;
const thoughtDetailPath = document.getElementById("thought-detail-path") as HTMLAnchorElement | null;
const thoughtDetailMinter = document.getElementById("thought-detail-minter") as HTMLElement | null;
const thoughtDetailNetwork = document.getElementById("thought-detail-network") as HTMLElement | null;
const thoughtDetailChain = document.getElementById("thought-detail-chain") as HTMLElement | null;
const thoughtDetailChainId = document.getElementById("thought-detail-chain-id") as HTMLElement | null;
const thoughtDetailCurrency = document.getElementById("thought-detail-currency") as HTMLElement | null;
const thoughtDetailMinted = document.getElementById("thought-detail-minted") as HTMLElement | null;
const thoughtDetailSpecRef = document.getElementById("thought-detail-spec-ref") as HTMLAnchorElement | null;
const thoughtDetailColorFont = document.getElementById("thought-detail-color-font") as HTMLAnchorElement | null;
const thoughtDetailColorFontStatus = document.getElementById("thought-detail-color-font-status") as HTMLElement | null;
const thoughtDetailViewTx = document.getElementById("thought-detail-view-tx") as HTMLAnchorElement | null;
const thoughtDetailProvenanceBytes = document.getElementById(
  "thought-detail-provenance-bytes",
) as HTMLAnchorElement | null;
const thoughtDetailJsonPanel = document.getElementById("thought-detail-json-panel") as HTMLElement | null;
const thoughtDetailProvenanceViewerTitle = document.getElementById(
  "thought-detail-provenance-viewer-title",
) as HTMLElement | null;
const thoughtDetailProvenanceJson = document.getElementById("thought-detail-provenance-json") as HTMLElement | null;
const thoughtDetailCopyStatus = document.getElementById("thought-detail-copy-status") as HTMLElement | null;
const canvas = document.getElementById("thought-grid") as HTMLCanvasElement | null;
const thoughtSvgPreview = document.getElementById("thought-svg-preview") as HTMLImageElement | null;
const mintSheetBackdrop = document.getElementById("mint-sheet-backdrop") as HTMLElement | null;
const mintSheet = document.getElementById("mint-sheet") as HTMLElement | null;
const mintSheetTitle = document.getElementById("mint-sheet-title") as HTMLElement | null;
const mintSheetClose = document.getElementById("mint-sheet-close") as HTMLButtonElement | null;
const mintSheetCopy = document.getElementById("mint-sheet-copy") as HTMLElement | null;
const mintSheetFlow = document.getElementById("mint-sheet-flow") as HTMLElement | null;
const mintSheetPathField = document.getElementById("mint-sheet-path-field") as HTMLElement | null;
const mintSheetPathBox = document.getElementById("mint-sheet-path-box") as HTMLInputElement | null;
const mintSheetPathOptions = document.getElementById("mint-sheet-path-options") as HTMLDataListElement | null;
const mintSheetPathSelect = document.getElementById("mint-sheet-path-select") as HTMLSelectElement | null;
const mintSheetProvenance = document.getElementById("mint-sheet-provenance") as HTMLElement | null;
const mintSheetStatus = document.getElementById("mint-sheet-status") as HTMLElement | null;
const mintSheetContext = document.getElementById("mint-sheet-context") as HTMLElement | null;
const mintSheetPrimary = document.getElementById("mint-sheet-primary") as HTMLButtonElement | null;
const mintSheetSecondary = document.getElementById("mint-sheet-secondary") as HTMLButtonElement | null;
const mintSheetTertiary = document.getElementById("mint-sheet-tertiary") as HTMLButtonElement | null;

if (
  !frontpageShell ||
  !thoughtShellRoot ||
  !frontpageStage ||
  !frontpageMain ||
  !modeConnectButton ||
  !modeDirectButton ||
  !modeLocalButton ||
  !modeCodexButton ||
  !thoughtCliTranscript ||
  !thoughtCliSuggestions ||
  !thoughtCliForm ||
  !thoughtCliPrompt ||
  !thoughtCliInput ||
  !connectPanel ||
  !connectOpenRouterButton ||
  !connectStatusRow ||
  !connectStatusCopy ||
  !disconnectOpenRouterButton ||
  !providerField ||
  !providerBox ||
  !apiKeyField ||
  !apiKeyLabel ||
  !apiKeyBox ||
  !localModelField ||
  !localModelValue ||
  !localStatus ||
  !localHelper ||
  !thoughtCanvasPanel ||
  !thoughtCanvasFrame ||
  !thoughtPanel ||
  !thoughtDock ||
  !thoughtDockPrompt ||
  !thoughtDockPath ||
  !thoughtDockPathInventory ||
  !thoughtDockPathInventoryLabel ||
  !thoughtDockPathInventorySelect ||
  !thoughtDockPathFlow ||
  !thoughtDockMintStep ||
  !thoughtDockPathTitle ||
  !thoughtDockPathPrimary ||
  !thoughtDockPathSecondary ||
  !thoughtDockPathTertiary ||
  !thoughtDockWorks ||
  !thoughtDockWorksLabel ||
  !thoughtDockWorksSelect ||
  !thoughtDockActionArea ||
  !thoughtDockDetails ||
  !thoughtDockDetailsBody ||
  !modelBox ||
  !modelManualBox ||
  !promptBox ||
  !thoughtFileField ||
  !uploadThoughtFileButton ||
  !clearThoughtFileButton ||
  !thoughtFileInput ||
  !thoughtFileStatus ||
  !runAgentButton ||
  !actionStatusCopy ||
  !resetThoughtButton ||
  !runStatus ||
  !warningBox ||
  !thoughtDebug ||
  !thoughtDebugToggle ||
  !thoughtDebugPanel ||
  !thoughtDebugEnabled ||
  !thoughtDebugReset ||
  !thoughtDebugCta ||
  !thoughtDebugCtaStatus ||
  !thoughtDebugWarning ||
  !thoughtReportBugLink ||
  !thoughtInstructionsLink ||
  !thoughtGalleryLink ||
  !galleryPage ||
  !galleryStatus ||
  !galleryCreateLink ||
  !galleryHomeLink ||
  !galleryGrid ||
  !pluginPage ||
  !pluginTitle ||
  !pluginSummary ||
  !pluginCodexCard ||
  !pluginClaudeCard ||
  !colorFontPage ||
  !colorFontSource ||
  !colorFontId ||
  !colorFontVersion ||
  !colorFontChain ||
  !colorFontContract ||
  !colorFontHash ||
  !colorFontRawBlock ||
  !colorFontOpenRaw ||
  !colorFontStatus ||
  !verifyPage ||
  !verifyHomeDomain ||
  !verifyThoughtDomain ||
  !verifyPathRole ||
  !verifyThoughtRole ||
  !verifyNetwork ||
  !verifyChain ||
  !verifyChainId ||
  !verifyCurrency ||
  !verifyPathNft ||
  !verifyThoughtNft ||
  !verifyPulseAuction ||
  !verifySpecName ||
  !verifySpecId ||
  !verifySpecHash ||
  !verifyColorFontAuthority ||
  !verifyColorFontLoadedFrom ||
  !verifyColorFontHash ||
  !agentDemoPage ||
  !agentDemoPrompt ||
  !agentDemoRunButton ||
  !agentDemoRunId ||
  !agentDemoCallback ||
  !agentDemoPoll ||
  !agentDemoPromptHash ||
  !agentDemoSealedTask ||
  !agentDemoPaste ||
  !agentDemoPasteSubmit ||
  !agentDemoDemoReturn ||
  !agentDemoPreviewGrid ||
  !agentDemoCandidate ||
  !agentDemoContractStatus ||
  !agentDemoDockStatus ||
  !agentDemoAgentCodex ||
  !agentDemoOpenCodex ||
  !agentDemoCopyLink ||
  !agentDemoMint ||
  !agentDemoReset ||
  !thoughtPage ||
  !thoughtDetailTitleToken ||
  !thoughtDetailGalleryLink ||
  !thoughtDetailCreateLink ||
  !thoughtDetailStatus ||
  !thoughtDetailBody ||
  !thoughtDetailRail ||
  !thoughtDetailImage ||
  !thoughtDetailCanonicalTitle ||
  !thoughtDetailPrompt ||
  !thoughtDetailModel ||
  !thoughtDetailModelReturn ||
  !thoughtDetailPath ||
  !thoughtDetailMinter ||
  !thoughtDetailNetwork ||
  !thoughtDetailChain ||
  !thoughtDetailChainId ||
  !thoughtDetailCurrency ||
  !thoughtDetailMinted ||
  !thoughtDetailSpecRef ||
  !thoughtDetailColorFont ||
  !thoughtDetailColorFontStatus ||
  !thoughtDetailViewTx ||
  !thoughtDetailProvenanceBytes ||
  !thoughtDetailJsonPanel ||
  !thoughtDetailProvenanceViewerTitle ||
  !thoughtDetailProvenanceJson ||
  !thoughtDetailCopyStatus ||
  !canvas ||
  !thoughtSvgPreview ||
  !mintSheetBackdrop ||
  !mintSheet ||
  !mintSheetTitle ||
  !mintSheetClose ||
  !mintSheetCopy ||
  !mintSheetFlow ||
  !mintSheetPathField ||
  !mintSheetPathBox ||
  !mintSheetPathOptions ||
  !mintSheetPathSelect ||
  !mintSheetProvenance ||
  !mintSheetStatus ||
  !mintSheetContext ||
  !mintSheetPrimary ||
  !mintSheetSecondary ||
  !mintSheetTertiary
) {
  throw new Error("Front page elements are missing.");
}

mountThoughtShell(thoughtShellRoot, THOUGHT_CHAIN_ID, () => refreshThoughtWalletFromShell());

localModelValue.textContent = LOCAL_MODEL_LABEL;

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D context is unavailable.");
}

let statusTimer: number | null = null;
let warningTimer: number | null = null;
let panelWarningMessage = "";
let panelWarningLevel: PanelWarningLevel = "error";
let lastRunErrorCliLines: string[] = [];
let currentOutputText = "";
let currentWorkSvg = "";
let runInFlight = false;
let runState: ThoughtRunState = "idle";

type AgentDemoPhase = "draft" | "choose-agent" | "creating" | "sealed" | "waiting" | "returned" | "mint-ready";

type AgentDemoRun = {
  runId: string;
  prompt: string;
  promptHash: string;
  launchUri: string;
  launchToken: string;
  browserToken: string;
  statusUrl: string;
  claimUrl: string;
  startUrl: string;
  resultUrl: string;
  codexUrl: string;
  claudeUrl: string;
  sealedTask: string;
  candidate: string | null;
  remoteState: string;
  expiresAt?: string;
  agentEvidence?: ThoughtV2LocalAgentEvidence;
};

type ThoughtDockAgentAdapterId = "codex" | "claude";

type ThoughtDockAgentAdapter = {
  id: ThoughtDockAgentAdapterId;
  label: string;
  canDeepLink: boolean;
};

const CODEX_AGENT_ROUTE = "codex://new";
const CLAUDE_CODE_AGENT_ROUTE = "claude://code/new";

type ThoughtDockWorkView = {
  text: string;
  workId: number | null;
};

type ThoughtMintWorkSnapshot = Readonly<{
  text: string;
  svg: string;
  workId: number | null;
  runContext: ThoughtRunContext;
}>;

type ThoughtDockState =
  | { kind: "empty" }
  | { kind: "ready"; prompt: string }
  | { kind: "agent_select"; prompt: string }
  | { kind: "creating_run"; prompt: string; adapterId: ThoughtDockAgentAdapterId }
  | { kind: "agent_task_ready"; run: AgentDemoRun; adapterId: ThoughtDockAgentAdapterId; message?: string }
  | { kind: "opening_agent"; run: AgentDemoRun; adapterId: ThoughtDockAgentAdapterId }
  | { kind: "claim_authorization"; run: AgentDemoRun; adapterId: ThoughtDockAgentAdapterId; authorization: ThoughtClaimAuthorization; approving?: boolean }
  | { kind: "waiting_for_agent"; run: AgentDemoRun; adapterId: ThoughtDockAgentAdapterId; message?: string }
  | { kind: "agent_returned"; run: AgentDemoRun; rawCandidate: string }
  | { kind: "previewing"; rawCandidate: string }
  | { kind: "preview_unavailable"; rawCandidate: string; reason: string }
  | {
      kind: "preview_rejected";
      rawCandidate: string;
      reason: string;
      reasonCode?: number;
      issue?: ThoughtTextPolicyIssue;
    }
  | { kind: "work_ready"; work: ThoughtDockWorkView }
  | { kind: "minted"; tokenId?: string; txHash?: string; existing?: boolean }
  | { kind: "run_access_needed"; details: string }
  | { kind: "expired"; run?: AgentDemoRun }
  | { kind: "failed"; message: string; details?: string };

type DockRailTone =
  | "idle"
  | "running"
  | "success"
  | "warning"
  | "error";

type DockRailAction = {
  id: string;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
};

type DockRailView = {
  status: string;
  tone: DockRailTone;
  actions: DockRailAction[];
  maxActions?: number;
};

type StoredThoughtDockRun = {
  runId: string;
  adapterId: ThoughtDockAgentAdapterId;
  browserToken: string;
  statusUrl: string;
  prompt: string;
  promptHash: string;
  createdAt: string;
  expiresAt?: string;
  remoteState?: string;
};

const THOUGHT_DOCK_PENDING_RUN_KEY = "thought:dock:pending-agent-run:v1";
const THOUGHT_DOCK_AGENT_ADAPTERS: ThoughtDockAgentAdapter[] = [
  {
    id: "codex",
    label: "Codex",
    canDeepLink: true,
  },
  {
    id: "claude",
    label: "Claude",
    canDeepLink: false,
  },
];

let agentDemoInitialized = false;
let agentDemoPhase: AgentDemoPhase = "draft";
let agentDemoRun: AgentDemoRun | null = null;
let agentDemoStatusDetail = "";
let agentDemoPollGeneration = 0;
let thoughtDockState: ThoughtDockState = { kind: "empty" };
let thoughtDockRun: AgentDemoRun | null = null;
let thoughtDockAdapterId: ThoughtDockAgentAdapterId = "codex";
let thoughtDockPollGeneration = 0;
let workLibraryRevealed = false;
const thoughtDockPollWakeScheduler = createThoughtPollWakeScheduler();
const refreshThoughtDockPolling = () => {
  thoughtDockPollWakeScheduler.pollNow();
};
let thoughtDockRailSignature = "";
let thoughtConsoleHistory = parseThoughtConsoleHistory(
  getSessionStorage()?.getItem(THOUGHT_CONSOLE_HISTORY_STORAGE_KEY) ?? "",
);
const nextMintAttemptId = (prefix = "mint") =>
  createMintAttemptId(prefix, window.crypto);
let mintAttemptId = nextMintAttemptId("idle");
let mintErrorSequence = 0;
let mintTransactionRequestId = 0;
let thoughtDockRailInsetFrame = 0;

const AGENT_DEMO_GLYPH_COLORS = [
  "#006100",
  "#007c6f",
  "#2f6f9f",
  "#7a5fb2",
  "#a95f6f",
  "#9a7622",
  "#4f7d2d",
  "#2f7f54",
  "#5d717f",
  "#8a6d3b",
] as const;

const agentDemoRandom = (bytes = 18) => {
  const values = new Uint8Array(bytes);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
};

const agentDemoSetHidden = (element: HTMLElement, hidden: boolean) => {
  element.classList.toggle("is-hidden", hidden);
};

const agentDemoSha256 = sha256Hex;

const agentDemoBridgeInfo = () => ({
  bridgeId: "inshell-thought-agent-demo",
  bridgeVersion: `${APP_VERSION}+${APP_BUILD}`,
  platform: "browser-demo",
});

const agentDemoAdapterInfo = () => ({
  adapterId: CODEX_PROVIDER,
  adapterVersion: "demo-callback",
});

const agentDemoAgentInfo = () => ({
  product: "Codex",
  productVersion: "demo",
  provider: CODEX_PROVIDER,
  model: CODEX_MODEL,
  metadataSource: "configured",
});

const agentDemoExecutionInfo = () => ({
  visibleTurns: 1,
  agentInvocations: 1,
  workspacePolicy: "external-agent-app",
  sandboxPolicy: "agent-owned",
  approvalPolicy: "agent-owned",
  userConfigPolicy: "agent-owned",
});

const agentDemoRunActionUrl = (statusUrl: string, action: string) =>
  `${resolveThoughtAgentStatusUrl(statusUrl).replace(/\/+$/g, "")}/${action}`;

const agentDemoLaunchToken = (launchUri: string) => {
  try {
    return new URL(launchUri).searchParams.get("token") || "";
  } catch {
    return "";
  }
};

const agentDemoResultJson = (
  _run: AgentDemoRun,
  candidate: string,
  adapterId: ThoughtDockAgentAdapterId = "codex",
) => IS_LOCAL_THOUGHT_V2
  ? buildThoughtV2LocalAgentResult(candidate, thoughtAgentProductLabel(adapterId))
  : {
      schema: THOUGHT_AGENT_RESULT_VERSION,
      agentLine: candidate,
    };

const thoughtAgentProductLabel = (adapterId: ThoughtDockAgentAdapterId) =>
  THOUGHT_DOCK_AGENT_ADAPTERS.find((adapter) => adapter.id === adapterId)?.label ?? "Agent";

const normalizeThoughtAgentProtocolError = (message: string, adapterId: ThoughtDockAgentAdapterId = "codex") => {
  const trimmed = message.trim();
  if (/failed to fetch|network|connection refused|could not connect|econnrefused/i.test(trimmed)) {
    return `${thoughtAgentProductLabel(adapterId)} could not reach the THOUGHT Agent API. Retry the protocol calls with curl against the local URL.`;
  }
  return trimmed;
};

const thoughtDockAgentLifecycleStatus = (adapterId: ThoughtDockAgentAdapterId, remoteState?: string | null) => {
  const product = thoughtAgentProductLabel(adapterId);
  switch (remoteState) {
    case "claimed":
      return `${product} accepted task...`;
    case "running":
      return `${product} running...`;
    case "returned":
      return "Return received...";
    default:
      return `Waiting for ${product}...`;
  }
};

const thoughtDockAgentLifecycleTitle = (adapterId: ThoughtDockAgentAdapterId, remoteState?: string | null) =>
  thoughtDockAgentLifecycleStatus(adapterId, remoteState).replace(/\.\.\.$/, "");

const buildAgentDemoSealedTask = (
  run: Omit<AgentDemoRun, "codexUrl" | "claudeUrl" | "sealedTask" | "candidate">,
  adapterId: ThoughtDockAgentAdapterId = "codex",
) => {
  const product = thoughtAgentProductLabel(adapterId);
  const launchApiOrigin = (() => {
    try {
      return new URL(run.launchUri).searchParams.get("api_origin") || "";
    } catch {
      return "";
    }
  })();
  const derivedStatusUrl = launchApiOrigin
    ? `${launchApiOrigin.replace(/\/+$/g, "")}/api/thought-agent/v2/runs/${encodeURIComponent(run.runId)}`
    : "";
  const statusUrl = run.statusUrl || derivedStatusUrl;
  const absoluteStatusUrl = new URL(statusUrl, window.location.href).toString().replace(/\/+$/g, "");
  const clientUrl = `${new URL(absoluteStatusUrl).origin}${THOUGHT_CODEX_CLIENT_ROUTE}`;
  return buildThoughtCodexTask({
    product,
    runId: run.runId,
    promptLine: run.prompt,
    runUrl: absoluteStatusUrl,
    clientUrl,
    launchToken: run.launchToken,
    ...(IS_LOCAL_THOUGHT_V2
      ? {
          release: {
            protocolReleaseId: THOUGHT_V2_LOCAL_RELEASE.protocol.protocolReleaseId,
            manifestKeccak256: THOUGHT_V2_LOCAL_RELEASE.protocol.manifestKeccak256,
          },
        }
      : {}),
  });
};

const buildCodexAgentUrl = (sealedTask: string) => {
  const params = new URLSearchParams({
    prompt: sealedTask,
    originUrl: window.location.href,
  });
  return `${CODEX_AGENT_ROUTE}?${params.toString()}`;
};

const buildClaudeCodeAgentUrl = (sealedTask: string) => {
  const params = new URLSearchParams({
    q: sealedTask,
  });
  return `${CLAUDE_CODE_AGENT_ROUTE}?${params.toString()}`;
};

const buildAgentDemoRun = async (): Promise<AgentDemoRun> => {
  const prompt = agentDemoPrompt.value;
  assertThoughtLine(prompt, "prompt");
  const createPayload = await fetchThoughtAgentJson<ThoughtAgentRunCreateResponse>(
    thoughtAgentApiUrl("runs"),
    {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        promptLine: prompt,
        specId: THOUGHT_AGENT_REGISTERED_SPEC_ID,
        requestedAgent: {
          adapterId: CODEX_PROVIDER,
          model: null,
        },
        client: {
          surface: "thought-agent-demo",
          appVersion: `${APP_VERSION}+${APP_BUILD}`,
        },
        devAutoRun: false,
      }),
    },
  );
  if (
    !createPayload.runId ||
    !createPayload.browserToken ||
    !createPayload.statusUrl ||
    !createPayload.launchUri
  ) {
    throw new Error("THOUGHT Agent API returned an incomplete demo run.");
  }
  const statusUrl = resolveThoughtAgentStatusUrl(createPayload.statusUrl);
  const launchUri = resolveThoughtAgentLaunchUri(createPayload.launchUri);
  const launchToken = agentDemoLaunchToken(launchUri);
  if (!launchToken) {
    throw new Error("THOUGHT Agent API returned a launch URI without a token.");
  }
  const promptHash = await agentDemoSha256(prompt);
  const baseRun = {
    runId: createPayload.runId,
    prompt,
    promptHash,
    launchUri,
    launchToken,
    browserToken: createPayload.browserToken,
    statusUrl,
    claimUrl: agentDemoRunActionUrl(statusUrl, "claim"),
    startUrl: agentDemoRunActionUrl(statusUrl, "start"),
    resultUrl: agentDemoRunActionUrl(statusUrl, "result"),
    remoteState: createPayload.state ?? "created",
    expiresAt: createPayload.claimExpiresAt,
  };
  const sealedTask = buildAgentDemoSealedTask(baseRun);
  return {
    ...baseRun,
    sealedTask,
    codexUrl: buildCodexAgentUrl(sealedTask),
    claudeUrl: buildClaudeCodeAgentUrl(sealedTask),
    candidate: null,
  };
};

const agentDemoDockStatusForPhase = () => {
  if (agentDemoStatusDetail) {
    return agentDemoStatusDetail;
  }
  switch (agentDemoPhase) {
    case "draft":
      return "enter prompt.";
    case "choose-agent":
      return "choose an Agent.";
    case "creating":
      return "creating sealed run.";
    case "sealed":
      return `sealed run ready. state: ${agentDemoRun?.remoteState ?? "created"}.`;
    case "waiting":
      return `polling run. state: ${agentDemoRun?.remoteState ?? "created"}.`;
    case "returned":
      return "candidate returned. preview ready.";
    case "mint-ready":
      return "Mint / Reset.";
  }
};

const renderAgentDemoGlyphs = (candidate: string) => {
  const chars = Array.from(candidate.replace(/\s+/g, ""));
  const glyphs = chars.slice(0, 100).map((char, index) => {
    const glyph = document.createElement("span");
    glyph.className = "thought-agent-demo__glyph";
    glyph.title = char;
    glyph.style.backgroundColor = AGENT_DEMO_GLYPH_COLORS[(char.charCodeAt(0) + index) % AGENT_DEMO_GLYPH_COLORS.length];
    return glyph;
  });
  agentDemoPreviewGrid.replaceChildren(...glyphs);
};

const renderAgentDemo = () => {
  agentDemoDockStatus.textContent = agentDemoDockStatusForPhase();
  agentDemoRunId.textContent = agentDemoRun?.runId ?? "-";
  agentDemoCallback.textContent = agentDemoRun?.resultUrl ?? "-";
  agentDemoPoll.textContent = agentDemoRun?.statusUrl ?? "-";
  agentDemoPromptHash.textContent = agentDemoRun?.promptHash ?? "-";
  agentDemoSealedTask.textContent = agentDemoRun?.sealedTask ?? "no sealed run.";
  agentDemoOpenCodex.href = agentDemoRun?.codexUrl ?? "#";
  agentDemoCandidate.textContent = agentDemoRun?.candidate ?? "-";
  agentDemoContractStatus.textContent = agentDemoRun?.candidate
    ? `ok. text hash ${hashText(agentDemoRun.candidate)}`
    : "waiting.";
  renderAgentDemoGlyphs(agentDemoRun?.candidate ?? "");

  agentDemoSetHidden(agentDemoAgentCodex, agentDemoPhase !== "choose-agent");
  agentDemoSetHidden(agentDemoOpenCodex, agentDemoPhase !== "sealed" && agentDemoPhase !== "waiting");
  agentDemoSetHidden(agentDemoCopyLink, agentDemoPhase !== "sealed" && agentDemoPhase !== "waiting");
  agentDemoSetHidden(agentDemoMint, agentDemoPhase !== "returned" && agentDemoPhase !== "mint-ready");
};

const parseAgentDemoReturn = (rawValue: string) => {
  if (!rawValue) {
    throw new Error("return empty.");
  }
  if (IS_LOCAL_THOUGHT_V2) {
    return parseThoughtV2LocalAgentResult(rawValue).agentLine;
  }
  const parsed = JSON.parse(rawValue) as Record<string, unknown>;
  if (parsed.schema !== THOUGHT_AGENT_RESULT_VERSION || typeof parsed.agentLine !== "string") {
    throw new Error("Agent result schema invalid.");
  }
  const candidate = parsed.agentLine;
  assertThoughtLine(candidate, "agent");
  const returnedRunId = typeof parsed.runId === "string" ? parsed.runId : null;
  if (agentDemoRun && returnedRunId && returnedRunId !== agentDemoRun.runId) {
    throw new Error("run id mismatch.");
  }
  return candidate;
};

const acceptAgentDemoCandidate = (candidate: string, remoteState = "returned") => {
  if (!agentDemoRun) return;
  agentDemoRun = {
    ...agentDemoRun,
    candidate,
    remoteState,
  };
  agentDemoPhase = "returned";
  agentDemoStatusDetail = "";
  renderAgentDemo();
};

const pollAgentDemoRun = (run: AgentDemoRun) => {
  const generation = ++agentDemoPollGeneration;
  void (async () => {
    while (generation === agentDemoPollGeneration && agentDemoRun?.runId === run.runId) {
      try {
        const payload = await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(run.statusUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${run.browserToken}`,
          },
        });
        if (agentDemoRun?.runId !== run.runId) return;
        agentDemoRun = {
          ...agentDemoRun,
          remoteState: payload.state ?? agentDemoRun.remoteState,
        };
        if (payload.state === "returned") {
          const candidate = await readThoughtAgentModelReturn(payload);
          if (!candidate) {
            throw new Error("returned run had no candidate.");
          }
          acceptAgentDemoCandidate(candidate, "returned");
          return;
        }
        if (payload.state === "failed" || payload.state === "cancelled" || payload.state === "expired") {
          agentDemoStatusDetail = normalizeThoughtAgentProtocolError(
            payload.error?.message || `run ${payload.state}.`,
            normalizeThoughtDockAdapterId(payload.request?.requestedAgent?.adapterId),
          );
          renderAgentDemo();
          return;
        }
        if (agentDemoPhase !== "returned" && agentDemoPhase !== "mint-ready") {
          renderAgentDemo();
        }
        await new Promise((resolve) => window.setTimeout(resolve, THOUGHT_AGENT_STATUS_POLL_MS));
      } catch (error) {
        if (generation !== agentDemoPollGeneration) return;
        agentDemoStatusDetail = error instanceof Error ? error.message : "poll failed.";
        renderAgentDemo();
        return;
      }
    }
  })();
};

const submitAgentDemoProtocolResult = async (candidate: string) => {
  if (!agentDemoRun) return;
  const run = agentDemoRun;
  agentDemoPhase = "waiting";
  agentDemoStatusDetail = "Agent posting result to protocol endpoint.";
  renderAgentDemo();

  const bridge = agentDemoBridgeInfo();
  const adapter = agentDemoAdapterInfo();
  const claimBody = JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    bridge,
    adapter,
  });
  const authorization = await fetchThoughtAgentJson<{
    claimRequestId?: string;
    claimRequestToken?: string;
  }>(run.claimUrl, {
    method: "POST",
    body: claimBody,
  });
  if (!authorization.claimRequestId || !authorization.claimRequestToken) {
    throw new Error("claim authorization response is incomplete.");
  }
  await fetchThoughtAgentJson<Record<string, unknown>>(
    agentDemoRunActionUrl(run.statusUrl, "claim-authorization"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${run.browserToken}`,
      },
      body: JSON.stringify({
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        claimRequestId: authorization.claimRequestId,
      }),
    },
  );
  const claimPayload = await fetchThoughtAgentJson<{ bridgeToken?: string }>(run.claimUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authorization.claimRequestToken}`,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      bridge,
      adapter,
    }),
  });
  if (!claimPayload.bridgeToken) {
    throw new Error("claim response missing bridge token.");
  }

  const invocationId = `tai_${agentDemoRandom(12)}`;
  const startedAt = new Date().toISOString();
  await fetchThoughtAgentJson<Record<string, unknown>>(run.startUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${claimPayload.bridgeToken}`,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      invocationId,
      startedAt,
    }),
  });

  assertThoughtLine(candidate, "agent");
  const raw = JSON.stringify(agentDemoResultJson(run, candidate));
  const completedAt = new Date().toISOString();
  await fetchThoughtAgentJson<Record<string, unknown>>(run.resultUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${claimPayload.bridgeToken}`,
      "Idempotency-Key": invocationId,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      invocationId,
      bridge,
      adapter,
      agent: agentDemoAgentInfo(),
      execution: agentDemoExecutionInfo(),
      startedAt,
      completedAt,
      output: {
        mediaType: "application/json",
        raw,
        rawSha256: await agentDemoSha256(raw),
        agentLine: candidate,
        agentLineSha256: await agentDemoSha256(candidate),
      },
    }),
  });
  agentDemoStatusDetail = "result stored. FE polling status.";
  renderAgentDemo();
};

const submitPastedAgentDemoReturn = async (rawValue: string) => {
  const candidate = parseAgentDemoReturn(rawValue);
  await submitAgentDemoProtocolResult(candidate);
};

const initAgentDemoPage = () => {
  renderAgentDemo();
  if (agentDemoInitialized) return;
  agentDemoInitialized = true;

  agentDemoRunButton.addEventListener("click", () => {
    if (!agentDemoPrompt.value.trim()) {
      agentDemoDockStatus.textContent = "prompt required.";
      agentDemoPrompt.focus();
      return;
    }
    agentDemoStatusDetail = "";
    agentDemoPhase = "choose-agent";
    renderAgentDemo();
  });

  agentDemoAgentCodex.addEventListener("click", () => {
    void (async () => {
      try {
        agentDemoStatusDetail = "";
        agentDemoPhase = "creating";
        renderAgentDemo();
        agentDemoRun = await buildAgentDemoRun();
        agentDemoPhase = "sealed";
        renderAgentDemo();
        pollAgentDemoRun(agentDemoRun);
      } catch (error) {
        agentDemoStatusDetail = error instanceof Error ? error.message : "could not create run.";
        agentDemoPhase = "choose-agent";
        renderAgentDemo();
      }
    })();
  });

  agentDemoOpenCodex.addEventListener("click", () => {
    if (!agentDemoRun) return;
    agentDemoStatusDetail = "";
    agentDemoPhase = "waiting";
    renderAgentDemo();
  });

  agentDemoCopyLink.addEventListener("click", async () => {
    if (!agentDemoRun) return;
    try {
      await navigator.clipboard.writeText(agentDemoRun.codexUrl);
      agentDemoStatusDetail = "Codex link copied.";
    } catch {
      agentDemoStatusDetail = "clipboard blocked. use Open Codex.";
    }
    renderAgentDemo();
  });

  agentDemoPasteSubmit.addEventListener("click", () => {
    void (async () => {
      try {
        await submitPastedAgentDemoReturn(agentDemoPaste.value);
      } catch (error) {
        agentDemoStatusDetail = error instanceof Error ? error.message : "return invalid.";
        renderAgentDemo();
      }
    })();
  });

  agentDemoDemoReturn.addEventListener("click", () => {
    void (async () => {
      if (!agentDemoRun) {
        agentDemoStatusDetail = "sealed run required.";
        renderAgentDemo();
        return;
      }
      try {
        const candidate = canonicalThoughtTitle(agentDemoRun.prompt).slice(0, 72) || "HELLO THOUGHT";
        agentDemoPaste.value = [
          "THOUGHT_RESULT_BEGIN",
          JSON.stringify(agentDemoResultJson(agentDemoRun, candidate), null, 2),
          "THOUGHT_RESULT_END",
        ].join("\n");
        await submitAgentDemoProtocolResult(candidate);
      } catch (error) {
        agentDemoStatusDetail = error instanceof Error ? error.message : "demo callback failed.";
        renderAgentDemo();
      }
    })();
  });

  agentDemoMint.addEventListener("click", () => {
    if (!agentDemoRun?.candidate) return;
    agentDemoPhase = "mint-ready";
    agentDemoStatusDetail = "";
    renderAgentDemo();
  });

  agentDemoReset.addEventListener("click", () => {
    agentDemoPollGeneration += 1;
    agentDemoRun = null;
    agentDemoStatusDetail = "";
    agentDemoPhase = "draft";
    agentDemoPaste.value = "";
    renderAgentDemo();
  });
};

const isThoughtDockActiveState = (state: ThoughtDockState) =>
  isThoughtDockRunningState(state) ||
  state.kind === "preview_unavailable" ||
  state.kind === "preview_rejected" ||
  state.kind === "run_access_needed" ||
  state.kind === "failed" ||
  state.kind === "expired";

const isThoughtDockRunningState = (state: ThoughtDockState) =>
  state.kind === "agent_select" ||
  state.kind === "creating_run" ||
  state.kind === "agent_task_ready" ||
  state.kind === "opening_agent" ||
  state.kind === "claim_authorization" ||
  state.kind === "waiting_for_agent" ||
  state.kind === "agent_returned" ||
  state.kind === "previewing";

const isThoughtDockInputLockedState = (state: ThoughtDockState) =>
  state.kind !== "empty" && state.kind !== "ready";

const getThoughtDockWorkView = (): ThoughtDockWorkView | null =>
  currentOutputText ? { text: currentOutputText, workId: currentWorkId } : null;

const readStoredThoughtDockRun = (): StoredThoughtDockRun | null => {
  const raw = readSharedBrowserItem(THOUGHT_DOCK_PENDING_RUN_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("stored Dock run is invalid.");
    }
    const runId = stringOrNull(parsed.runId);
    const adapterId = stringOrNull(parsed.adapterId) as ThoughtDockAgentAdapterId | null;
    const browserToken = stringOrNull(parsed.browserToken);
    const statusUrl = stringOrNull(parsed.statusUrl);
    const prompt = stringOrNull(parsed.prompt);
    const promptHash = stringOrNull(parsed.promptHash);
    const createdAt = stringOrNull(parsed.createdAt);
    if (
      !runId ||
      (adapterId !== "codex" && adapterId !== "claude") ||
      !browserToken ||
      !statusUrl ||
      !prompt ||
      !promptHash ||
      !createdAt
    ) {
      throw new Error("stored Dock run is incomplete.");
    }
    const createdAtMs = Date.parse(createdAt);
    const expiresAt = stringOrNull(parsed.expiresAt);
    const storedDeadline = expiresAt ? Date.parse(expiresAt) : createdAtMs + THOUGHT_AGENT_POLL_TIMEOUT_MS + 60000;
    if (!Number.isFinite(createdAtMs) || !Number.isFinite(storedDeadline) || Date.now() >= storedDeadline) {
      throw new Error("stored Dock run expired.");
    }
    return {
      runId,
      adapterId,
      browserToken,
      statusUrl: resolveThoughtAgentStatusUrl(statusUrl),
      prompt,
      promptHash,
      createdAt,
      expiresAt: expiresAt ?? undefined,
      remoteState: stringOrNull(parsed.remoteState) ?? undefined,
    };
  } catch {
    removeSharedBrowserItem(THOUGHT_DOCK_PENDING_RUN_KEY);
    return null;
  }
};

const writeStoredThoughtDockRun = (run: StoredThoughtDockRun) => {
  try {
    writeSharedBrowserItem(THOUGHT_DOCK_PENDING_RUN_KEY, JSON.stringify(run));
  } catch {
    // A live in-memory run can still complete when browser storage is blocked.
  }
};

const clearStoredThoughtDockRun = (runId?: string) => {
  if (runId) {
    const current = readStoredThoughtDockRun();
    if (current && current.runId !== runId) {
      return;
    }
  }
  removeSharedBrowserItem(THOUGHT_DOCK_PENDING_RUN_KEY);
};

const recordThoughtDockConsoleTransition = (state: ThoughtDockState) => {
  if (
    state.kind === "agent_select" ||
    state.kind === "creating_run" ||
    state.kind === "agent_task_ready" ||
    state.kind === "opening_agent" ||
    state.kind === "claim_authorization" ||
    state.kind === "waiting_for_agent" ||
    state.kind === "agent_returned" ||
    state.kind === "previewing"
  ) {
    const rail = getThoughtDockRailView(state);
    emitThoughtConsoleEvent({
      kind: `work_${state.kind}`,
      title: rail.status.replace(/\.\.\.$/, ""),
      ...(state.kind === "waiting_for_agent" && state.message
        ? { detail: state.message }
        : {}),
      tone: rail.tone === "success" || rail.tone === "warning" || rail.tone === "error"
        ? rail.tone
        : "neutral",
    });
    return;
  }
  if (state.kind === "preview_unavailable") {
    emitThoughtConsoleEvent({
      kind: "work_preview_unavailable",
      title: "preview unavailable",
      detail: state.reason,
      tone: "warning",
      eventId: `work-preview-unavailable:${hashText(state.rawCandidate)}:${state.reason}`,
    });
    return;
  }
  if (state.kind === "preview_rejected") {
    const textTooLong = state.issue?.title === "text too long" || state.reasonCode === 3;
    emitThoughtConsoleEvent({
      kind: "work_preview_rejected",
      title: state.issue?.title ?? (textTooLong ? "text too long" : "work rejected"),
      detail: state.issue?.detail ?? state.reason,
      ...(state.issue?.nextStep ? { nextStep: state.issue.nextStep } : {}),
      tone: state.issue || textTooLong ? "warning" : "error",
      eventId: `work-preview-rejected:${hashText(state.rawCandidate)}:${state.reason}`,
    });
    return;
  }
  if (state.kind === "run_access_needed") {
    emitThoughtConsoleEvent({
      kind: "work_run_access_needed",
      title: "run access needed",
      detail: state.details,
      tone: "warning",
      eventId: `work-run-access:${state.details}`,
    });
    return;
  }
  if (state.kind === "expired") {
    emitThoughtConsoleEvent({
      kind: "work_run_expired",
      title: "Agent run expired",
      detail: "The saved Agent run can no longer be resumed.",
      tone: "error",
      eventId: `work-run-expired:${state.run?.runId ?? mintAttemptId}`,
    });
    return;
  }
  if (state.kind === "failed") {
    emitThoughtConsoleEvent({
      kind: "work_failed",
      title: "work error",
      detail: state.details || state.message,
      tone: "error",
      eventId: `work-error:${state.message}:${state.details ?? ""}`,
    });
  }
};

const thoughtDockRunFromStored = (stored: StoredThoughtDockRun): AgentDemoRun => ({
  runId: stored.runId,
  prompt: stored.prompt,
  promptHash: stored.promptHash,
  launchUri: "",
  launchToken: "",
  browserToken: stored.browserToken,
  statusUrl: stored.statusUrl,
  claimUrl: agentDemoRunActionUrl(stored.statusUrl, "claim"),
  startUrl: agentDemoRunActionUrl(stored.statusUrl, "start"),
  resultUrl: agentDemoRunActionUrl(stored.statusUrl, "result"),
  codexUrl: "#",
  claudeUrl: "#",
  sealedTask: "Agent Task is not available after refresh. Keep waiting or reset.",
  candidate: null,
  remoteState: stored.remoteState ?? "created",
  expiresAt: stored.expiresAt,
});

const storeThoughtDockRun = (run: AgentDemoRun, adapterId: ThoughtDockAgentAdapterId, createdAt?: string) => {
  thoughtDockAdapterId = adapterId;
  writeStoredThoughtDockRun({
    runId: run.runId,
    adapterId,
    browserToken: run.browserToken,
    statusUrl: run.statusUrl,
    prompt: run.prompt,
    promptHash: run.promptHash,
    createdAt: createdAt || new Date().toISOString(),
    expiresAt: run.expiresAt,
    remoteState: run.remoteState,
  });
};

const setThoughtDockState = (next: ThoughtDockState) => {
  thoughtDockState = next;
  recordThoughtDockConsoleTransition(next);
  renderThoughtDock();
};

const focusThoughtDockPrompt = (options?: { preventScroll?: boolean }) => {
  if (frontpageStage.classList.contains("is-hidden") || thoughtDockPrompt.disabled) {
    return;
  }

  requestAnimationFrame(() => {
    if (frontpageStage.classList.contains("is-hidden") || thoughtDockPrompt.disabled) {
      return;
    }

    thoughtDockPrompt.focus({ preventScroll: options?.preventScroll ?? true });

    if (document.activeElement === thoughtDockPrompt && !thoughtDockPrompt.readOnly) {
      try {
        const cursorPosition = thoughtDockPrompt.value.length;
        thoughtDockPrompt.setSelectionRange(cursorPosition, cursorPosition);
      } catch {
        // Some browser/IME states reject selection updates; focus is enough.
      }
    }
  });
};

const shouldRefocusThoughtDockFromClick = (target: EventTarget | null) => {
  if (
    IS_CLI_DEBUG ||
    frontpageStage.classList.contains("is-hidden") ||
    thoughtDockPrompt.disabled ||
    !(target instanceof HTMLElement) ||
    !document.body.contains(target)
  ) {
    return false;
  }

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }

  if (target.closest(".thought-dock-status-screen, .thought-dock-path, .thought-wallet-surface")) {
    return false;
  }

  const interactiveTarget = target.closest("a, button, input, textarea, select, [contenteditable='true']");
  return !interactiveTarget || interactiveTarget === thoughtDockPrompt;
};

const thoughtDockButton = (
  label: string,
  onClick: () => void,
  options?: {
    disabled?: boolean;
    ariaLabel?: string;
    expanded?: boolean;
  },
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "thought-dock-button thought-work-cta";
  button.textContent = label;
  if (options?.ariaLabel) {
    button.setAttribute("aria-label", options.ariaLabel);
  }
  if (options?.expanded !== undefined) {
    button.setAttribute("aria-expanded", String(options.expanded));
  }
  button.disabled = !!options?.disabled;
  button.addEventListener("click", onClick);
  return button;
};

const assertDockRailView = (view: DockRailView) => {
  const maxActions = view.maxActions ?? 2;
  if (view.actions.length > maxActions) {
    throw new Error(`Dock Action Rail supports max ${maxActions} visible actions`);
  }
  if (view.status.includes("\n")) {
    throw new Error("Dock Action Rail status must be single-line");
  }
};

const dockRailAction = (
  id: string,
  label: string,
  ariaLabel: string,
  onClick: () => void,
  options?: { disabled?: boolean; expanded?: boolean },
): DockRailAction => ({
  id,
  label,
  ariaLabel,
  onClick,
  disabled: options?.disabled,
  expanded: options?.expanded,
});

const renderDockRailAction = (action: DockRailAction) =>
  thoughtDockButton(action.label, action.onClick, {
    disabled: action.disabled,
    ariaLabel: action.ariaLabel,
    expanded: action.expanded,
  });

const thoughtDockActions = (...buttons: HTMLElement[]) => {
  const element = document.createElement("div");
  element.className = "thought-dock-actions";
  element.replaceChildren(...buttons);
  return element;
};

const thoughtDockRailRenderSignature = (rail: DockRailView) =>
  JSON.stringify({
    actions: rail.actions.map((action) => ({
      id: action.id,
      label: action.label,
      disabled: !!action.disabled,
      expanded: action.expanded,
    })),
  });

const syncThoughtDockRailInset = () => {
  if (thoughtDockRailInsetFrame) {
    window.cancelAnimationFrame(thoughtDockRailInsetFrame);
    thoughtDockRailInsetFrame = 0;
  }
  thoughtDock.style.setProperty("--thought-dock-rail-inset", "0px");
};

const statusScreenLine = (
  text: string,
  options: { heading?: boolean; tone?: DockRailTone } = {},
) => {
  const line = document.createElement("p");
  line.className = [
    "thought-dock-status-screen__line",
    options.heading ? "thought-dock-status-screen__line--heading" : "",
    options.tone === "error" ? "thought-dock-status-screen__line--error" : "",
    options.tone === "success" ? "thought-dock-status-screen__line--success" : "",
    options.tone === "warning" ? "thought-dock-status-screen__line--warning" : "",
  ].filter(Boolean).join(" ");
  line.textContent = text;
  return line;
};

const appendThoughtProgressEllipsis = (
  element: HTMLElement,
  text: string,
  active: boolean,
) => {
  element.textContent = text.replace(/\.{1,3}$/, "");
  const ellipsis = document.createElement("span");
  ellipsis.className = "thought-progress-ellipsis";
  ellipsis.classList.toggle("is-active", active);
  ellipsis.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    dot.className = "thought-progress-ellipsis__dot";
    dot.textContent = ".";
    ellipsis.append(dot);
  }
  element.append(ellipsis);
};

const statusScreenEntry = (lines: HTMLElement[]) => {
  const entry = document.createElement("article");
  entry.className = "thought-dock-status-screen__entry";
  entry.append(...lines);
  return entry;
};

const thoughtDockConsoleTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });

const currentThoughtConsoleWorkHash = () =>
  pendingMintTransaction?.workHash ||
  mintFlowData.textHash ||
  (currentOutputText ? keccak256(toUtf8Bytes(currentOutputText)) : "");

const currentThoughtConsoleContext = (): ThoughtConsoleContext => ({
  attemptId: mintAttemptId,
  ...(currentThoughtConsoleWorkHash()
    ? { workHash: currentThoughtConsoleWorkHash() }
    : {}),
  ...((pendingMintTransaction?.account || walletState.address)
    ? { account: pendingMintTransaction?.account || walletState.address }
    : {}),
  ...((pendingMintTransaction?.chainId ?? walletState.chainId) !== null
    ? { chainId: pendingMintTransaction?.chainId ?? walletState.chainId ?? undefined }
    : {}),
  deploymentFingerprint: [
    THOUGHT_CHAIN_ID,
    PATH_NFT_ADDRESS.toLowerCase(),
    THOUGHT_NFT_ADDRESS.toLowerCase(),
    EVM_ADDRESSES.protocolRelease?.id?.trim().toLowerCase() ?? "",
  ].join(":"),
});

const writeThoughtConsoleHistory = () => {
  try {
    getSessionStorage()?.setItem(
      THOUGHT_CONSOLE_HISTORY_STORAGE_KEY,
      serializeThoughtConsoleHistory(thoughtConsoleHistory),
    );
  } catch {
    // The console remains available in memory when browser storage is denied.
  }
};

type ThoughtConsoleEventDraft = {
  kind: string;
  title: string;
  detail?: string;
  nextStep?: string;
  eventId?: string;
  tone?: ThoughtConsoleTone;
  transient?: boolean;
};

const lowerInitial = (value: string) =>
  value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;

const suggestedThoughtConsoleNextStep = (
  input: Pick<ThoughtConsoleEventDraft, "kind" | "title" | "detail">,
) => {
  const title = input.title.toLowerCase();
  if (title === "text too long") {
    return input.detail?.startsWith("prompt:")
      ? `reduce prompt to ${THOUGHT_V2_PROTOCOL_RELEASE.limits.promptMaxBytes} UTF-8 bytes or less`
      : `rerun with Agent output at ${THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes} UTF-8 bytes or less`;
  }
  switch (input.kind) {
    case "work_preview_unavailable":
      return "retry preview";
    case "work_preview_rejected":
      return "reset and send the work again";
    case "work_run_access_needed":
    case "work_run_expired":
    case "work_failed":
      return "reset and send the work again";
    case "work_blocked":
      return "run the work again, then retry mint";
    case "wallet_connection_failed":
      return "retry wallet connection";
    case "conflicting_mint_reverted":
      return "keep tracking the original transaction";
    case "multiple_mint_hashes_returned":
      return "wait for a retained hash; do not submit again";
    case "pending_mint_deployment_mismatch":
      return "open the original deployment and track the retained hash";
    case "mint_submission_detached":
    case "mint_activity_checked":
      return "check wallet activity before retrying";
    case "work_save_failed":
      return "complete the work, then save again";
    default:
      break;
  }
  if (title.includes("wallet request already open")) {
    return "resolve the open wallet request";
  }
  if (title.includes("wallet unavailable")) {
    return "install or enable a wallet";
  }
  if (title.includes("switch wallet account")) {
    return "switch to the $PATH owner account, then refresh wallet from the shell bar";
  }
  if (title.includes("switch network")) {
    return "switch to the THOUGHT network, then refresh wallet from the shell bar";
  }
  if (title.includes("inventory unavailable")) {
    return "refresh wallet from the shell bar";
  }
  if (title.includes("need a path") || title.includes("no path can mint")) {
    return "mint a $PATH, then refresh wallet from the shell bar";
  }
  if (title.includes("path")) {
    return "pick another $PATH or refresh wallet from the shell bar";
  }
  return undefined;
};

const emitThoughtConsoleEvent = (input: ThoughtConsoleEventDraft) => {
  const actionNeeded = input.tone === "warning" || input.tone === "error";
  const nextStep = actionNeeded
    ? input.nextStep ?? suggestedThoughtConsoleNextStep(input)
    : input.nextStep;
  const next = appendThoughtConsoleEvent(thoughtConsoleHistory, {
    ...input,
    ...(nextStep ? { nextStep } : {}),
    time: thoughtDockConsoleTime(),
    context: currentThoughtConsoleContext(),
  });
  if (next === thoughtConsoleHistory) {
    return;
  }
  thoughtConsoleHistory = next;
  writeThoughtConsoleHistory();
};

const recordThoughtConsoleContextBoundary = (input?: {
  kind?: string;
  title?: string;
  detail?: string;
  nextStep?: string;
  tone?: ThoughtConsoleTone;
}) => {
  const actionNeeded = input?.tone === "warning" || input?.tone === "error";
  const nextStep = actionNeeded
    ? input?.nextStep ?? suggestedThoughtConsoleNextStep({
        kind: input.kind ?? "context_warning",
        title: input.title ?? "context warning",
        detail: input.detail,
      })
    : input?.nextStep;
  const next = appendThoughtConsoleContextBoundary(thoughtConsoleHistory, {
    ...input,
    ...(nextStep ? { nextStep } : {}),
    time: thoughtDockConsoleTime(),
    context: currentThoughtConsoleContext(),
  });
  if (next === thoughtConsoleHistory) return;
  thoughtConsoleHistory = next;
  writeThoughtConsoleHistory();
};

const thoughtConsoleToneForPresentation = (
  presentation: ThoughtMintPresentation,
): ThoughtConsoleTone => {
  if (presentation.tone === "error") return "error";
  if (presentation.tone === "warning") return "warning";
  if (presentation.tone === "success") return "success";
  return "neutral";
};

const thoughtConsoleNextStepForPresentation = (
  presentation: ThoughtMintPresentation,
) => {
  if (presentation.consoleNextStep) {
    return presentation.consoleNextStep;
  }
  const action = presentation.actions.find((item) => item.id !== "none" && !item.disabled);
  return action?.label ? lowerInitial(action.label) : undefined;
};

const recordMintConsoleState = (
  state: ThoughtDockState,
  presentation: ThoughtMintPresentation,
) => {
  if (state.kind === "work_ready" && mintFlowState === "closed") {
    const readiness = getCurrentWorkMintReadiness();
    emitThoughtConsoleEvent({
      kind: readiness.ready ? "work_ready" : "work_blocked",
      title: readiness.ready ? "work ready" : "work blocked",
      detail: readiness.ready ? "ready to mint" : readiness.reason,
      tone: readiness.ready ? "success" : "warning",
      eventId: `work:${readiness.ready ? "ready" : "blocked"}:${currentRunContext?.clientGeneratedAt ?? currentOutputText}`,
    });
    return;
  }

  if (mintFlowState === "closed") {
    return;
  }

  const presentationNextStep = presentation.consoleNextStep || presentation.tone === "warning"
    ? thoughtConsoleNextStepForPresentation(presentation)
    : undefined;
  const base = {
    title: presentation.title,
    detail: presentation.detail,
    tone: thoughtConsoleToneForPresentation(presentation),
    ...(presentationNextStep ? { nextStep: presentationNextStep } : {}),
  };

  if (mintFlowState === "thought_checking" || mintFlowState === "path_checking") {
    return;
  }
  if (mintFlowState === "wallet_required") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "wallet_needed",
      eventId: `wallet-needed:${mintAttemptId}`,
    });
    return;
  }
  if (mintFlowState === "path_required") {
    if (!pathInventoryMatchesCurrentWallet() || pathInventoryState.status === "idle" || pathInventoryState.status === "loading") {
      return;
    }
    emitThoughtConsoleEvent({
      ...base,
      kind: pathInventoryState.status === "loaded" ? "path_inventory_loaded" : "path_inventory_unavailable",
      eventId: `path-inventory:${pathInventoryState.status}:${pathInventoryState.items.map((item) => `${item.pathId.toString()}:${item.status}`).join(",")}:${pathInventoryState.error}`,
    });
    return;
  }
  if (mintFlowState === "path_ready") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "path_selected",
      detail: mintFlowData.pathId ? `$PATH #${mintFlowData.pathId.toString()} · 1 THOUGHT mint available` : base.detail,
    });
    return;
  }
  if (mintFlowState === "authorizing") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "authorization_requested",
      detail: "wallet request 1 of 2 · no transaction · no gas",
      eventId: `authorization-requested:${mintAuthorizationRequestId}`,
    });
    return;
  }
  if (mintFlowState === "authorized") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "authorization_signed",
      detail: mintFlowData.pathId
        ? `$PATH #${mintFlowData.pathId.toString()} · valid until ${new Date(Number(mintFlowData.deadline ?? 0n) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : base.detail,
      eventId: `authorization-signed:${mintAuthorizationRequestId}`,
    });
    return;
  }
  if (mintFlowState === "minting") {
    const txHash = walletState.txHash || mintFlowData.txHash;
    emitThoughtConsoleEvent({
      ...base,
      kind: txHash ? "transaction_submitted" : "transaction_requested",
      detail: txHash ? `${shortHex(txHash, 10, 8)} · waiting for confirmation` : "wallet request 2 of 2 · transaction · gas applies",
      eventId: txHash ? `transaction:${txHash.toLowerCase()}` : `transaction-requested:${mintTransactionRequestId}`,
    });
    return;
  }
  if (mintFlowState === "text_taken") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "thought_exists",
      eventId: `existing:${mintFlowData.existingTokenId ?? mintFlowData.textHash}`,
    });
    return;
  }
  if (mintFlowState === "minted" || state.kind === "minted") {
    emitThoughtConsoleEvent({
      ...base,
      kind: "transaction_confirmed",
      eventId: `minted:${walletState.mintedTokenId ?? mintFlowData.existingTokenId ?? walletState.txHash ?? mintFlowData.txHash}`,
    });
    return;
  }
  if (mintFlowState === "error") {
    emitThoughtConsoleEvent({
      ...base,
      kind: `${mintFlowData.errorKind || "mint"}_failed`,
      eventId: `mint-error:${mintErrorSequence}`,
    });
  }
};

const THOUGHT_CONSOLE_PROGRESS_KINDS = new Set([
  "work_creating_run",
  "work_opening_agent",
  "work_waiting_for_agent",
  "work_agent_returned",
  "work_previewing",
  "wallet_connection_requested",
  "authorization_requested",
  "transaction_requested",
  "transaction_submitted",
  "path_mint_returned",
  "path_mint_handoff",
]);

const isThoughtConsoleProgressEntry = (entry: ThoughtConsoleEntry) =>
  THOUGHT_CONSOLE_PROGRESS_KINDS.has(entry.kind) ||
  (entry.kind === "work_claim_authorization" && entry.title === "Codex authorized");

const isThoughtConsoleProgressActive = (
  entry: ThoughtConsoleEntry,
  state: ThoughtDockState,
) => {
  switch (entry.kind) {
    case "work_creating_run":
      return state.kind === "creating_run";
    case "work_opening_agent":
      return state.kind === "opening_agent";
    case "work_waiting_for_agent":
      return state.kind === "waiting_for_agent";
    case "work_agent_returned":
      return state.kind === "agent_returned";
    case "work_previewing":
      return state.kind === "previewing";
    case "work_claim_authorization":
      return state.kind === "claim_authorization" && Boolean(state.approving);
    case "wallet_connection_requested":
      return walletConnectInFlight;
    case "authorization_requested":
      return mintFlowState === "authorizing";
    case "transaction_requested":
    case "transaction_submitted":
      return mintFlowState === "minting";
    case "path_mint_returned":
      return mintFlowState === "thought_checking" || mintFlowState === "path_checking";
    default:
      return false;
  }
};

const THOUGHT_CONSOLE_TOP_EPSILON_PX = 2;

const newestFirstThoughtConsoleEntries = (entries: ThoughtConsoleEntry[]) => {
  const timeGroups: ThoughtConsoleEntry[][] = [];
  entries.forEach((entry) => {
    const currentGroup = timeGroups.at(-1);
    if (currentGroup?.at(-1)?.time === entry.time) {
      currentGroup.push(entry);
      return;
    }
    timeGroups.push([entry]);
  });
  return timeGroups.reverse().flat();
};

const renderThoughtConsoleHistory = (state: ThoughtDockState) => {
  const newestEntry = thoughtConsoleHistory.entries.at(-1);
  const previousNewestEntryId = thoughtDockDetailsBody.dataset.newestEntryId || undefined;
  const previousScrollTop = thoughtDockDetails.scrollTop;
  const wasPinnedToLatest = previousScrollTop <= THOUGHT_CONSOLE_TOP_EPSILON_PX;
  const entries = newestFirstThoughtConsoleEntries(thoughtConsoleHistory.entries).map((entry) => {
    const tone: DockRailTone = entry.tone === "neutral" ? "idle" : entry.tone;
    const actionNeeded = entry.tone === "warning" || entry.tone === "error";
    const nextStep = actionNeeded
      ? entry.nextStep ?? suggestedThoughtConsoleNextStep(entry)
      : entry.nextStep;
    const lines = buildThoughtConsoleLines({
      ...entry,
      ...(nextStep ? { nextStep } : {}),
    }).map((line, index) => statusScreenLine(line, {
      heading: index === 0,
      tone,
    }));
    if (lines[0] && isThoughtConsoleProgressEntry(entry)) {
      appendThoughtProgressEllipsis(
        lines[0],
        lines[0].textContent ?? "",
        entry.id === newestEntry?.id && isThoughtConsoleProgressActive(entry, state),
      );
    }
    const element = statusScreenEntry(lines);
    element.dataset.consoleEntryId = entry.id;
    element.dataset.attemptId = entry.context.attemptId;
    element.classList.toggle("is-boundary", entry.boundary);
    element.classList.toggle("is-current-attempt", entry.context.attemptId === mintAttemptId);
    return element;
  });
  thoughtDockDetailsBody.replaceChildren(...entries);
  thoughtDockDetailsBody.dataset.newestEntryId = newestEntry?.id ?? "";
  thoughtDockDetails.hidden = false;
  const hasNewLatestEntry = newestEntry?.id !== previousNewestEntryId;
  if (hasNewLatestEntry || wasPinnedToLatest) {
    thoughtDockDetails.scrollTop = 0;
  } else {
    thoughtDockDetails.scrollTop = previousScrollTop;
  }
};

const renderThoughtDockDetails = (
  state: ThoughtDockState,
  _presentation: ThoughtMintPresentation,
) => {
  renderThoughtConsoleHistory(state);
};

const getResolvedThoughtDockState = (): ThoughtDockState => {
  if (walletState.mintedTokenId !== null) {
    return {
      kind: "minted",
      tokenId: String(walletState.mintedTokenId),
      txHash: walletState.txHash || undefined,
    };
  }

  if (mintFlowState === "text_taken" && mintFlowData.existingTokenId !== null) {
    return {
      kind: "minted",
      tokenId: String(mintFlowData.existingTokenId),
      existing: true,
    };
  }

  if (!isThoughtDockActiveState(thoughtDockState)) {
    const work = getThoughtDockWorkView();
    if (work && runState === "output_ready") {
      return { kind: "work_ready", work };
    }
    const prompt = thoughtDockPrompt.value;
    return prompt ? { kind: "ready", prompt } : { kind: "empty" };
  }

  return thoughtDockState;
};

type ThoughtWorkMintReadiness =
  | { ready: true }
  | { ready: false; reason: string };

const getCurrentWorkMintReadiness = (): ThoughtWorkMintReadiness => {
  if (!THOUGHT_V2_MINT_ENABLED) {
    return { ready: false, reason: THOUGHT_V2_MINT_UNAVAILABLE_COPY };
  }
  if (!currentOutputText || !currentRunContext) {
    return { ready: false, reason: "This work has no current V2 run context. Run it again before minting." };
  }
  if (!hasCurrentContractWorkSvg()) {
    return { ready: false, reason: "This work has no verified contract preview. Run it again before minting." };
  }
  if (!IS_LOCAL_THOUGHT_V2) {
    return { ready: true };
  }
  if (currentRunContext.mode === MY_BRAIN_MODE) {
    return { ready: false, reason: "THOUGHT V2 minting requires a current Agent work." };
  }
  if (!currentRunContext.thoughtSpec) {
    return { ready: false, reason: "This work has no current V2 spec anchor. Run it again before minting." };
  }
  if (!currentRunContext.agentEvidence) {
    return { ready: false, reason: "This work has no current V2 Agent evidence. Run it again before minting." };
  }
  try {
    buildThoughtV2LocalAgentProcess(currentRunContext.agentEvidence, currentOutputText);
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : "This work is not valid for THOUGHT V2 minting.",
    };
  }
  return { ready: true };
};

const captureCurrentMintWork = (): ThoughtMintWorkSnapshot | null => {
  const readiness = getCurrentWorkMintReadiness();
  if (!readiness.ready || !currentRunContext) {
    return null;
  }
  const runContext = Object.freeze({
    ...currentRunContext,
    ...(currentRunContext.thoughtSpec
      ? { thoughtSpec: Object.freeze({ ...currentRunContext.thoughtSpec }) }
      : {}),
    ...(currentRunContext.agentEvidence
      ? { agentEvidence: Object.freeze({ ...currentRunContext.agentEvidence }) }
      : {}),
  });
  return Object.freeze({
    text: currentOutputText,
    svg: currentWorkSvg,
    workId: currentWorkId,
    runContext,
  });
};

const getThoughtDockRailView = (state: ThoughtDockState): DockRailView => {
  const resetAction = (run?: AgentDemoRun | null) =>
    dockRailAction("reset", "reset", "reset THOUGHT Dock and clear input", () => {
      if (run) {
        void cancelThoughtDockRun(run, { clearPrompt: true, focusPrompt: true });
        return;
      }
      resetThoughtDock({ clearPrompt: true, focusPrompt: true });
    });
  const cancelAgentSelectAction = (prompt: string) =>
    dockRailAction("cancel", "cancel", "cancel Agent selection", () => {
      setThoughtDockState({ kind: "ready", prompt });
      focusThoughtDockPrompt({ preventScroll: true });
    });
  const loadAction = () => {
    const loadPanelOpen = workLibraryRevealed;
    return dockRailAction(
      "load",
      loadPanelOpen ? "load ↓" : "load",
      loadPanelOpen ? "collapse saved works" : "open saved works",
      () => {
        workLibraryRevealed = !loadPanelOpen;
        if (workLibraryRevealed) {
          mintDockRevealed = false;
          writeCurrentOutputSession();
          emitThoughtConsoleEvent({
            kind: "work_library_opened",
            title: "load a saved work",
            detail: "Saved works use this browser's local storage. They are not on-chain or synced across browsers or devices.",
            tone: "neutral",
          });
        }
        syncThoughtDock();
        if (workLibraryRevealed) {
          requestAnimationFrame(() => thoughtDockWorksSelect.focus({ preventScroll: true }));
        }
      },
      { expanded: loadPanelOpen },
    );
  };
  const newThoughtAction = () =>
    dockRailAction("new-thought", "new thought", "start a new THOUGHT", () => {
      window.location.href = "/";
    });

  switch (state.kind) {
    case "empty":
      return {
        status: "Prompt needed",
        tone: "idle",
        actions: [
          dockRailAction(
            "send-agent",
            "send to your agent",
            "Enter a THOUGHT before running with your Agent",
            () => {},
            { disabled: true },
          ),
          loadAction(),
        ],
      };
    case "ready":
      return {
        status: "Prompt ready",
        tone: "idle",
        actions: [
          dockRailAction("send-agent", "send to your agent", "run this THOUGHT with your Agent", () => {
            openThoughtDockAgentSelect();
          }),
          loadAction(),
        ],
      };
    case "agent_select":
      return {
        status: "Choose Agent",
        tone: "idle",
        actions: [
          dockRailAction("codex", "codex", "run this THOUGHT with Codex", () => {
            void runThoughtDockAdapter("codex");
          }),
          dockRailAction("claude", "claude", "open this THOUGHT in Claude Code", () => {
            void runThoughtDockAdapter("claude");
          }),
          cancelAgentSelectAction(state.prompt),
        ],
        maxActions: 3,
      };
    case "creating_run":
      return {
        status: thoughtDockAgentLifecycleStatus(state.adapterId),
        tone: "running",
        actions: [],
      };
    case "agent_task_ready":
      return {
        status: "Task ready",
        tone: "idle",
        actions: [resetAction(state.run)],
      };
    case "opening_agent":
      return {
        status: `Opening ${thoughtAgentProductLabel(state.adapterId)}...`,
        tone: "running",
        actions: [resetAction(state.run)],
      };
    case "claim_authorization": {
      const code = state.authorization.verificationCode || "------";
      const authorized = state.authorization.state === "authorized" || state.approving;
      return {
        status: authorized ? "Codex authorized" : `Code ${code}`,
        tone: authorized ? "running" : "warning",
        actions: authorized
          ? [resetAction(state.run)]
          : [
              dockRailAction(
                "allow-codex",
                "allow codex",
                `allow Codex claim ${code}`,
                () => {
                  void approveThoughtDockClaim(state.run, state.adapterId, state.authorization);
                },
              ),
              resetAction(state.run),
            ],
      };
    }
    case "waiting_for_agent":
      return {
        status: thoughtDockAgentLifecycleStatus(state.adapterId, state.run.remoteState),
        tone: "running",
        actions: [resetAction(state.run)],
      };
    case "agent_returned":
      return { status: "Return received...", tone: "success", actions: [] };
    case "previewing":
      return { status: "Previewing...", tone: "running", actions: [] };
    case "preview_unavailable":
      return {
        status: "Preview unavailable",
        tone: "warning",
        actions: [
          dockRailAction("retry", "retry", "retry preview", () => {
            void retryThoughtDockPreview();
          }),
          resetAction(),
        ],
      };
    case "preview_rejected":
      return {
        status: "Rejected",
        tone: state.reasonCode === 3 ? "warning" : "error",
        actions: [resetAction()],
      };
    case "work_ready":
      {
        const workReady = getThoughtWorkReadyPresentation({
          mintEnabled: THOUGHT_V2_MINT_ENABLED,
        });
        const workMintReadiness = getCurrentWorkMintReadiness();
        const mintPanelOpen = mintDockRevealed;
        const canOpenMint = workReady.canMint && workMintReadiness.ready;
        const currentWorkSaved = currentWorkId !== null && Boolean(
          getWorkById(readStoredThoughtWorks(), currentWorkId),
        );
        return {
          status: canOpenMint ? "Work ready" : "Work blocked",
          tone: canOpenMint ? "success" : "warning",
          actions: [
            ...(canOpenMint
              ? [dockRailAction(
                  "mint",
                  mintPanelOpen ? "mint ↓" : "mint",
                  mintPanelOpen ? "collapse Mint panel" : "mint this accepted THOUGHT work",
                  () => {
                    if (mintPanelOpen) {
                      mintDockRevealed = false;
                      writeCurrentOutputSession();
                      syncThoughtDock();
                      return;
                    }
                    revealMintDock();
                    emitThoughtConsoleEvent({
                      kind: "mint_requirement",
                      title: "to mint THOUGHT",
                      detail: "1 THOUGHT requires 1 available $PATH. $PATH is the permission token for Inshell’s three fully on-chain movements for Agent Art.",
                      tone: "warning",
                    });
                    syncThoughtDock();
                    void mintThoughtDockWork();
                  },
                  { expanded: mintPanelOpen },
                )]
              : []),
            dockRailAction(
              "save",
              currentWorkSaved ? "saved" : "save",
              currentWorkSaved ? "current work is saved" : "save current work",
              () => {
                saveCurrentWorkFromDock();
              },
              { disabled: currentWorkSaved },
            ),
            loadAction(),
            resetAction(),
          ],
          maxActions: 4,
        };
      }
    case "minted": {
      const currentWorkSaved = currentWorkId !== null && Boolean(
        getWorkById(readStoredThoughtWorks(), currentWorkId),
      );
      return {
        status: state.existing ? "Already exists" : "Minted",
        tone: "success",
        actions: [
          dockRailAction("view", "view", "view minted THOUGHT", () => {
            void handleViewThought(state.tokenId ? Number(state.tokenId) : walletState.mintedTokenId);
          }),
          dockRailAction(
            "save",
            currentWorkSaved ? "saved" : "save",
            currentWorkSaved ? "current work is saved" : "save current work",
            () => {
              saveCurrentWorkFromDock();
            },
            { disabled: currentWorkSaved },
          ),
          loadAction(),
          resetAction(),
        ],
        maxActions: 4,
      };
    }
    case "run_access_needed":
      return {
        status: "",
        tone: "warning",
        actions: [newThoughtAction()],
      };
    case "expired":
      return {
        status: "Codex link expired",
        tone: "error",
        actions: [resetAction()],
      };
    case "failed":
      return {
        status: "Error",
        tone: "error",
        actions: [resetAction()],
      };
  }
};

const shortRunId = (runId: string) =>
  runId.length > 14 ? `${runId.slice(0, 8)}...${runId.slice(-4)}` : runId;

const isInjectedWalletMissing = () => !walletState.detected && !getEthereumProvider();

const formatPathAcquisitionPrice = (price: bigint) => {
  const [whole, rawFraction = ""] = formatEther(price).split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  if (!fraction) return whole;
  const firstNonZero = fraction.search(/[1-9]/);
  const visibleLength = whole === "0" && firstNonZero >= 0
    ? Math.min(fraction.length, firstNonZero + 6)
    : Math.min(fraction.length, 6);
  return `${whole}.${fraction.slice(0, visibleLength)}`;
};

const getCurrentMintPresentation = () => presentThoughtMint({
  state: mintFlowState,
  mintEnabled: THOUGHT_V2_MINT_ENABLED,
  providerDetected: !isInjectedWalletMissing(),
  walletRequestPending: walletConnectInFlight,
  address: walletState.address,
  chainId: walletState.chainId,
  requiredChainId: THOUGHT_CHAIN_ID,
  chainName: THOUGHT_CHAIN_NAME,
  inventory: {
    status: pathInventoryState.status,
    matchesWallet: pathInventoryMatchesCurrentWallet(),
    held: pathInventoryState.items.length,
    available: availablePathInventoryItems().length,
    error: pathInventoryState.error,
  },
  pathAcquisition: {
    state: pathAcquisitionState,
    completed: pathAcquisitionCompletedForAttempt,
    priceLabel: pathAcquisitionPrice > 0n
      ? `${formatPathAcquisitionPrice(pathAcquisitionPrice)} ${THOUGHT_CURRENCY_LABEL}`
      : THOUGHT_CURRENCY_LABEL,
    txHash: pathAcquisitionTxHash,
    error: pathAcquisitionError,
  },
  pathId: mintFlowData.pathId?.toString() ?? mintFlowData.pathIdInput.trim(),
  existingTokenId: walletState.mintedTokenId ?? mintFlowData.existingTokenId,
  authorization: {
    signed: Boolean(mintFlowData.signature && mintFlowData.deadline),
    deadline: mintFlowData.deadline,
  },
  transaction: {
    state: walletState.txState,
    hash: walletState.txHash || mintFlowData.txHash,
  },
  error: {
    kind: mintFlowData.errorKind,
    message: mintFlowData.error,
  },
});

const recordCurrentMintConsoleState = () => {
  recordMintConsoleState(
    getResolvedThoughtDockState(),
    getCurrentMintPresentation(),
  );
};

const visibleMintErrorCopy = () => {
  if (mintFlowData.errorKind === "wrong_network") {
    return "wrong network.";
  }
  if (mintFlowData.errorKind === "path_not_found") {
    return "wallet does not hold this $PATH.";
  }
  if (mintFlowData.errorKind === "path_consumed" || mintFlowData.errorKind === "path_not_ready") {
    return "$PATH has no THOUGHT mint available.";
  }
  if (mintFlowData.errorKind === "signature") {
    return mintFlowData.error || "signature failed.";
  }
  if (mintFlowData.errorKind === "thought") {
    return mintFlowData.error || "mint failed.";
  }
  if (mintFlowData.errorKind === "path_invalid" || mintFlowData.errorKind === "path_unknown") {
    return "enter a valid $PATH.";
  }
  if (/not submitted/i.test(mintFlowData.error)) {
    return "wallet transaction not submitted.";
  }
  if (/reject|denied|cancel/i.test(mintFlowData.error)) {
    return "transaction rejected.";
  }
  return "mint failed.";
};

const renderThoughtDock = () => {
  const state = getResolvedThoughtDockState();
  const locked = isThoughtDockInputLockedState(state);
  const mintPresentation = getCurrentMintPresentation();

  thoughtDockPrompt.readOnly = locked;
  if (thoughtDockPrompt.value !== sessionState.prompt) {
    thoughtDockPrompt.value = sessionState.prompt;
  }
  const rail = getThoughtDockRailView(state);
  if (IS_DEV_MODE) {
    assertDockRailView(rail);
  }

  const railHidden = rail.actions.length === 0;
  thoughtDock.dataset.rail = railHidden ? "hidden" : "visible";
  thoughtDockActionArea.hidden = railHidden;
  const nextRailSignature = railHidden ? "hidden" : thoughtDockRailRenderSignature(rail);
  const shouldRenderRail = nextRailSignature !== thoughtDockRailSignature;
  thoughtDockRailSignature = nextRailSignature;
  thoughtDockActionArea.dataset.content = "actions";
  if (railHidden) {
    thoughtDockActionArea.replaceChildren();
  } else if (shouldRenderRail || thoughtDockActionArea.childElementCount === 0) {
    thoughtDockActionArea.replaceChildren(
      thoughtDockActions(...rail.actions.map(renderDockRailAction)),
    );
  }
  syncMintDockPathPanel();
  syncWorkLibraryPanel();
  renderThoughtDockDetails(state, mintPresentation);
  syncThoughtDockRailInset();
};

const syncThoughtDock = () => {
  renderThoughtDock();
};

const buildThoughtDockRunPayload = async (prompt: string) => {
  sessionState.routeConfigured = true;
  sessionState.mode = CODEX_MODE;
  sessionState.codex.model = CODEX_MODEL;
  sessionState.prompt = prompt;
  promptBox.value = prompt;
  writeSessionState();
  await ensureThoughtDockActiveSpec();
  syncThoughtInstructionsControls();
  return buildCurrentThoughtRunPayload(prompt, CODEX_MODEL);
};

const createThoughtDockRun = async (
  prompt: string,
  payload: ThoughtRunPayload,
  adapterId: ThoughtDockAgentAdapterId,
): Promise<AgentDemoRun> => {
  assertThoughtLine(prompt, "prompt");
  if (payload.input.promptLine !== prompt) {
    throw new Error("sealed promptLine does not match the run payload.");
  }
  const createPayload = await fetchThoughtAgentJson<ThoughtAgentRunCreateResponse>(
    thoughtDockAgentApiUrl("runs"),
    {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        promptLine: prompt,
        specId: THOUGHT_AGENT_REGISTERED_SPEC_ID,
        requestedAgent: {
          adapterId: CODEX_PROVIDER,
          model: null,
        },
        client: {
          surface: "thought-dock",
          appVersion: `${APP_VERSION}+${APP_BUILD}`,
        },
        devAutoRun: false,
      }),
    },
  );
  if (
    !createPayload.runId ||
    !createPayload.browserToken ||
    !createPayload.statusUrl ||
    !createPayload.launchUri
  ) {
    throw new Error("THOUGHT Agent API returned an incomplete Dock run.");
  }
  const statusUrl = resolveThoughtDockAgentStatusUrl(createPayload.statusUrl);
  const launchUri = resolveThoughtDockAgentLaunchUri(createPayload.launchUri);
  const launchToken = agentDemoLaunchToken(launchUri);
  if (!launchToken) {
    throw new Error("THOUGHT Agent API returned a launch URI without a token.");
  }
  const promptHash = await agentDemoSha256(prompt);
  const baseRun = {
    runId: createPayload.runId,
    prompt,
    promptHash,
    launchUri,
    launchToken,
    browserToken: createPayload.browserToken,
    statusUrl,
    claimUrl: agentDemoRunActionUrl(statusUrl, "claim"),
    startUrl: agentDemoRunActionUrl(statusUrl, "start"),
    resultUrl: agentDemoRunActionUrl(statusUrl, "result"),
    remoteState: createPayload.state ?? "created",
    expiresAt: createPayload.claimExpiresAt,
  };
  const sealedTask = buildAgentDemoSealedTask(baseRun, adapterId);
  return {
    ...baseRun,
    sealedTask,
    codexUrl: buildCodexAgentUrl(sealedTask),
    claudeUrl: buildClaudeCodeAgentUrl(sealedTask),
    candidate: null,
  };
};

const requestThoughtDockRunCancellation = async (run: AgentDemoRun) => {
  await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(
    agentDemoRunActionUrl(run.statusUrl, "cancel"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${run.browserToken}`,
      },
      body: "{}",
    },
  );
};

const thoughtDockLaunchUrl = (run: AgentDemoRun, adapterId: ThoughtDockAgentAdapterId) =>
  adapterId === "claude" ? run.claudeUrl : run.codexUrl;

const launchThoughtDockAgentLink = (url: string) => {
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  if (/^https?:\/\//i.test(url)) {
    anchor.target = "_blank";
  }
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 1000);
};

const rejectInvalidThoughtDockPrompt = (prompt: string) => {
  const measure = measureThoughtV2Line(prompt, "prompt");
  const issue = describeThoughtTextPolicyIssue({
    value: prompt,
    line: "prompt",
    measure,
    maxBytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.promptMaxBytes,
  });
  if (!issue) {
    return false;
  }
  emitThoughtConsoleEvent({
    kind: issue.title === "text too long" ? "work_prompt_too_long" : "work_prompt_invalid",
    title: issue.title,
    detail: issue.detail,
    nextStep: issue.nextStep,
    tone: "warning",
    eventId: `prompt-validation:${hashText(prompt)}:${issue.detail}`,
  });
  setThoughtDockState({ kind: "ready", prompt });
  focusThoughtDockPrompt();
  return true;
};

const openThoughtDockAgentSelect = () => {
  if (blockPendingMintMutation()) {
    return;
  }
  const prompt = thoughtDockPrompt.value;
  if (rejectInvalidThoughtDockPrompt(prompt)) {
    return;
  }
  setThoughtDockState({ kind: "agent_select", prompt });
};

const buildThoughtDockFixtureRun = async (
  adapterId: ThoughtDockAgentAdapterId,
  prompt: string,
  agentLine: string,
): Promise<AgentDemoRun> => {
  const runId = `fixture_${adapterId}_${Date.now().toString(36)}_${agentDemoRandom(3)}`;
  const result = IS_LOCAL_THOUGHT_V2
    ? buildThoughtV2LocalAgentResult(agentLine, thoughtAgentProductLabel(adapterId))
    : null;
  const rawResponseSha256 = result
    ? (await sha256Hex(JSON.stringify(result))).replace(THOUGHT_SHA256_PREFIX, "")
    : "";

  return {
    runId,
    prompt,
    promptHash: await agentDemoSha256(prompt),
    launchUri: "",
    launchToken: "",
    browserToken: "",
    statusUrl: "",
    claimUrl: "",
    startUrl: "",
    resultUrl: "",
    codexUrl: "",
    claudeUrl: "",
    sealedTask: "",
    candidate: agentLine,
    remoteState: "returned",
    ...(result
      ? {
          agentEvidence: {
            result,
            runId,
            adapter: adapterId,
            rawResponseSha256,
          },
        }
      : {}),
  };
};

const runThoughtDockFixtureAdapter = async (
  adapterId: ThoughtDockAgentAdapterId,
  prompt: string,
  payload: ThoughtRunPayload,
  runSessionId: number,
) => {
  const nonce = `${Date.now().toString(36)} ${agentDemoRandom(3)}`;
  const agentLine = buildThoughtAgentFixtureLine(adapterId, nonce);
  assertThoughtLine(agentLine, "agent");
  const run = await buildThoughtDockFixtureRun(adapterId, prompt, agentLine);
  thoughtDockRun = run;
  emitThoughtConsoleEvent({
    kind: "work_agent_fixture",
    title: `${thoughtAgentProductLabel(adapterId)} fixture return`,
    detail: "local dev Agent bypass",
    tone: "neutral",
    eventId: run.runId,
  });
  await handleThoughtDockReturnedWork(run, agentLine, payload, runSessionId);
};

const runThoughtDockAdapter = async (adapterId: ThoughtDockAgentAdapterId) => {
  if (blockPendingMintMutation()) {
    return;
  }
  const prompt = thoughtDockPrompt.value;
  if (!prompt) {
    setThoughtDockState({ kind: "failed", message: "Prompt is empty." });
    thoughtDockPrompt.focus();
    return;
  }

  const adapter = THOUGHT_DOCK_AGENT_ADAPTERS.find((candidate) => candidate.id === adapterId);
  if (!adapter) {
    setThoughtDockState({ kind: "failed", message: "Agent adapter unavailable." });
    return;
  }
  if (!THOUGHT_AGENT_FIXTURE_MODE && !adapter.canDeepLink) {
    setThoughtDockState({
      kind: "failed",
      message: `${thoughtAgentProductLabel(adapterId)} deep link unavailable.`,
      details: `${thoughtAgentProductLabel(adapterId)} does not expose a supported deep-link callback flow yet.`,
    });
    return;
  }

  const runSessionId = startRunSession();
  lastRunErrorCliLines = [];
  lastPreviewRetryContext = null;
  runState = "running";
  runInFlight = true;
  setWarning("");
  setStatus("");
  setThoughtDockState({ kind: "creating_run", prompt, adapterId });

  try {
    const payload = await buildThoughtDockRunPayload(prompt);
    if (!isCurrentRunSession(runSessionId)) {
      return;
    }
    if (THOUGHT_AGENT_FIXTURE_MODE) {
      await runThoughtDockFixtureAdapter(adapterId, prompt, payload, runSessionId);
      return;
    }
    const run = await createThoughtDockRun(prompt, payload, adapterId);
    if (!isCurrentRunSession(runSessionId)) {
      return;
    }
    thoughtDockRun = run;
    setThoughtDockState({
      kind: "opening_agent",
      run,
      adapterId,
    });
    storeThoughtDockRun(run, adapterId);
    startThoughtDockPolling(run, payload, adapterId, runSessionId);
    launchThoughtDockAgentLink(thoughtDockLaunchUrl(run, adapterId));
    setThoughtDockState({
      kind: "waiting_for_agent",
      run,
      adapterId,
      message: `${thoughtAgentProductLabel(adapterId)} was opened if your browser allowed it.`,
    });
  } catch (error) {
    if (!isCurrentRunSession(runSessionId)) {
      return;
    }
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage.includes("spec") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)
      ? formatThoughtSpecError(error)
      : rawMessage.replace(/\bTHOUGHT Bridge\b/g, "Agent link") || "Could not create Agent run.";
    runState = "run_failed";
    runInFlight = false;
    setThoughtDockState({ kind: "failed", message });
    syncInterface();
  }
};

const updateThoughtDockRunState = (run: AgentDemoRun, remoteState: string, expiresAt?: string) => {
  const nextExpiresAt = expiresAt ?? run.expiresAt;
  thoughtDockRun = {
    ...run,
    remoteState,
    expiresAt: nextExpiresAt,
  };
  const stored = readStoredThoughtDockRun();
  if (stored && stored.runId === run.runId) {
    writeStoredThoughtDockRun({
      ...stored,
      remoteState,
      expiresAt: nextExpiresAt,
    });
  }
};

const approveThoughtDockClaim = async (
  run: AgentDemoRun,
  adapterId: ThoughtDockAgentAdapterId,
  authorization: ThoughtClaimAuthorization,
) => {
  if (!authorization.claimRequestId) {
    setThoughtDockState({
      kind: "failed",
      message: "Codex claim request is incomplete.",
      details: "Reset and open a new Agent run.",
    });
    return;
  }

  setThoughtDockState({
    kind: "claim_authorization",
    run,
    adapterId,
    authorization,
    approving: true,
  });

  try {
    await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(
      agentDemoRunActionUrl(run.statusUrl, "claim-authorization"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${run.browserToken}`,
        },
        body: JSON.stringify({
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          claimRequestId: authorization.claimRequestId,
        }),
      },
    );
    setThoughtDockState({
      kind: "waiting_for_agent",
      run,
      adapterId,
      message: "Codex authorized. Waiting for its return.",
    });
    refreshThoughtDockPolling();
  } catch (error) {
    setThoughtDockState({
      kind: "failed",
      message: "Could not authorize Codex.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
};

const startThoughtDockPolling = (
  run: AgentDemoRun,
  payload: ThoughtRunPayload,
  adapterId: ThoughtDockAgentAdapterId,
  runSessionId: number,
) => {
  const generation = ++thoughtDockPollGeneration;
  thoughtDockPollWakeScheduler.clearImmediatePoll();
  thoughtDockPollWakeScheduler.wake();
  let transientErrors = 0;
  let terminalHandled = false;
  let activeRun = run;

  const pollOnce = async () => {
    if (
      terminalHandled ||
      generation !== thoughtDockPollGeneration ||
      !isCurrentRunSession(runSessionId)
    ) {
      return true;
    }

    if (activeRun.remoteState === "created" && hasThoughtPollDeadlineExpired(activeRun.expiresAt)) {
      terminalHandled = true;
      clearStoredThoughtDockRun(activeRun.runId);
      runState = "run_failed";
      runInFlight = false;
      setThoughtDockState({ kind: "expired", run: { ...activeRun, remoteState: "expired" } });
      syncInterface();
      return true;
    }

    const response = await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(run.statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${run.browserToken}`,
      },
    });
    if (
      terminalHandled ||
      generation !== thoughtDockPollGeneration ||
      !isCurrentRunSession(runSessionId)
    ) {
      return true;
    }

    const remoteState = response.state ?? "created";
    activeRun = {
      ...activeRun,
      remoteState,
      expiresAt: response.expiresAt ?? activeRun.expiresAt,
    };
    updateThoughtDockRunState(activeRun, remoteState, response.expiresAt);
    transientErrors = 0;

    if (
      remoteState === "created" &&
      response.claimAuthorization &&
      (response.claimAuthorization.state === "pending" ||
        response.claimAuthorization.state === "authorized")
    ) {
      setThoughtDockState({
        kind: "claim_authorization",
        run: activeRun,
        adapterId,
        authorization: response.claimAuthorization,
        approving: response.claimAuthorization.state === "authorized",
      });
      return false;
    }

    if (remoteState === "returned") {
      terminalHandled = true;
      const returned = await readThoughtAgentReturn(response, activeRun.runId, adapterId);
      if (!returned.agentLine) {
        throw new Error("Agent returned no work.");
      }
      activeRun = {
        ...activeRun,
        ...(returned.agentEvidence ? { agentEvidence: returned.agentEvidence } : {}),
      };
      clearStoredThoughtDockRun(activeRun.runId);
      await handleThoughtDockReturnedWork(activeRun, returned.agentLine, payload, runSessionId);
      return true;
    }

    if (remoteState === "failed" || remoteState === "cancelled" || remoteState === "expired") {
      terminalHandled = true;
      clearStoredThoughtDockRun(activeRun.runId);
      runState = "run_failed";
      runInFlight = false;
      setThoughtDockState(
        remoteState === "expired"
          ? { kind: "expired", run: activeRun }
          : {
              kind: "failed",
              message: normalizeThoughtAgentProtocolError(
                response.error?.message || `Agent run ${remoteState}.`,
                adapterId,
              ),
            },
      );
      syncInterface();
      return true;
    }

    const currentState = thoughtDockState;
    if (
      currentState.kind === "waiting_for_agent" ||
      currentState.kind === "opening_agent" ||
      currentState.kind === "agent_task_ready" ||
      currentState.kind === "claim_authorization"
    ) {
      setThoughtDockState({
        kind: "waiting_for_agent",
        run: activeRun,
        adapterId,
        message: remoteState === "created"
          ? "Waiting for your Agent. Return here after it finishes."
          : `Agent is ${remoteState}. Return here after it finishes.`,
      });
    }
    return false;
  };

  let pollInFlight: Promise<boolean> | null = null;
  const pollOnceSafely = () => {
    if (!pollInFlight) {
      pollInFlight = pollOnce().finally(() => {
        pollInFlight = null;
      });
    }
    return pollInFlight;
  };

  const requestImmediatePoll = () => {
    void pollOnceSafely().catch(() => {
      // The regular loop retains retry/error ownership.
    });
  };
  thoughtDockPollWakeScheduler.setImmediatePoll(requestImmediatePoll);

  void (async () => {
    try {
      while (generation === thoughtDockPollGeneration && isCurrentRunSession(runSessionId)) {
        try {
          const terminal = await pollOnceSafely();
          if (terminal) {
            return;
          }
          await thoughtDockPollWakeScheduler.wait(THOUGHT_AGENT_STATUS_POLL_MS);
        } catch (error) {
          transientErrors += 1;
          if (generation !== thoughtDockPollGeneration || !isCurrentRunSession(runSessionId)) {
            return;
          }
          if (transientErrors < 3) {
            await thoughtDockPollWakeScheduler.wait(THOUGHT_AGENT_STATUS_POLL_MS * transientErrors);
            continue;
          }
          runState = "run_failed";
          runInFlight = false;
          setThoughtDockState({
            kind: "failed",
            message: "Agent status check failed.",
            details: error instanceof Error ? error.message : undefined,
          });
          syncInterface();
          return;
        }
      }
    } finally {
      thoughtDockPollWakeScheduler.clearImmediatePoll(requestImmediatePoll);
    }
  })();
};

const handleThoughtDockReturnedWork = async (
  run: AgentDemoRun,
  rawCandidate: string,
  payload: ThoughtRunPayload,
  runSessionId: number,
) => {
  if (!isCurrentRunSession(runSessionId)) {
    return;
  }
  if (blockPendingMintMutation()) {
    return;
  }
  thoughtDockRun = {
    ...run,
    candidate: rawCandidate,
    remoteState: "returned",
  };
  setThoughtDockState({ kind: "agent_returned", run: thoughtDockRun, rawCandidate });
  await new Promise((resolve) => window.setTimeout(resolve, THOUGHT_DOCK_RETURN_RECEIVED_MS));
  if (!isCurrentRunSession(runSessionId)) {
    return;
  }
  setThoughtDockState({ kind: "previewing", rawCandidate });

  try {
    const result = await completeThoughtRunFromModelReturn(payload, rawCandidate, run.agentEvidence);
    if (!isCurrentRunSession(runSessionId)) {
      return;
    }
    if (result.kind === "unavailable") {
      runInFlight = false;
      runState = "candidate_ready";
      const reason = result.lines.filter(Boolean).join(" ");
      setThoughtDockState({
        kind: "preview_unavailable",
        rawCandidate,
        reason: reason || "Preview unavailable.",
      });
      syncInterface();
      return;
    }
    if (result.kind === "pending_mint") {
      blockPendingMintMutation();
      return;
    }
    runInFlight = false;
    const work = getThoughtDockWorkView();
    setThoughtDockState(work ? { kind: "work_ready", work } : { kind: "failed", message: "Preview accepted no work." });
    if (work) recordCurrentMintConsoleState();
    syncInterface();
  } catch (error) {
    if (!isCurrentRunSession(runSessionId)) {
      return;
    }
    runInFlight = false;
    runState = "run_failed";
    const message = error instanceof Error ? error.message : "Preview failed.";
    setThoughtDockState(
      isContractWorkPreviewError(error)
        ? {
            kind: "preview_rejected",
            rawCandidate,
            reason: formatThoughtDockPreviewError(error),
            reasonCode: error.previewReasonCode,
            ...(error.issue ? { issue: error.issue } : {}),
          }
        : { kind: "failed", message },
    );
    syncInterface();
  }
};

const formatThoughtDockPreviewError = (error: unknown) => {
  if (isContractWorkPreviewError(error)) {
    if (error.issue) {
      return error.issue.detail;
    }
    if (typeof error.previewReasonCode === "number") {
      if (error.previewReasonCode === 3 && error.byteLimit) {
        return formatThoughtByteLimitUsage(error.byteLimit);
      }
      return previewWorkReasonLabel(error.previewReasonCode);
    }
    const contractLine = error.cliLines?.find(
      (line) =>
        line &&
        !/^use:/i.test(line) &&
        !/^(model return rejected|work blocked|no work created)\.?$/i.test(line),
    );
    return contractLine || error.message;
  }
  return error instanceof Error ? error.message : "Preview rejected.";
};

const retryThoughtDockPreview = async () => {
  if (blockPendingMintMutation()) {
    return;
  }
  if (!currentCandidate && !lastPreviewRetryContext) {
    setThoughtDockState({ kind: "failed", message: "No candidate to preview." });
    return;
  }

  const candidate = currentCandidate ?? createThoughtCandidate(
    (lastPreviewRetryContext as LastPreviewRetryContext).payload,
    (lastPreviewRetryContext as LastPreviewRetryContext).modelReturn,
  );
  currentCandidate = candidate;
  writeCurrentCandidateSession();
  setThoughtDockState({ kind: "previewing", rawCandidate: candidate.rawModelReturn });

  try {
    const attempt = await attemptContractPreviewForCandidate(candidate, { manual: true });
    if (attempt.kind === "unavailable") {
      setThoughtDockState({
        kind: "preview_unavailable",
        rawCandidate: candidate.rawModelReturn,
        reason: attempt.lines.filter(Boolean).join(" ") || "Preview unavailable.",
      });
      return;
    }
    if (attempt.kind === "rejected") {
      throw attempt.error;
    }
    if (!promotePreviewedCandidateToWork(candidate, attempt.preview, attempt.trace)) {
      return;
    }
    const work = getThoughtDockWorkView();
    setThoughtDockState(work ? { kind: "work_ready", work } : { kind: "failed", message: "Preview accepted no work." });
    if (work) recordCurrentMintConsoleState();
    syncInterface();
  } catch (error) {
    setThoughtDockState({
      kind: "preview_rejected",
      rawCandidate: candidate.rawModelReturn,
      reason: formatThoughtDockPreviewError(error),
      reasonCode: isContractWorkPreviewError(error) ? error.previewReasonCode : undefined,
      ...(isContractWorkPreviewError(error) && error.issue ? { issue: error.issue } : {}),
    });
  }
};

const mintThoughtDockWork = async (options?: { attemptId?: string; pathId?: string }) => {
  if (blockPendingMintMutation()) {
    return true;
  }
  const work = getThoughtDockWorkView();
  if (!work) {
    setThoughtDockState({ kind: "failed", message: "No accepted work to mint." });
    return false;
  }
  const readiness = getCurrentWorkMintReadiness();
  if (!readiness.ready) {
    resetMintFlow({ preserveAttempt: true });
    mintAttemptId = options?.attemptId?.trim() || nextMintAttemptId("mint");
    setThoughtDockState({ kind: "work_ready", work });
    emitThoughtConsoleEvent({
      kind: "work_blocked",
      title: "work blocked",
      detail: readiness.reason,
      tone: "warning",
      eventId: `work-blocked:${currentRunContext?.clientGeneratedAt ?? currentOutputText}`,
    });
    syncInterface();
    return false;
  }
  const mintWork = captureCurrentMintWork();
  if (!mintWork) {
    return false;
  }

  // The Work Mint CTA owns disclosure; the mint flow only owns panel content.
  mintFlowState = "thought_checking";
  setThoughtDockState({ kind: "work_ready", work });
  try {
    await openMintFlow(THOUGHT_PANEL_MINT_UI_MODE, { ...options, work: mintWork });
    await resumePendingPathAcquisition();
    syncInterface();
    return true;
  } catch (error) {
    setThoughtDockState({
      kind: "failed",
      message: error instanceof Error ? error.message : "Mint unavailable.",
    });
    return false;
  }
};

const connectThoughtDockWallet = async () => {
  const work = getThoughtDockWorkView();
  if (!work) {
    setThoughtDockState({ kind: "failed", message: "No accepted work to mint." });
    return;
  }

  setThoughtDockState({ kind: "work_ready", work });
  await requestWalletConnect();

  if (!walletState.address) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    setMintFlowError("wrong network.", "wrong_network");
    syncInterface();
    focusMintDockStage();
    return;
  }

  if (mintFlowState === "wallet_required" || mintFlowState === "error") {
    mintFlowState = "path_required";
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
    recordCurrentMintConsoleState();
  }
  syncInterface();
  focusMintDockStage("path");
};

const syncMintFlowAfterWalletCommand = () => {
  if (mintFlowState === "closed" || mintFlowState === "minted" || pendingMintTransaction) {
    return;
  }

  if (!walletState.address) {
    mintFlowState = "wallet_required";
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
    recordCurrentMintConsoleState();
    return;
  }

  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    mintFlowState = "error";
    mintFlowData.error = "wrong network.";
    mintFlowData.errorKind = "wrong_network";
    recordCurrentMintConsoleState();
    return;
  }

  if (mintFlowState === "wallet_required" || mintFlowData.errorKind === "wrong_network") {
    mintFlowState = "path_required";
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
    recordCurrentMintConsoleState();
  }
};

const runThoughtDockWalletCommand = async () => {
  if (isInjectedWalletMissing()) {
    renderThoughtDock();
    return;
  }

  if (!walletState.address) {
    await requestWalletConnect();
    syncMintFlowAfterWalletCommand();
    syncInterface();
    return;
  }

  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    await switchWalletChain();
    syncMintFlowAfterWalletCommand();
    syncInterface();
    return;
  }

  await refreshWalletState();
  if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID) {
    await refreshPathInventoryForCurrentWallet({ force: true });
  }
  syncInterface();
};

const switchThoughtDockWalletNetwork = async () => {
  const work = getThoughtDockWorkView();
  if (!work) {
    setThoughtDockState({ kind: "failed", message: "No accepted work to mint." });
    return;
  }

  setThoughtDockState({ kind: "work_ready", work });
  await switchWalletChain();

  if (!walletState.address) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    return;
  }

  mintFlowState = walletState.chainId === THOUGHT_CHAIN_ID ? "path_required" : "error";
  mintFlowData.error = walletState.chainId === THOUGHT_CHAIN_ID ? "" : "wrong network.";
  mintFlowData.errorKind = walletState.chainId === THOUGHT_CHAIN_ID ? "none" : "wrong_network";
  recordCurrentMintConsoleState();
  syncInterface();
};

function cancelThoughtDockRun(run?: AgentDemoRun | null, options?: { clearPrompt?: boolean; focusPrompt?: boolean }) {
  const pendingRun = run ?? thoughtDockRun;
  if (pendingRun?.statusUrl && pendingRun.browserToken) {
    void fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(
      agentDemoRunActionUrl(pendingRun.statusUrl, "cancel"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pendingRun.browserToken}`,
        },
      },
    ).catch(() => {
      // Local cancellation should still work if the remote run is already terminal or unreachable.
    });
  }
  resetThoughtDock({
    clearPrompt: options?.clearPrompt === true,
    focusPrompt: options?.focusPrompt === true,
  });
}

const resetThoughtDock = (options?: { clearPrompt?: boolean; focusPrompt?: boolean }) => {
  if (blockPendingMintMutation()) {
    return false;
  }
  thoughtDockPollGeneration += 1;
  thoughtDockPollWakeScheduler.clearImmediatePoll();
  thoughtDockPollWakeScheduler.wake();
  clearStoredThoughtDockRun();
  thoughtDockRun = null;
  thoughtDockAdapterId = "codex";
  runInFlight = false;
  resetThought();
  if (options?.clearPrompt) {
    sessionState.prompt = "";
    promptBox.value = "";
    thoughtDockPrompt.value = "";
    writeSessionState();
  }
  const prompt = thoughtDockPrompt.value;
  setThoughtDockState(prompt ? { kind: "ready", prompt } : { kind: "empty" });
  syncInterface();
  if (options?.focusPrompt) {
    focusThoughtDockPrompt({ preventScroll: true });
  }
  return true;
};

const resumeThoughtDockPendingRun = () => {
  const stored = readStoredThoughtDockRun();
  if (!stored) {
    return false;
  }
  const run = thoughtDockRunFromStored(stored);
  thoughtDockRun = run;
  thoughtDockAdapterId = stored.adapterId;
  sessionState.prompt = stored.prompt;
  promptBox.value = stored.prompt;
  thoughtDockPrompt.value = stored.prompt;
  runState = "running";
  runInFlight = true;
  const runSessionId = startRunSession();
  setThoughtDockState({
    kind: "waiting_for_agent",
    run,
    adapterId: stored.adapterId,
    message: "Resuming Agent run. Return here after it finishes.",
  });
  void buildThoughtDockRunPayload(stored.prompt)
    .then((payload) => {
      startThoughtDockPolling(run, payload, stored.adapterId, runSessionId);
    })
    .catch((error) => {
      runState = "run_failed";
      runInFlight = false;
      clearStoredThoughtDockRun(stored.runId);
      setThoughtDockState({
        kind: "failed",
        message: error instanceof Error ? error.message : "Could not resume Agent run.",
      });
    });
  return true;
};

const readRunViewToken = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    ROUTE_SEARCH_PARAMS.get("view_token")?.trim() ||
    ROUTE_SEARCH_PARAMS.get("token")?.trim() ||
    hashParams.get("view_token")?.trim() ||
    hashParams.get("token")?.trim() ||
    ""
  );
};

const normalizeThoughtDockAdapterId = (value: unknown): ThoughtDockAgentAdapterId =>
  value === "claude" ? "claude" : "codex";

const thoughtDockRunFromStatus = async (
  statusUrl: string,
  browserToken: string,
  status: ThoughtAgentRunStatusResponse,
): Promise<AgentDemoRun> => {
  const runId = status.runId || ROUTE_RUN_ID;
  const prompt = status.request?.promptLine?.text ?? "";
  const promptHash = status.request?.promptLine?.sha256 || hashText(prompt);
  const adapterId = normalizeThoughtDockAdapterId(status.request?.requestedAgent?.adapterId);
  const baseRun = {
    runId,
    prompt,
    promptHash,
    launchUri: "",
    launchToken: "",
    browserToken,
    statusUrl,
    claimUrl: agentDemoRunActionUrl(statusUrl, "claim"),
    startUrl: agentDemoRunActionUrl(statusUrl, "start"),
    resultUrl: agentDemoRunActionUrl(statusUrl, "result"),
    remoteState: status.state ?? "created",
    expiresAt: status.expiresAt,
  };
  const sealedTask = status.request?.agentInput?.text || buildAgentDemoSealedTask(baseRun, adapterId);
  const returned = await readThoughtAgentReturn(status, runId, adapterId);
  return {
    ...baseRun,
    sealedTask,
    codexUrl: buildCodexAgentUrl(sealedTask),
    claudeUrl: buildClaudeCodeAgentUrl(sealedTask),
    candidate: returned.agentLine || null,
    ...(returned.agentEvidence ? { agentEvidence: returned.agentEvidence } : {}),
  };
};

const hydrateThoughtRunLink = async () => {
  if (!IS_RUN_PAGE) {
    return false;
  }

  const viewToken = readRunViewToken();
  const statusUrl = thoughtDockAgentApiUrl(`runs/${ROUTE_RUN_ID}`);
  if (!viewToken) {
    setThoughtDockState({
      kind: "run_access_needed",
      details: "This run link is missing its view token.",
    });
    return true;
  }

  const runSessionId = startRunSession();
  setThoughtDockState({
    kind: "creating_run",
    prompt: "",
    adapterId: "codex",
  });

  try {
    const status = await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${viewToken}`,
      },
    });
    if (!isCurrentRunSession(runSessionId)) {
      return true;
    }

    const adapterId = normalizeThoughtDockAdapterId(status.request?.requestedAgent?.adapterId);
    const run = await thoughtDockRunFromStatus(statusUrl, viewToken, status);
    thoughtDockRun = run;
    thoughtDockAdapterId = adapterId;
    runInFlight = status.state !== "returned" && status.state !== "failed" && status.state !== "cancelled" && status.state !== "expired";

    const prompt = protocolLineInput(run.prompt);
    const hasPrompt = Boolean(prompt.trim());
    if (hasPrompt) {
      sessionState.prompt = prompt;
      promptBox.value = prompt;
      thoughtDockPrompt.value = prompt;
      writeSessionState();
    }

    if (status.state === "returned") {
      const candidate = run.candidate;
      if (!hasPrompt || !candidate) {
        setThoughtDockState({
          kind: "failed",
          message: "Run cannot mint.",
          details: !hasPrompt ? "Authenticated run status did not include the prompt." : "Agent returned no work.",
        });
        runInFlight = false;
        return true;
      }
      const payload = await buildThoughtDockRunPayload(prompt);
      await handleThoughtDockReturnedWork({ ...run, remoteState: "returned" }, candidate, payload, runSessionId);
      return true;
    }

    if (status.state === "failed" || status.state === "cancelled" || status.state === "expired") {
      runInFlight = false;
      setThoughtDockState(
        status.state === "expired"
          ? { kind: "expired", run }
          : {
              kind: "failed",
              message: normalizeThoughtAgentProtocolError(
                status.error?.message || `Agent run ${status.state}.`,
                adapterId,
              ),
            },
      );
      return true;
    }

    setThoughtDockState({
      kind: "waiting_for_agent",
      run,
      adapterId,
      message: "Waiting for Agent. Return will appear here automatically.",
    });
    if (prompt) {
      const payload = await buildThoughtDockRunPayload(prompt);
      startThoughtDockPolling(run, payload, adapterId, runSessionId);
    }
    return true;
  } catch (error) {
    if (!isCurrentRunSession(runSessionId)) {
      return true;
    }
    runInFlight = false;
    setThoughtDockState({
      kind: "failed",
      message: "Run link failed.",
      details: error instanceof Error ? error.message : "Could not load the THOUGHT run.",
    });
    return true;
  }
};

let currentWorkId: number | null = null;
let currentThoughtDetail: ThoughtDetail | null = null;
let thoughtDetailStatusTimer: number | null = null;
let thoughtDetailEmbeddedHeightFrame = 0;
let thoughtDetailTextFrame = 0;
let cliSuggestionContext: "auto" | "help" | "current" | "config" = "auto";
let pageUnloading = false;
let suppressBridgeLaunchUnloadUntil = 0;
let walletConnectInFlight = false;
let walletDisconnectedByUser = false;
let primaryActionState: PrimaryActionState = "run";
let secondaryActionState: SecondaryActionState = "none";
let thoughtInstructionsObjectUrl: string | null = null;
const DEFAULT_DEBUG_STATE: ThoughtDebugState = {
  open: false,
  enabled: false,
  cta: "auto",
  ctaStatus: "auto",
  warning: "auto",
};
const DEBUG_CTA_LABELS: Record<ThoughtDebugCtaOverride, string> = {
  auto: "auto",
  run: "run",
  running: "running",
  retry: "retry",
  mint: "mint",
  view_thought: "view THOUGHT",
};
const DEBUG_CTA_STATUS_LABELS: Record<ThoughtDebugCtaStatusOverride, string> = {
  auto: "auto",
  none: "none",
  ready: "ready",
  minted: "minted",
  model_needed: "model access needed",
  generation_failed: "generation failed",
  mint_unavailable: "mint unavailable",
};
const DEBUG_WARNING_LABELS: Record<ThoughtDebugWarningOverride, string> = {
  auto: "auto",
  none: "none",
  prompt_required: "prompt required",
  model_required: "model required",
  openrouter_required: "openrouter required",
  api_key_required: "api key required",
  ollama_not_found: "ollama not found",
  spec_unavailable: "spec unavailable",
  provider_error: "provider error",
  external_service: "external service",
  openrouter_connect_constraint: "openrouter constraint",
  wallet_missing: "wallet missing",
  wallet_connect_failed: "wallet connect failed",
  wallet_switch_failed: "wallet switch failed",
  thought_too_large: "THOUGHT too large",
  mint_contract_unavailable: "mint unavailable",
};
const DEBUG_CTA_OPTIONS = Object.keys(DEBUG_CTA_LABELS) as ThoughtDebugCtaOverride[];
const DEBUG_STATUS_BY_CTA: Record<ThoughtDebugCtaOverride, ThoughtDebugCtaStatusOverride[]> = {
  auto: ["auto"],
  run: ["auto", "none", "model_needed"],
  running: ["auto", "none"],
  retry: ["auto", "generation_failed"],
  mint: ["auto", "ready", "mint_unavailable"],
  view_thought: ["auto", "minted"],
};
const DEBUG_DEFAULT_STATUS_BY_CTA: Record<ThoughtDebugCtaOverride, ThoughtDebugCtaStatusOverride> = {
  auto: "auto",
  run: "none",
  running: "none",
  retry: "generation_failed",
  mint: "ready",
  view_thought: "minted",
};
const DEBUG_WARNINGS_BY_CTA_STATUS: Record<
  ThoughtDebugCtaOverride,
  Partial<Record<ThoughtDebugCtaStatusOverride, ThoughtDebugWarningOverride[]>>
> = {
  auto: {
    auto: ["auto"],
  },
  run: {
    none: [
      "auto",
      "none",
      "prompt_required",
      "model_required",
      "spec_unavailable",
      "provider_error",
      "external_service",
    ],
    model_needed: [
      "auto",
      "none",
      "openrouter_required",
      "api_key_required",
      "ollama_not_found",
      "openrouter_connect_constraint",
    ],
  },
  running: {
    none: ["auto", "none"],
  },
  retry: {
    generation_failed: [
      "auto",
      "provider_error",
      "external_service",
      "ollama_not_found",
      "spec_unavailable",
    ],
  },
  mint: {
    ready: ["auto", "none", "thought_too_large"],
    mint_unavailable: ["auto", "none", "mint_contract_unavailable", "spec_unavailable"],
  },
  view_thought: {
    minted: ["auto", "none"],
  },
};
let debugState: ThoughtDebugState = { ...DEFAULT_DEBUG_STATE };

const getDebugStatusOptions = () => DEBUG_STATUS_BY_CTA[debugState.cta];

const getEffectiveDebugCtaStatus = () =>
  debugState.ctaStatus === "auto"
    ? DEBUG_DEFAULT_STATUS_BY_CTA[debugState.cta]
    : debugState.ctaStatus;

const getDebugWarningOptions = () => {
  const status = getEffectiveDebugCtaStatus();
  return DEBUG_WARNINGS_BY_CTA_STATUS[debugState.cta][status] ?? ["auto"];
};

const normalizeDebugHierarchy = () => {
  const statusOptions = getDebugStatusOptions();
  if (!statusOptions.includes(debugState.ctaStatus)) {
    debugState.ctaStatus = "auto";
  }

  const warningOptions = getDebugWarningOptions();
  if (!warningOptions.includes(debugState.warning)) {
    debugState.warning = "auto";
  }
};

const syncDebugSelect = <T extends string>(
  select: HTMLSelectElement,
  values: T[],
  labels: Record<T, string>,
  selectedValue: T,
) => {
  const options = values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value];
    return option;
  });

  select.replaceChildren(...options);
  select.value = selectedValue;
};
const modelOptionsCache = new Map<ModelSourceId, ModelOption[]>();
const modelOptionsLoading = new Set<ModelSourceId>();
const walletState: ThoughtWalletState = {
  detected: false,
  address: "",
  chainId: null,
  txState: "idle",
  txHash: "",
  txError: "",
  balance: null,
  preflightLoading: false,
  preflightError: "",
  mintedTokenId: null,
};
let walletStateHydrated = false;
let mintFlowState: MintFlowState = "closed";
let mintFlowUiMode: MintFlowUiMode = THOUGHT_PANEL_MINT_UI_MODE;
let mintDockRevealed = false;
let thoughtExistenceCheckRequestId = 0;
const revealMintDock = () => {
  mintDockRevealed = true;
  workLibraryRevealed = false;
  writeCurrentOutputSession();
};
let activeMintWork: ThoughtMintWorkSnapshot | null = null;
const mintFlowData: MintFlowData = {
  rawText: "",
  textHash: "",
  promptHash: "",
  thoughtSpecId: "",
  thoughtSpecHash: "",
  provenanceJson: "",
  existingTokenId: null,
  pathIdInput: "",
  pathId: null,
  deadline: null,
  signature: "",
  txHash: "",
  error: "",
  errorKind: "none",
};
let pathInventoryRequestId = 0;
let pathInventoryState: PathInventoryState = {
  status: "idle",
  wallet: "",
  chainId: null,
  items: [],
  error: "",
};
let pathAcquisitionState: ThoughtPathAcquisitionState = "idle";
let pathAcquisitionPrice = 0n;
let pathAcquisitionTxHash = "";
let pathAcquisitionError = "";
let pathAcquisitionCompletedForAttempt = false;
let pathAcquisitionRequestId = 0;
let pathAcquisitionReceiptMonitorHash = "";
let pendingMintTransaction = readPendingMintTransaction();
let conflictingMintTransactions = readConflictingMintTransactions();
const conflictingMintReceiptMonitorHashes = new Set<string>();
let pendingMintReceiptMonitorHash = "";
let pendingMintReceiptMonitorGeneration = 0;
let mintAuthorizationInFlight = false;
let mintTransactionInFlight = false;
let walletMintSubmitPromiseUnresolved = false;
let unresolvedMintSubmission: Readonly<{
  requestId: number;
  submission: MintSubmissionContext;
  provider: JsonRpcProvider | BrowserProvider | null;
  releaseLockAfterRecovery: () => void;
  releaseCompleted: Promise<void>;
}> | null = null;
let activeMintTransactionRequestId = 0;
let pendingMintStorageListenerBound = false;
let currentRunContext: ThoughtRunContext | null = null;
let currentCandidate: ThoughtCandidate | null = null;
let activeThoughtSpec: ActiveThoughtSpec | null = null;
let activeThoughtSpecPromise: Promise<ActiveThoughtSpec> | null = null;
let thoughtDetailSpecJsonUrl = "";
let thoughtDetailColorFontUrl = "";
let thoughtDetailProvenanceJsonUrl = "";
let colorFontPageRawUrl = "";
let readProvider: JsonRpcProvider | null = null;
let mintReceiptBrowserProvider: BrowserProvider | null = null;
let mintReceiptBrowserProviderSource: EthereumProvider | null = null;
let pathReadProvider: JsonRpcProvider | null = null;
let readThoughtNFT: Contract | null = null;
let readColorFontV1: Contract | null = null;
let readThoughtSpecRegistry: Contract | null = null;
let readPathNft: Contract | null = null;
let walletListenersBound = false;
let thoughtShellWalletSubscribed = false;
let thoughtShellWalletRefreshQueued = false;
let mintAuthorizationRequestId = 0;
let mintSheetPrimaryAction: MintSheetAction = "none";
let mintSheetSecondaryAction: MintSheetAction = "none";
let mintSheetTertiaryAction: MintSheetAction = "none";
let lastMintSheetFocusRefreshAt = 0;

type ThoughtAnalyticsEventType =
  | "wallet_connect_started"
  | "wallet_connect_succeeded"
  | "wallet_connect_failed"
  | "mint_started"
  | "mint_succeeded"
  | "mint_failed";

const trackThoughtAnalytics = (
  eventType: ThoughtAnalyticsEventType,
  metadata: Record<string, unknown>,
) => {
  trackInshellAnonymousAnalytics({
    eventType,
    contentType: "thought",
    metadata,
  });
};

const thoughtAnalyticsErrorCategory = (error: unknown) => {
  const message = String(
    (error as { shortMessage?: unknown; message?: unknown })?.shortMessage ??
      (error as Error)?.message ??
      error ??
      "",
  ).toLowerCase();
  const code = Number((error as { code?: unknown })?.code);
  if (
    code === 4001 ||
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancel")
  ) return "wallet_rejected";
  if (
    code === -32002 ||
    message.includes("already processing") ||
    message.includes("already pending")
  ) return "wallet_busy";
  if (message.includes("wallet did not expose") || message.includes("no supported wallet")) {
    return "wallet_missing";
  }
  if (message.includes("not submitted") || message.includes("timed out") || message.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("rpc") || message.includes("eth_sendrawtransaction")) return "rpc";
  if (message.includes("network") || message.includes("fetch")) return "network";
  return "unknown";
};

const cliEntries: CliEntry[] = [];
const cliCommandHistory: string[] = [];
let cliCommandInFlight = false;
let cliHistoryIndex: number | null = null;
let cliHistoryDraft = "";
let cliCompletionPrefix = "";
let cliCompletionMatches: string[] = [];
let cliCompletionIndex: number | null = null;
let cliProgressEntry: CliEntry | null = null;
let cliProgressBaseLines: string[] = [];
let cliProgressDetailLines: string[] = [];
let cliProgressTimer = 0;
let cliProgressTick = 0;
let activeRunId = 0;
let pendingMyBrainRunPayload: PendingMyBrainRound | null = null;
let localModelError = "";
let previewInFlight = false;
const previewAutoRateEvents: number[] = [];
const previewManualRateEvents: number[] = [];
const previewCache: Array<{
  key: string;
  preview: ContractWorkPreview;
  trace: ThoughtPreviewProviderTrace;
  createdAt: string;
}> = [];

const getDefaultSessionState = (): ThoughtSessionState => ({
  routeConfigured: false,
  mode: "connect",
  prompt: "",
  connect: {
    apiKey: "",
    model: OPENROUTER_DEFAULT_MODEL,
  },
  direct: {
    provider: "openai",
    apiKeys: {
      openai: "",
      openrouter: "",
      anthropic: "",
    },
    model: DIRECT_PROVIDERS.openai.defaultModel,
  },
  local: {
    available: null,
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    model: LOCAL_DEFAULT_MODEL,
  },
  codex: {
    model: CODEX_MODEL,
  },
});

const defaultModelForSource = (sourceId: ModelSourceId) => {
  if (sourceId === LOCAL_MODEL_SOURCE_ID) {
    return LOCAL_DEFAULT_MODEL;
  }

  if (sourceId === MY_BRAIN_MODEL_SOURCE_ID) {
    return MY_BRAIN_MODEL;
  }

  if (sourceId === CODEX_MODEL_SOURCE_ID) {
    return CODEX_MODEL;
  }

  return DIRECT_PROVIDERS[sourceId].defaultModel;
};

const normalizeModeInput = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized === "mybrain" || normalized === "my-brain") {
    return MY_BRAIN_MODE;
  }
  if (normalized === "bridge" || normalized === "agent" || normalized === CODEX_MODE) {
    return CODEX_MODE;
  }
  return normalized;
};

const isMode = (value: unknown): value is Mode =>
  value === "connect" ||
  value === "direct" ||
  value === "local" ||
  value === MY_BRAIN_MODE ||
  value === CODEX_MODE;

const parseModeInput = (value: string): Mode | null => {
  const normalized = normalizeModeInput(value);
  return isMode(normalized) ? normalized : null;
};

const isDirectProviderId = (value: unknown): value is DirectProviderId =>
  value === "openai" || value === "openrouter" || value === "anthropic";

const isPreviewStatusValue = (value: unknown): value is PreviewStatus =>
  value === "not_attempted" || value === "unavailable" || value === "failed" || value === "accepted";

const isThoughtRunProviderValue = (value: unknown): value is ThoughtRunProvider =>
  value === "openrouter" ||
  value === "openai" ||
  value === "anthropic" ||
  value === "ollama" ||
  value === "me" ||
  value === CODEX_PROVIDER;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const readPendingThoughtAgentRun = (): PendingThoughtAgentRun | null => {
  const raw = readSharedBrowserItem(THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.payload)) {
      throw new Error("stored pending THOUGHT Agent run is invalid.");
    }

    const runId = stringOrNull(parsed.runId);
    const statusUrl = stringOrNull(parsed.statusUrl);
    const browserToken = stringOrNull(parsed.browserToken);
    const createdAt = stringOrNull(parsed.createdAt);
    if (!runId || !statusUrl || !browserToken || !createdAt) {
      throw new Error("stored pending THOUGHT Agent run is incomplete.");
    }

    const createdAtMs = Date.parse(createdAt);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > THOUGHT_AGENT_POLL_TIMEOUT_MS + 60000) {
      throw new Error("stored pending THOUGHT Agent run expired.");
    }

    return {
      runId,
      statusUrl,
      browserToken,
      payload: parsed.payload as ThoughtRunPayload,
      createdAt,
    };
  } catch {
    removeSharedBrowserItem(THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY);
    return null;
  }
};

const writePendingThoughtAgentRun = (run: PendingThoughtAgentRun) => {
  try {
    writeSharedBrowserItem(THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY, JSON.stringify(run));
  } catch {
    // If storage is unavailable, the active in-memory run can still complete.
  }
};

const clearPendingThoughtAgentRun = (runId?: string) => {
  if (runId) {
    const pending = readPendingThoughtAgentRun();
    if (pending && pending.runId !== runId) {
      return;
    }
  }
  removeSharedBrowserItem(THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY);
};

const isRouteConfigured = () => sessionState.routeConfigured;

const routeRequiredLines = () => [
  "config route not selected.",
  "use: config route <local|connect|direct|my-brain|codex>",
];

function normalizeOllamaEndpoint(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("endpoint empty.");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("endpoint must start with http:// or https://");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/api\/(?:tags|generate)\/?$/i, "").replace(/\/+$/g, "");
  return url.toString().replace(/\/+$/g, "");
}

const safeNormalizeOllamaEndpoint = (value: string | undefined, fallback = DEFAULT_OLLAMA_ENDPOINT) => {
  try {
    return normalizeOllamaEndpoint(value ?? "");
  } catch {
    return fallback;
  }
};

const getOllamaEndpoint = () =>
  safeNormalizeOllamaEndpoint(sessionState.local.endpoint);

const buildOllamaApiUrl = (path: "tags" | "generate") =>
  `${getOllamaEndpoint()}/api/${path}`;

const ollamaAllowedOrigin = () => window.location.origin;

const ollamaCorsSetupCommand = () => `OLLAMA_ORIGINS=${ollamaAllowedOrigin()} ollama serve`;

const ollamaOriginBlockedMessage = () =>
  `ollama is running but blocked this browser origin. restart ollama with: ${ollamaCorsSetupCommand()}`;

const serializeSessionState = (state: ThoughtSessionState): StoredThoughtSessionState => ({
  version: 1,
  routeConfigured: state.routeConfigured,
  mode: state.mode,
  prompt: state.prompt,
  connect: {
    model: state.connect.model,
  },
  direct: {
    provider: state.direct.provider,
    model: state.direct.model,
  },
  local: {
    endpoint: safeNormalizeOllamaEndpoint(state.local.endpoint),
    model: state.local.model,
  },
  codex: {
    model: state.codex.model,
  },
});

const mergeStoredSessionState = (
  stored: Record<string, unknown>,
  fallback: ThoughtSessionState,
): ThoughtSessionState => {
  const restored = fallback;

  if (typeof stored.routeConfigured === "boolean") {
    restored.routeConfigured = stored.routeConfigured;
  }

  if (isMode(stored.mode)) {
    restored.mode = stored.mode;
  }

  const prompt = stringOrNull(stored.prompt);
  if (prompt !== null) {
    restored.prompt = prompt;
  }

  const connect = isRecord(stored.connect) ? stored.connect : null;
  const connectModel = stringOrNull(connect?.model);
  if (connectModel) {
    restored.connect.model = connectModel;
  }

  const direct = isRecord(stored.direct) ? stored.direct : null;
  if (isDirectProviderId(direct?.provider)) {
    restored.direct.provider = direct.provider;
    restored.direct.model = DIRECT_PROVIDERS[direct.provider].defaultModel;
  }
  const directModel = stringOrNull(direct?.model);
  if (directModel) {
    restored.direct.model = directModel;
  }

  const local = isRecord(stored.local) ? stored.local : null;
  const localEndpoint = stringOrNull(local?.endpoint);
  if (localEndpoint) {
    restored.local.endpoint = safeNormalizeOllamaEndpoint(localEndpoint);
  }
  const localModel = stringOrNull(local?.model);
  if (localModel) {
    restored.local.model = localModel;
  }

  const codex = isRecord(stored.codex) ? stored.codex : null;
  const codexModel = stringOrNull(codex?.model);
  if (codexModel) {
    restored.codex.model = codexModel;
  }

  // Secrets are intentionally never hydrated from browser storage.
  restored.connect.apiKey = "";
  restored.direct.apiKeys = {
    openai: "",
    openrouter: "",
    anthropic: "",
  };
  restored.local.available = null;

  return restored;
};

const readSessionState = (): ThoughtSessionState => {
  const fallback = getDefaultSessionState();
  const raw = readSharedBrowserItem(THOUGHT_SESSION_STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("stored THOUGHT session state is not an object.");
    }
    return mergeStoredSessionState(parsed, fallback);
  } catch {
    removeSharedBrowserItem(THOUGHT_SESSION_STORAGE_KEY);
    return fallback;
  }
};

let sessionState = readSessionState();

const writeSessionState = () => {
  try {
    writeSharedBrowserItem(
      THOUGHT_SESSION_STORAGE_KEY,
      JSON.stringify(serializeSessionState(sessionState)),
    );
  } catch {
    // Browsers can deny storage or run out of quota. THOUGHT still works with memory state.
  }
};
writeSessionState();

const readThoughtInstructionsOverride = (): ThoughtInstructionsOverride | null => {
  if (!ENABLE_THOUGHT_UPLOAD) {
    sessionStorage.removeItem(THOUGHT_INSTRUCTIONS_OVERRIDE_KEY);
    return null;
  }

  const raw = sessionStorage.getItem(THOUGHT_INSTRUCTIONS_OVERRIDE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ThoughtInstructionsOverride>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const content = typeof parsed.content === "string" ? parsed.content : "";

    if (!name || !content.trim()) {
      return null;
    }

    return { name, content };
  } catch {
    return null;
  }
};

let thoughtInstructionsOverride = readThoughtInstructionsOverride();

const writeThoughtInstructionsOverride = () => {
  if (!ENABLE_THOUGHT_UPLOAD) {
    sessionStorage.removeItem(THOUGHT_INSTRUCTIONS_OVERRIDE_KEY);
    return;
  }

  if (thoughtInstructionsOverride) {
    sessionStorage.setItem(
      THOUGHT_INSTRUCTIONS_OVERRIDE_KEY,
      JSON.stringify(thoughtInstructionsOverride),
    );
  } else {
    sessionStorage.removeItem(THOUGHT_INSTRUCTIONS_OVERRIDE_KEY);
  }
};

const getActiveThoughtInstructions = () =>
  activeThoughtSpec?.text ?? thoughtInstructionsOverride?.content ?? thoughtInstructions;

const getActiveThoughtInstructionsLabel = () => {
  if (activeThoughtSpec) {
    return `${activeThoughtSpec.ref} from chain`;
  }
  return THOUGHT_SPEC_REGISTRY_ADDRESS
    ? "on-chain THOUGHT.md"
    : (thoughtInstructionsOverride?.name ?? "bundled THOUGHT.md");
};

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

const isOpenRouterConnectSupported = () => {
  if (isLoopbackHost(window.location.hostname)) {
    return true;
  }

  if (window.location.protocol !== "https:") {
    return false;
  }

  const port = window.location.port;
  return port === "" || port === "443" || port === "3000";
};

const getOpenRouterConnectConstraintMessage = () =>
  "openrouter connect needs localhost or https on port 443 or 3000. use config direct on LAN http.";

const revokeThoughtInstructionsObjectUrl = () => {
  if (thoughtInstructionsObjectUrl) {
    URL.revokeObjectURL(thoughtInstructionsObjectUrl);
    thoughtInstructionsObjectUrl = null;
  }
};

const syncThoughtInstructionsLink = () => {
  revokeThoughtInstructionsObjectUrl();

  if (activeThoughtSpec) {
    thoughtInstructionsObjectUrl = URL.createObjectURL(
      new Blob([activeThoughtSpec.text], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    thoughtInstructionsLink.href = thoughtInstructionsObjectUrl;
    thoughtInstructionsLink.download = "THOUGHT.md";
    thoughtInstructionsLink.title = `Open ${activeThoughtSpec.ref} from chain`;
    return;
  }

  if (thoughtInstructionsOverride) {
    thoughtInstructionsObjectUrl = URL.createObjectURL(
      new Blob([thoughtInstructionsOverride.content], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    thoughtInstructionsLink.href = thoughtInstructionsObjectUrl;
    thoughtInstructionsLink.download = thoughtInstructionsOverride.name || "THOUGHT.md";
    thoughtInstructionsLink.title = `Open ${thoughtInstructionsOverride.name || "THOUGHT.md"}`;
    return;
  }

  thoughtInstructionsLink.href = thoughtInstructionsUrl;
  thoughtInstructionsLink.download = "";
  thoughtInstructionsLink.title = "Open bundled THOUGHT.md";
};

const getInjectedProviders = () => {
  const injected = (window as Window & { ethereum?: EthereumProvider }).ethereum;

  if (!injected) {
    return [];
  }

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.filter(Boolean);
  }

  return [injected];
};

const getEthereumProvider = () => {
  const sharedWallet = getThoughtShellWallet();
  if (sharedWallet.ready) {
    return sharedWallet.provider as EthereumProvider | null;
  }
  const providers = getInjectedProviders();
  return providers.find((provider) => provider.isMetaMask) ?? providers[0] ?? null;
};

const extractPrimaryAccount = (accounts: unknown) =>
  Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";

const waitForWalletAddress = async (ethereum: EthereumProvider, timeoutMs = 18000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const account = extractPrimaryAccount(await ethereum.request({ method: "eth_accounts" }));
      if (account) {
        return account;
      }
    } catch {
      // Keep polling while the wallet prompt is open.
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 250);
    });
  }

  return "";
};

const getReadProvider = () => {
  if (!THOUGHT_RPC_URL) {
    return null;
  }

  if (!readProvider) {
    readProvider = createSingleRequestJsonRpcProvider(THOUGHT_RPC_URL, THOUGHT_CHAIN_ID);
  }

  return readProvider;
};

const getWalletMintReceiptProvider = () => {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    mintReceiptBrowserProvider = null;
    mintReceiptBrowserProviderSource = null;
    return null;
  }
  if (!mintReceiptBrowserProvider || mintReceiptBrowserProviderSource !== ethereum) {
    mintReceiptBrowserProvider = new BrowserProvider(ethereum);
    mintReceiptBrowserProviderSource = ethereum;
  }
  return mintReceiptBrowserProvider;
};

const getMintReceiptMonitoringProviders = () => {
  const read = getReadProvider();
  const wallet = getWalletMintReceiptProvider();
  return read && wallet
    ? [read, wallet]
    : [read ?? wallet].filter(Boolean) as Array<JsonRpcProvider | BrowserProvider>;
};

const getPathReadProvider = () => {
  if (!PATH_RPC_URL) {
    return null;
  }

  if (!pathReadProvider) {
    pathReadProvider = createSingleRequestJsonRpcProvider(PATH_RPC_URL, THOUGHT_CHAIN_ID);
  }

  return pathReadProvider;
};

const getReadThoughtNFT = () => {
  const provider = getReadProvider();
  if (!provider || !THOUGHT_NFT_ADDRESS) {
    return null;
  }

  if (!readThoughtNFT) {
    readThoughtNFT = new Contract(THOUGHT_NFT_ADDRESS, THOUGHT_NFT_ABI, provider);
  }

  return readThoughtNFT;
};

const getReadColorFontV1 = () => {
  const provider = getReadProvider();
  if (!provider || !COLOR_FONT_V1_ADDRESS) {
    return null;
  }

  if (!readColorFontV1) {
    readColorFontV1 = new Contract(COLOR_FONT_V1_ADDRESS, COLOR_FONT_V1_ABI, provider);
  }

  return readColorFontV1;
};

const getReadThoughtSpecRegistry = () => {
  const provider = getReadProvider();
  if (!provider || !THOUGHT_SPEC_REGISTRY_ADDRESS) {
    return null;
  }

  if (!readThoughtSpecRegistry) {
    readThoughtSpecRegistry = new Contract(
      THOUGHT_SPEC_REGISTRY_ADDRESS,
      THOUGHT_SPEC_REGISTRY_ABI,
      provider,
    );
  }

  return readThoughtSpecRegistry;
};

const getReadPathNft = () => {
  const provider = getPathReadProvider();
  if (!provider || !PATH_NFT_ADDRESS) {
    return null;
  }

  if (!readPathNft) {
    readPathNft = new Contract(PATH_NFT_ADDRESS, PATH_NFT_ABI, provider);
  }

  return readPathNft;
};

let localThoughtV2DeploymentPromise: Promise<void> | null = null;

const verifyLocalThoughtV2Deployment = async () => {
  if (!IS_LOCAL_THOUGHT_V2) {
    return;
  }
  if (localThoughtV2DeploymentPromise) {
    return localThoughtV2DeploymentPromise;
  }

  localThoughtV2DeploymentPromise = (async () => {
    const provider = getReadProvider();
    const pathProvider = getPathReadProvider();
    const thought = getReadThoughtNFT();
    const pathNft = getReadPathNft();
    const registry = getReadThoughtSpecRegistry();
    if (!provider || !pathProvider || !thought || !pathNft || !registry) {
      throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY);
    }

    const expected = THOUGHT_V2_LOCAL_RELEASE;
    const contractAddresses = [
      expected.contracts.pathNft,
      expected.contracts.thoughtNft,
      expected.contracts.thoughtSpecRegistry,
      expected.contracts.thoughtRenderer,
      expected.contracts.protocolRegistry,
    ];
    const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
    await verifyThoughtV2LocalDeployment({
      contractAddresses,
      readCode: (address) => sameAddress(address, expected.contracts.pathNft)
        ? pathProvider.getCode(address)
        : provider.getCode(address),
      readAnchors: async () => {
        const [
          pathAddress,
          specRegistryAddress,
          rendererAddress,
          protocolRegistryAddress,
          releaseId,
          manifestHash,
          rendererProfileHash,
          workProfileHash,
          authorizedMinter,
          quota,
          frozen,
          specValid,
        ] = await Promise.all([
          thought.pathNft() as Promise<string>,
          thought.thoughtSpecRegistry() as Promise<string>,
          thought.thoughtRenderer() as Promise<string>,
          thought.protocolRegistry() as Promise<string>,
          thought.protocolReleaseId() as Promise<string>,
          thought.protocolManifestHash() as Promise<string>,
          thought.RENDERER_PROFILE_KECCAK256() as Promise<string>,
          thought.WORK_PROFILE_KECCAK256() as Promise<string>,
          pathNft.getAuthorizedMinter(PATH_MOVEMENT_THOUGHT) as Promise<string>,
          pathNft.getMovementQuota(PATH_MOVEMENT_THOUGHT) as Promise<bigint>,
          pathNft.isMovementFrozen(PATH_MOVEMENT_THOUGHT) as Promise<boolean>,
          registry.isRegisteredThoughtSpec(expected.spec.evmSpecId, expected.spec.evmSpecHash) as Promise<boolean>,
        ]);
        return {
          pathAddress,
          specRegistryAddress,
          rendererAddress,
          protocolRegistryAddress,
          releaseId,
          manifestHash,
          rendererProfileHash,
          workProfileHash,
          authorizedMinter,
          quota,
          frozen,
          specValid,
        };
      },
      anchorsMatch: ({
        pathAddress,
        specRegistryAddress,
        rendererAddress,
        protocolRegistryAddress,
        releaseId,
        manifestHash,
        rendererProfileHash,
        workProfileHash,
        authorizedMinter,
        quota,
        frozen,
        specValid,
      }) =>
        sameAddress(pathAddress, expected.contracts.pathNft) &&
        sameAddress(specRegistryAddress, expected.contracts.thoughtSpecRegistry) &&
        sameAddress(rendererAddress, expected.contracts.thoughtRenderer) &&
        sameAddress(protocolRegistryAddress, expected.contracts.protocolRegistry) &&
        releaseId.toLowerCase() === expected.protocol.protocolReleaseId &&
        manifestHash.toLowerCase() === expected.protocol.manifestKeccak256 &&
        rendererProfileHash.toLowerCase() === expected.protocol.rendererProfile.keccak256 &&
        workProfileHash.toLowerCase() === expected.protocol.workProfile.keccak256 &&
        sameAddress(authorizedMinter, expected.contracts.thoughtNft) &&
        quota === 1n &&
        frozen &&
        specValid,
    });
  })().finally(() => {
    localThoughtV2DeploymentPromise = null;
  });

  return localThoughtV2DeploymentPromise;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const byteLength = (value: string) => new TextEncoder().encode(value).length;

const formatProvenanceBytes = (bytes: number) => `provenance: ${bytes} bytes`;

const provenanceTooLargeLines = (bytes: number, scope: "mint" | "work" = "mint") => [
  `${scope} blocked.`,
  "provenance too large.",
  `${bytes} / ${MAX_PROVENANCE_BYTES} bytes.`,
  "",
  `prompt: ${byteLength(currentRunContext?.prompt ?? sessionState.prompt)} bytes`,
  `model return: ${byteLength(currentRunContext?.returnedText ?? "")} bytes`,
  "",
  "shorten prompt or run again.",
];

const provenanceTooLargeMessage = (bytes: number) => provenanceTooLargeLines(bytes).join(" ");

const provenanceTooLargeLinesFromMessage = (message: string) => {
  const match = message.match(/(\d+)\s*\/\s*\d+\s*bytes/);
  return match ? provenanceTooLargeLines(Number(match[1])) : [message];
};

const hashText = (value: string) => keccak256(toUtf8Bytes(value));

type ThoughtV2PreviewValidation = {
  ok: boolean;
  agentLine: string;
  promptLine: string;
  reasonCode: number;
  byteLimit?: ThoughtByteLimitUsage;
  issue?: ThoughtTextPolicyIssue;
};

const deriveThoughtV2VisibleLine = (value: string): string => value;

const thoughtV2ReasonCode = (kind: ThoughtV2LineKind, errors: string[]) => {
  if (errors.some((error) => error === `${kind} line is empty`)) {
    return 1;
  }
  if (errors.some((error) => /bytes/.test(error))) {
    return 3;
  }
  return 4;
};

const prevalidateThoughtV2Preview = (input: {
  rawPrompt: string;
  rawReturn: string;
}): ThoughtV2PreviewValidation => {
  const promptLine = deriveThoughtV2VisibleLine(input.rawPrompt);
  const agentLine = deriveThoughtV2VisibleLine(input.rawReturn);

  if (byteLength(input.rawReturn) > MAX_RAW_RETURN_BYTES) {
    return {
      ok: false,
      agentLine,
      promptLine,
      reasonCode: 2,
      byteLimit: {
        line: "model return",
        usedBytes: byteLength(input.rawReturn),
        maxBytes: MAX_RAW_RETURN_BYTES,
      },
    };
  }

  const promptMeasure = measureThoughtV2Line(promptLine, "prompt");
  if (promptMeasure.errors.length > 0) {
    const issue = describeThoughtTextPolicyIssue({
      value: promptLine,
      line: "prompt",
      measure: promptMeasure,
      maxBytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.promptMaxBytes,
    });
    return {
      ok: false,
      agentLine,
      promptLine,
      reasonCode: thoughtV2ReasonCode("prompt", promptMeasure.errors),
      ...(issue ? { issue } : {}),
      ...(promptMeasure.errors.some((error) => /bytes/.test(error))
        ? {
            byteLimit: {
              line: "prompt" as const,
              usedBytes: promptMeasure.byteLength,
              maxBytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.promptMaxBytes,
            },
          }
        : {}),
    };
  }

  const agentMeasure = measureThoughtV2Line(agentLine, "agent");
  if (agentMeasure.errors.length > 0) {
    const issue = describeThoughtTextPolicyIssue({
      value: agentLine,
      line: "agent output",
      measure: agentMeasure,
      maxBytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes,
    });
    return {
      ok: false,
      agentLine,
      promptLine,
      reasonCode: thoughtV2ReasonCode("agent", agentMeasure.errors),
      ...(issue ? { issue } : {}),
      ...(agentMeasure.errors.some((error) => /bytes/.test(error))
        ? {
            byteLimit: {
              line: "agent output" as const,
              usedBytes: agentMeasure.byteLength,
              maxBytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes,
            },
          }
        : {}),
    };
  }

  return { ok: true, agentLine, promptLine, reasonCode: 0 };
};

type ContractWorkPreview = {
  ok: boolean;
  text: string;
  svg: string;
  reasonCode: number;
  byteLimit?: ThoughtByteLimitUsage;
  issue?: ThoughtTextPolicyIssue;
};

type LastRejectedRun = {
  kind: "rejected-run";
  reasonCode: number;
  reasonLabel: string;
  prompt: string;
  modelReturn: string;
  normalizedCandidate?: string;
  normalizedLength?: number;
  maxTextLength: typeof MAX_TEXT_BYTES;
  route: Mode;
  provider: ThoughtRunProvider;
  model: string;
  thoughtSpecRef: string;
  createdAt: string;
  repeatedCount: number;
  byteLimit?: ThoughtByteLimitUsage;
  issue?: ThoughtTextPolicyIssue;
};

type LastPreviewRetryContext = {
  payload: ThoughtRunPayload;
  modelReturn: string;
};

type ContractWorkPreviewError = Error & {
  previewReasonCode?: number;
  byteLimit?: ThoughtByteLimitUsage;
  issue?: ThoughtTextPolicyIssue;
  cliLines?: string[];
  kind?: "model-return-rejected" | "contract-preview-unavailable";
};

const previewWorkReasonLabel = previewRejectionReasonLabel;

let lastRejectedRun: LastRejectedRun | null = null;
let lastPreviewRetryContext: LastPreviewRetryContext | null = null;

const sameRejectedRunContext = (
  previous: LastRejectedRun,
  payload: ThoughtRunPayload,
  reasonCode: number,
) =>
  previous.prompt === payload.input.promptLine &&
  previous.route === payload.config.route &&
  previous.provider === payload.config.provider &&
  previous.model === payload.config.model &&
  previous.reasonCode === reasonCode;

const rememberRejectedRun = (
  payload: ThoughtRunPayload,
  preview: ContractWorkPreview,
  modelReturn: string,
): LastRejectedRun => {
  const repeatedCount =
    lastRejectedRun && sameRejectedRunContext(lastRejectedRun, payload, preview.reasonCode)
      ? lastRejectedRun.repeatedCount + 1
      : 1;
  const normalizedCandidate = preview.text || undefined;
  const rejectedRun: LastRejectedRun = {
    kind: "rejected-run",
    reasonCode: preview.reasonCode,
    reasonLabel: previewWorkReasonLabel(preview.reasonCode),
    prompt: payload.input.promptLine,
    modelReturn,
    normalizedCandidate,
    normalizedLength: normalizedCandidate ? normalizedCandidate.length : undefined,
    maxTextLength: MAX_TEXT_BYTES,
    route: payload.config.route,
    provider: payload.config.provider,
    model: payload.config.model,
    thoughtSpecRef: payload.input.thoughtSpec.ref,
    createdAt: new Date().toISOString(),
    repeatedCount,
    ...(preview.byteLimit ? { byteLimit: preview.byteLimit } : {}),
    ...(preview.issue ? { issue: preview.issue } : {}),
  };
  lastRejectedRun = rejectedRun;
  return rejectedRun;
};

const rejectedRunReasonLines = (rejected: LastRejectedRun) => {
  if (rejected.issue) {
    return [rejected.issue.detail, "", `next: ${rejected.issue.nextStep}`];
  }
  if (rejected.reasonCode === 1) {
    return ["canonical text is empty after normalization."];
  }
  if (rejected.reasonCode === 2) {
    return [
      "raw model return too large to process.",
      rejected.byteLimit
        ? formatThoughtByteLimitUsage(rejected.byteLimit)
        : `model return: ${byteLength(rejected.modelReturn)} / ${MAX_RAW_RETURN_BYTES} UTF-8 bytes`,
      "",
      "this model ignored the output rules.",
    ];
  }
  if (rejected.reasonCode === 3) {
    return [
      rejected.byteLimit
        ? formatThoughtByteLimitUsage(rejected.byteLimit)
        : `Agent output: ${byteLength(rejected.normalizedCandidate ?? rejected.modelReturn)} / ${THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes} UTF-8 bytes`,
      "",
      "this Agent returned more bytes than THOUGHT V2 accepts.",
    ];
  }
  if (rejected.reasonCode === 4) {
    return ["unsupported characters in model return.", "letters and spaces only."];
  }
  if (rejected.reasonCode === 5) {
    return ["text is not canonical."];
  }
  if (rejected.reasonCode === 6) {
    return ["multi-line model return.", "return one THOUGHT line only."];
  }
  return ["model return did not fit THOUGHT rules."];
};

const rejectedRunCliLines = (rejected: LastRejectedRun, previousWorkId: number | null) => {
  const lines = [
    "model return rejected.",
    ...rejectedRunReasonLines(rejected),
    "",
    previousWorkId ? "no new work created." : "no work created.",
    ...(previousWorkId ? [`current work remains #${previousWorkId}.`] : []),
  ];

  if (rejected.repeatedCount >= 2) {
    lines.push(
      "",
      "same rejection repeated.",
      "this model may not follow THOUGHT output rules.",
      "try another model or use my-brain.",
    );
  }

  lines.push(
    "",
    "use: prompt <text>",
    "use: config",
    "use: config my-brain",
  );

  return lines;
};

const createRejectedRunError = (
  rejected: LastRejectedRun,
  previousWorkId: number | null,
) => {
  const lines = rejectedRunCliLines(rejected, previousWorkId);
  const error = new Error(lines.join(" ")) as ContractWorkPreviewError;
  error.kind = "model-return-rejected";
  error.previewReasonCode = rejected.reasonCode;
  if (rejected.byteLimit) {
    error.byteLimit = rejected.byteLimit;
  }
  if (rejected.issue) {
    error.issue = rejected.issue;
  }
  error.cliLines = lines;
  return error;
};

const isContractWorkPreviewError = (error: unknown): error is ContractWorkPreviewError =>
  error instanceof Error && Array.isArray((error as ContractWorkPreviewError).cliLines);

const readPreviewMode = () => normalizePreviewMode(sessionStorage.getItem(THOUGHT_PREVIEW_MODE_STORAGE_KEY));

const writePreviewMode = (mode: PreviewMode) => {
  sessionStorage.setItem(THOUGHT_PREVIEW_MODE_STORAGE_KEY, mode);
};

const previewWorkViaAllowedProvider = async (
  token: Contract,
  rawReturn: string,
  prompt = sessionState.prompt,
): Promise<ContractWorkPreview> => {
  if (IS_LOCAL_THOUGHT_V2) {
    const validation = prevalidateThoughtV2Preview({
      rawPrompt: prompt,
      rawReturn,
    });
    if (!validation.ok) {
      return {
        ok: false,
        text: validation.agentLine,
        svg: "",
        reasonCode: validation.reasonCode,
        ...(validation.byteLimit ? { byteLimit: validation.byteLimit } : {}),
        ...(validation.issue ? { issue: validation.issue } : {}),
      };
    }
    const svg = await token.previewSvg(validation.promptLine, validation.agentLine) as string;
    return {
      ok: true,
      text: validation.agentLine,
      svg,
      reasonCode: 0,
    };
  }
  const [ok, text, svg, reasonCode] = await token.previewWork(rawReturn) as [
    boolean,
    string,
    string,
    bigint | number,
  ];

  return {
    ok: Boolean(ok),
    text: String(text),
    svg: String(svg),
    reasonCode: Number(reasonCode),
  };
};

const createThoughtPreviewProvider = (
  kind: Exclude<PreviewProviderKind, "none">,
  provider: BrowserProvider | JsonRpcProvider,
  chainId: number,
  endpointLabel?: string,
): ThoughtPreviewProvider => {
  const token = new Contract(THOUGHT_NFT_ADDRESS, THOUGHT_NFT_ABI, provider);
  return {
    kind,
    chainId,
    endpointLabel,
    preview: (rawReturn: string, context?: { prompt?: string }) =>
      previewWorkViaAllowedProvider(token, rawReturn, context?.prompt),
    trace: () => ({
      kind,
      chainId,
      endpointLabel,
      contractAddress: THOUGHT_NFT_ADDRESS,
      method: IS_LOCAL_THOUGHT_V2 ? "previewSvg" : "previewWork",
      fetchedAt: new Date().toISOString(),
    }),
  };
};

const createFrontendPreviewProvider = (): ThoughtPreviewProvider => ({
  kind: "frontend-renderer",
  chainId: THOUGHT_CHAIN_ID,
  endpointLabel: "browser",
  preview: async (rawReturn: string, context?: { prompt?: string }) => {
    const validation = prevalidateThoughtV2Preview({
      rawPrompt: context?.prompt ?? sessionState.prompt,
      rawReturn,
    });

    if (!validation.ok) {
      return {
        ok: false,
        text: validation.agentLine,
        svg: "",
        reasonCode: validation.reasonCode,
        ...(validation.byteLimit ? { byteLimit: validation.byteLimit } : {}),
        ...(validation.issue ? { issue: validation.issue } : {}),
      };
    }

    return {
      ok: true,
      text: validation.agentLine,
      svg: buildThoughtV2Svg({
        agentLine: validation.agentLine,
        promptLine: validation.promptLine,
      }),
      reasonCode: 0,
    };
  },
  trace: () => ({
    kind: "frontend-renderer",
    chainId: THOUGHT_CHAIN_ID,
    endpointLabel: "browser",
    method: "frontendRender",
    fetchedAt: new Date().toISOString(),
  }),
});

const createWalletPreviewProvider = (): ThoughtPreviewProvider | null => {
  if (!THOUGHT_NFT_ADDRESS || !walletState.address || walletState.chainId !== THOUGHT_CHAIN_ID) {
    return null;
  }

  const ethereum = getEthereumProvider();
  if (!ethereum) {
    return null;
  }

  return createThoughtPreviewProvider("wallet", new BrowserProvider(ethereum), THOUGHT_CHAIN_ID);
};

const walletPreviewUnavailableReason = () => {
  if (!walletState.address) {
    return "wallet not connected.";
  }
  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    return `wallet on wrong network. ${PUBLIC_NETWORK_CONFIG.switchNetworkNotice}`;
  }
  if (!getEthereumProvider()) {
    return "wallet provider unavailable.";
  }
  if (!THOUGHT_NFT_ADDRESS) {
    return "ThoughtNFT address unavailable.";
  }
  return "wallet preview unavailable.";
};

const selectThoughtPreviewProvider = async () => {
  const mode = readPreviewMode();
  if (mode === "off") {
    return { provider: null, reason: "preview is off." };
  }
  if (THOUGHT_AGENT_FIXTURE_MODE) {
    return { provider: createFrontendPreviewProvider(), reason: "" };
  }
  if (IS_LOCAL_THOUGHT_V2) {
    const provider = getReadProvider();
    return provider
      ? {
          provider: createThoughtPreviewProvider(
            "preview-endpoint",
            provider,
            THOUGHT_CHAIN_ID,
            THOUGHT_RPC_URL,
          ),
          reason: "",
        }
      : { provider: null, reason: "local THOUGHT V2 unavailable." };
  }
  // V2 is source-only: pre-mint previews must use the verified shared renderer.
  return { provider: createFrontendPreviewProvider(), reason: "" };
};

const prunePreviewRateEvents = (events: number[], now: number) => {
  while (events.length && now - events[0]! > 60 * 60 * 1000) {
    events.shift();
  }
};

const reservePreviewRateSlot = (manual: boolean) => {
  const events = manual ? previewManualRateEvents : previewAutoRateEvents;
  const limit = manual ? THOUGHT_PREVIEW_MANUAL_RATE_LIMIT : THOUGHT_PREVIEW_AUTO_RATE_LIMIT;
  const now = Date.now();
  prunePreviewRateEvents(events, now);
  const lastMinute = events.filter((eventAt) => now - eventAt <= 60 * 1000).length;
  if (lastMinute >= limit.minute || events.length >= limit.hour) {
    return false;
  }

  events.push(now);
  return true;
};

const previewUnavailableLines = (reason = "") =>
  previewUnavailableCliLines(readPreviewMode(), reason);

const previewRateLimitLines = () => [
  "preview rate limit reached.",
  "candidate saved. try again later or connect wallet/provider.",
  "",
  "use: preview retry",
];

const isThoughtCandidateValue = (value: unknown): value is ThoughtCandidate => {
  if (!isRecord(value)) {
    return false;
  }

  const specAnchor = isRecord(value.specAnchor) ? value.specAnchor : null;
  const payload = isRecord(value.payload) ? value.payload : null;

  return (
    typeof value.id === "string" &&
    typeof value.prompt === "string" &&
    typeof value.rawModelReturn === "string" &&
    isMode(value.route) &&
    isThoughtRunProviderValue(value.provider) &&
    typeof value.model === "string" &&
    Boolean(specAnchor) &&
    typeof specAnchor?.id === "string" &&
    typeof specAnchor?.ref === "string" &&
    typeof specAnchor?.hash === "string" &&
    typeof value.createdAt === "string" &&
    value.status === "candidate" &&
    isPreviewStatusValue(value.previewStatus) &&
    Boolean(payload) &&
    typeof value.rawReturnHash === "string" &&
    typeof value.automaticPreviewAttempted === "boolean"
  );
};

const writeCurrentCandidateSession = () => {
  try {
    if (!currentCandidate) {
      removeSharedBrowserItem(THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY);
      return;
    }

    writeSharedBrowserItem(
      THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        candidate: currentCandidate,
      }),
    );
  } catch {
    // Candidate restore is best-effort; a storage failure should not block a run.
  }
};

const clearCurrentCandidate = () => {
  currentCandidate = null;
  writeCurrentCandidateSession();
};

const readCurrentCandidateSession = (): ThoughtCandidate | null => {
  const raw = readSharedBrowserItem(THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate = isRecord(parsed) && "candidate" in parsed ? parsed.candidate : parsed;
    if (!isThoughtCandidateValue(candidate)) {
      throw new Error("stored THOUGHT candidate is invalid.");
    }
    return candidate;
  } catch {
    removeSharedBrowserItem(THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY);
    return null;
  }
};

const restoreCurrentCandidateSession = () => {
  currentCandidate = readCurrentCandidateSession();
  if (currentCandidate) {
    runState = currentCandidate.previewStatus === "failed" ? "run_failed" : "candidate_ready";
  }
};

const createThoughtCandidate = (
  payload: ThoughtRunPayload,
  rawModelReturn: string,
  agentEvidence?: ThoughtV2LocalAgentEvidence,
): ThoughtCandidate => {
  const validation = prevalidateThoughtV2Preview({
    rawPrompt: payload.input.promptLine,
    rawReturn: rawModelReturn,
  });
  const normalizedCandidate = validation.ok ? rawModelReturn : undefined;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    prompt: payload.input.promptLine,
    rawModelReturn,
    route: payload.config.route,
    provider: payload.config.provider,
    model: payload.config.model,
    specAnchor: {
      id: payload.input.thoughtSpec.id,
      ref: payload.input.thoughtSpec.ref,
      hash: payload.input.thoughtSpec.hash,
    },
    createdAt: new Date().toISOString(),
    status: "candidate",
    previewStatus: "not_attempted",
    payload,
    normalizedCandidate,
    rawReturnHash: hashText(rawModelReturn),
    normalizedCandidateHash: normalizedCandidate ? hashText(normalizedCandidate) : undefined,
    automaticPreviewAttempted: false,
    ...(agentEvidence ? { agentEvidence } : {}),
  };
};

const previewCacheKey = (candidate: ThoughtCandidate, providerKind: PreviewProviderKind) => [
  THOUGHT_CHAIN_ID,
  THOUGHT_NFT_ADDRESS.toLowerCase(),
  providerKind,
  candidate.specAnchor.id.toLowerCase(),
  candidate.specAnchor.hash.toLowerCase(),
  hashText(candidate.prompt).toLowerCase(),
  candidate.rawReturnHash.toLowerCase(),
  candidate.normalizedCandidateHash?.toLowerCase() ?? "",
].join(":");

const readPreviewCache = (key: string) => previewCache.find((record) => record.key === key) ?? null;

const writePreviewCache = (
  key: string,
  preview: ContractWorkPreview,
  trace: ThoughtPreviewProviderTrace,
) => {
  const existingIndex = previewCache.findIndex((record) => record.key === key);
  if (existingIndex >= 0) {
    previewCache.splice(existingIndex, 1);
  }
  previewCache.push({
    key,
    preview,
    trace,
    createdAt: new Date().toISOString(),
  });
  if (previewCache.length > THOUGHT_PREVIEW_CACHE_LIMIT) {
    previewCache.splice(0, previewCache.length - THOUGHT_PREVIEW_CACHE_LIMIT);
  }
};

const rejectCandidateFromPreview = (
  candidate: ThoughtCandidate,
  preview: ContractWorkPreview,
) => {
  candidate.previewStatus = "failed";
  candidate.previewError = previewWorkReasonLabel(preview.reasonCode);
  currentCandidate = candidate;
  writeCurrentCandidateSession();
  const rejected = rememberRejectedRun(candidate.payload, preview, candidate.rawModelReturn);
  return createRejectedRunError(rejected, currentWorkId);
};

const attemptContractPreviewForCandidate = async (
  candidate: ThoughtCandidate,
  options: { manual: boolean },
): Promise<ContractPreviewAttemptResult> => {
  const selection = await selectThoughtPreviewProvider();
  if (!selection.provider) {
    candidate.previewStatus = "unavailable";
    candidate.previewError = selection.reason;
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return { kind: "unavailable", lines: previewUnavailableLines(selection.reason) };
  }

  const frontendPreview = true;
  const validation = prevalidateThoughtV2Preview({
    rawPrompt: candidate.prompt,
    rawReturn: candidate.rawModelReturn,
  });
  candidate.normalizedCandidate = validation.agentLine;
  const previewReasonCode = validation.reasonCode;
  candidate.normalizedCandidateHash = candidate.normalizedCandidate
    ? hashText(candidate.normalizedCandidate)
    : undefined;
  currentCandidate = candidate;
  writeCurrentCandidateSession();

  if (!validation.ok) {
    const preview = {
      ok: false,
      text: candidate.normalizedCandidate ?? "",
      svg: "",
      reasonCode: previewReasonCode,
      ...(validation.byteLimit ? { byteLimit: validation.byteLimit } : {}),
      ...(validation.issue ? { issue: validation.issue } : {}),
    };
    return {
      kind: "rejected",
      error: rejectCandidateFromPreview(candidate, preview),
    };
  }

  if (!THOUGHT_NFT_ADDRESS && !frontendPreview) {
    candidate.previewStatus = "unavailable";
    candidate.previewError = "ThoughtNFT address unavailable.";
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return { kind: "unavailable", lines: previewUnavailableLines(candidate.previewError) };
  }

  if (!options.manual) {
    if (candidate.automaticPreviewAttempted) {
      candidate.previewStatus = "unavailable";
      candidate.previewError = "automatic preview already attempted.";
      currentCandidate = candidate;
      writeCurrentCandidateSession();
      return { kind: "unavailable", lines: previewUnavailableLines(candidate.previewError) };
    }
    candidate.automaticPreviewAttempted = true;
    writeCurrentCandidateSession();
  }

  const cacheKey = previewCacheKey(candidate, selection.provider.kind);
  const cached = readPreviewCache(cacheKey);
  if (cached) {
    candidate.previewProvider = cached.trace;
    if (!cached.preview.ok || !cached.preview.svg || !cached.preview.text) {
      return {
        kind: "rejected",
        error: rejectCandidateFromPreview(candidate, cached.preview),
      };
    }
    candidate.previewStatus = "accepted";
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return {
      kind: "accepted",
      preview: cached.preview,
      trace: cached.trace,
      fromCache: true,
    };
  }

  if (selection.provider.kind !== "frontend-renderer" && !reservePreviewRateSlot(options.manual)) {
    candidate.previewStatus = "unavailable";
    candidate.previewError = "preview rate limit reached.";
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return { kind: "unavailable", lines: previewRateLimitLines() };
  }

  if (previewInFlight) {
    candidate.previewStatus = "unavailable";
    candidate.previewError = "another preview is already running.";
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return { kind: "unavailable", lines: previewUnavailableLines(candidate.previewError) };
  }

  previewInFlight = true;
  try {
    const preview = await withTimeout(
      selection.provider.preview(candidate.rawModelReturn, { prompt: candidate.prompt }),
      THOUGHT_PREVIEW_TIMEOUT_MS,
      "preview timed out.",
    );
    const trace = selection.provider.trace();
    candidate.previewProvider = trace;
    writePreviewCache(cacheKey, preview, trace);

    if (!preview.ok || !preview.svg || !preview.text) {
      return {
        kind: "rejected",
        error: rejectCandidateFromPreview(candidate, preview),
      };
    }

    candidate.previewStatus = "accepted";
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return {
      kind: "accepted",
      preview,
      trace,
      fromCache: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "preview unavailable.";
    candidate.previewStatus = "unavailable";
    candidate.previewError = message;
    currentCandidate = candidate;
    writeCurrentCandidateSession();
    return { kind: "unavailable", lines: previewUnavailableLines(message) };
  } finally {
    previewInFlight = false;
  }
};

const textHashFromContract = async (canonicalText: string) => {
  if (IS_LOCAL_THOUGHT_V2) {
    return thoughtV2AgentLineHash(canonicalText);
  }
  const token = getReadThoughtNFT();
  if (!token) {
    return hashText(canonicalText);
  }

  try {
    return String(await token.textHashOf(canonicalText));
  } catch {
    return hashText(canonicalText);
  }
};

const getThoughtSpecCacheKey = (specId: string, specHash: string) =>
  `thought.spec.${THOUGHT_CHAIN_ID}.${THOUGHT_SPEC_REGISTRY_ADDRESS.toLowerCase()}.${specId.toLowerCase()}.${specHash.toLowerCase()}`;

const getThoughtSpecStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readCachedThoughtSpec = (meta: Omit<ActiveThoughtSpec, "text" | "fetchedAt">) => {
  try {
    const storage = getThoughtSpecStorage();
    if (!storage) {
      return null;
    }

    const cacheKey = getThoughtSpecCacheKey(meta.specId, meta.specHash);
    const raw = storage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ActiveThoughtSpec> & {
      chainId?: number;
      registry?: string;
    };
    const text = typeof parsed.text === "string" ? parsed.text : "";
    if (
      parsed.chainId !== THOUGHT_CHAIN_ID ||
      typeof parsed.registry !== "string" ||
      parsed.registry.toLowerCase() !== THOUGHT_SPEC_REGISTRY_ADDRESS.toLowerCase() ||
      parsed.specId?.toLowerCase() !== meta.specId.toLowerCase() ||
      parsed.specHash?.toLowerCase() !== meta.specHash.toLowerCase() ||
      byteLength(text) !== meta.byteLength ||
      hashText(text).toLowerCase() !== meta.specHash.toLowerCase()
    ) {
      storage.removeItem(cacheKey);
      return null;
    }

    return {
      ...meta,
      text,
      fetchedAt: parsed.fetchedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const writeCachedThoughtSpec = (spec: ActiveThoughtSpec) => {
  try {
    const storage = getThoughtSpecStorage();
    if (!storage) {
      return;
    }

    storage.setItem(
      getThoughtSpecCacheKey(spec.specId, spec.specHash),
      JSON.stringify({
        chainId: THOUGHT_CHAIN_ID,
        registry: THOUGHT_SPEC_REGISTRY_ADDRESS,
        specId: spec.specId,
        specHash: spec.specHash,
        ref: spec.ref,
        byteLength: spec.byteLength,
        text: spec.text,
        fetchedAt: spec.fetchedAt,
      }),
    );
  } catch {
    // Public immutable cache is best-effort.
  }
};

const revokeThoughtDetailSpecJsonUrl = () => {
  if (!thoughtDetailSpecJsonUrl) {
    return;
  }

  URL.revokeObjectURL(thoughtDetailSpecJsonUrl);
  thoughtDetailSpecJsonUrl = "";
};

const revokeThoughtDetailColorFontUrl = () => {
  if (!thoughtDetailColorFontUrl) {
    return;
  }

  URL.revokeObjectURL(thoughtDetailColorFontUrl);
  thoughtDetailColorFontUrl = "";
};

const revokeThoughtDetailProvenanceJsonUrl = () => {
  if (!thoughtDetailProvenanceJsonUrl) {
    return;
  }

  URL.revokeObjectURL(thoughtDetailProvenanceJsonUrl);
  thoughtDetailProvenanceJsonUrl = "";
};

const clearThoughtDetailColorFontFallback = () => {
  delete thoughtDetailColorFont.dataset.blobReady;
  thoughtDetailColorFont.href = "#";
  thoughtDetailColorFont.removeAttribute("target");
  thoughtDetailColorFont.removeAttribute("rel");
  thoughtDetailColorFontStatus.textContent = "";
};

const revokeColorFontPageRawUrl = () => {
  if (!colorFontPageRawUrl) {
    return;
  }

  URL.revokeObjectURL(colorFontPageRawUrl);
  colorFontPageRawUrl = "";
};

const setColorFontPageRawLink = (raw: string) => {
  revokeColorFontPageRawUrl();
  colorFontPageRawUrl = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
  colorFontOpenRaw.href = colorFontPageRawUrl;
  colorFontOpenRaw.target = "_blank";
  colorFontOpenRaw.rel = "noopener noreferrer";
};

const renderColorFontPage = (input: {
  source: string;
  id: string;
  version: string;
  chain: string;
  contract: string;
  hash: string;
  data: string;
  status: string;
}) => {
  colorFontSource.textContent = input.source;
  colorFontId.textContent = input.id;
  colorFontVersion.textContent = input.version;
  colorFontChain.textContent = input.chain;
  colorFontContract.textContent = input.contract;
  colorFontHash.textContent = input.hash;
  colorFontRawBlock.textContent = input.data;
  colorFontStatus.textContent = input.status;
  setColorFontPageRawLink(input.data);
};

const loadColorFontPage = async () => {
  colorFontStatus.textContent = "loading color font...";
  colorFontRawBlock.textContent = "loading color font...";

  try {
    const doc = await fetchColorFontDoc();
    renderColorFontPage({
      source: "on-chain ABI",
      id: doc.id,
      version: doc.version,
      chain: doc.chainName ? `${doc.chainName} (${doc.chainId})` : doc.chainId.toString(),
      contract: doc.contractAddress,
      hash: doc.hash,
      data: doc.data,
      status: COLOR_FONT_V1_ADDRESS ? "source: ColorFontV1.data()" : "source: ThoughtNFT.colorFontData()",
    });
  } catch {
    const fallbackText = colorFontText.trim();
    renderColorFontPage({
      source: "bundled mirror",
      id: "inshell.colorfont.v1",
      version: "v1",
      chain: "-",
      contract: "-",
      hash: keccak256(toUtf8Bytes(fallbackText)),
      data: fallbackText,
      status: "on-chain color font unavailable; showing bundled mirror.",
    });
  }
};

const VERIFY_NOT_LOADED = "not loaded";

const displayVerifyValue = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return VERIFY_NOT_LOADED;
};

const thoughtSpecName = () =>
  EVM_ADDRESSES.recommendedThoughtSpecName?.trim() ||
  EVM_ADDRESSES.thoughtSpec?.specName?.trim() ||
  EVM_ADDRESSES.thoughtSpecs?.[0]?.specName?.trim() ||
  "";

const thoughtSpecHash = () =>
  EVM_ADDRESSES.recommendedThoughtSpecHash?.trim() ||
  EVM_ADDRESSES.thoughtSpec?.hash?.trim() ||
  EVM_ADDRESSES.thoughtSpecs?.[0]?.specHash?.trim() ||
  "";

const pulseAuctionAddress = () =>
  getProtocolReleaseAddress("pulse_auction", "sepolia") ||
  maybeResolveAddress("pulse_auction") ||
  "";

const colorFontMirrorHash = () => keccak256(toUtf8Bytes(colorFontText.trim()));

const setVerifyText = (element: HTMLElement, value: unknown) => {
  element.textContent = displayVerifyValue(value);
};

const contractStatusSections = () =>
  buildContractStatusSections({
    chainId: THOUGHT_CHAIN_ID,
    chainName: THOUGHT_CHAIN_NAME,
    pathNft: PATH_NFT_ADDRESS,
    thoughtNft: THOUGHT_NFT_ADDRESS,
    pulseAuction: pulseAuctionAddress(),
    colorFontV1: COLOR_FONT_V1_ADDRESS,
    thoughtSpecName: thoughtSpecName(),
    thoughtSpecId: RECOMMENDED_THOUGHT_SPEC_ID,
    thoughtSpecHash: thoughtSpecHash(),
    colorFontHash: colorFontMirrorHash(),
  });

const contractStatusValue = (sectionId: string, rowId: string) =>
  findContractStatusRow(contractStatusSections(), sectionId, rowId)?.value ?? VERIFY_NOT_LOADED;

const thoughtReportState = () => {
  if (IS_COLOR_FONT_PAGE) return "color_font";
  if (IS_VERIFY_PAGE) return "verify";
  if (IS_GALLERY_PAGE) return "gallery";
  if (IS_THOUGHT_PAGE) return "thought_detail";
  return "frontpage";
};

const thoughtReportLaunchMode = (): PublicLaunchMode | undefined => {
  const raw = String(import.meta.env.VITE_PUBLIC_LAUNCH_MODE ?? "").trim();
  if (raw === "local" || raw === "sepolia_invite" || raw === "production") {
    return raw;
  }
  if (window.location.hostname === "thought.inshell.art") {
    return "sepolia_invite";
  }
  return undefined;
};

const configureReportBugLink = () => {
  const launchMode = thoughtReportLaunchMode();
  const link = buildReportBugLink(
    {
      surface: "thought",
      page: `${window.location.pathname}${window.location.search}`,
      network: THOUGHT_CHAIN_NAME,
      chainId: THOUGHT_CHAIN_ID,
      state: thoughtReportState(),
    },
    {
      env: import.meta.env,
      defaultOrigin: "https://inshell.art",
      ...(launchMode ? { launchMode } : {}),
    },
  );

  if (!link) {
    thoughtReportBugLink.classList.add("is-hidden");
    thoughtReportBugLink.removeAttribute("href");
    return;
  }

  thoughtReportBugLink.href = link.href;
  thoughtReportBugLink.target = link.target;
  thoughtReportBugLink.rel = link.rel;
  thoughtReportBugLink.ariaLabel = link.ariaLabel;
  thoughtReportBugLink.textContent = link.label;
  thoughtReportBugLink.classList.remove("is-hidden");
};

const configurePreviewWatermark = () => {
  if (!shouldShowPreviewWatermark({ env: import.meta.env })) return;
  if (document.querySelector(".inshell-preview-watermark")) return;

  const watermark = document.createElement("div");
  watermark.className = "inshell-preview-watermark";
  watermark.setAttribute("aria-hidden", "true");
  watermark.textContent = PREVIEW_WATERMARK_LABEL;
  document.body.appendChild(watermark);
};

const renderVerifyPage = () => {
  verifyHomeDomain.textContent = contractStatusValue("domains", "path-domain");
  verifyHomeDomain.href = contractStatusValue("domains", "path-domain");
  verifyHomeDomain.target = "_blank";
  verifyHomeDomain.rel = "noopener noreferrer";
  verifyThoughtDomain.textContent = contractStatusValue("domains", "thought-domain");
  verifyThoughtDomain.href = contractStatusValue("domains", "thought-domain");
  verifyThoughtDomain.target = "_blank";
  verifyThoughtDomain.rel = "noopener noreferrer";

  setVerifyText(verifyPathRole, contractStatusValue("deployment", "path-role"));
  setVerifyText(verifyThoughtRole, contractStatusValue("deployment", "thought-role"));
  setVerifyText(verifyNetwork, THOUGHT_ENVIRONMENT_LABEL);
  setVerifyText(verifyChain, THOUGHT_CHAIN_NAME);
  setVerifyText(verifyChainId, String(THOUGHT_CHAIN_ID));
  setVerifyText(verifyCurrency, THOUGHT_CURRENCY_LABEL);
  setVerifyText(verifyPathNft, contractStatusValue("contracts", "path-nft"));
  setVerifyText(verifyThoughtNft, contractStatusValue("contracts", "thought-nft"));
  setVerifyText(verifyPulseAuction, contractStatusValue("contracts", "pulse-auction"));
  setVerifyText(verifySpecName, contractStatusValue("thought-spec", "thought-spec-name"));
  setVerifyText(verifySpecId, contractStatusValue("thought-spec", "thought-spec-id"));
  setVerifyText(verifySpecHash, contractStatusValue("thought-spec", "thought-spec-hash"));
  setVerifyText(verifyColorFontAuthority, contractStatusValue("color-font", "color-font-authority"));
  setVerifyText(verifyColorFontLoadedFrom, contractStatusValue("color-font", "color-font-loaded-from"));
  setVerifyText(verifyColorFontHash, contractStatusValue("color-font", "color-font-hash"));
};

const fetchColorFontDoc = async (): Promise<ColorFontDoc> => {
  const colorFont = getReadColorFontV1();
  const token = getReadThoughtNFT();
  if (!COLOR_FONT_V1_ADDRESS && (!THOUGHT_NFT_ADDRESS || !token)) {
    throw new Error("Color Font contract not configured for this network.");
  }

  try {
    const source = colorFont ?? token;
    if (!source) {
      throw new Error("contract read failed.");
    }

    const [id, version, hash, data] = colorFont
      ? await Promise.all([
          colorFont.id() as Promise<string>,
          colorFont.version() as Promise<string>,
          colorFont.hash() as Promise<`0x${string}`>,
          colorFont.data() as Promise<string>,
        ])
      : await Promise.all([
          source.colorFontId() as Promise<string>,
          source.colorFontVersion() as Promise<string>,
          source.colorFontHash() as Promise<`0x${string}`>,
          source.colorFontData() as Promise<string>,
        ]);

    if (!validateColorFontDataShape(data)) {
      throw new Error("contract read failed.");
    }

    return {
      id,
      version,
      chainId: THOUGHT_CHAIN_ID,
      chainName: THOUGHT_CHAIN_NAME,
      contractAddress: (COLOR_FONT_V1_ADDRESS || THOUGHT_NFT_ADDRESS) as `0x${string}`,
      hash,
      format: COLOR_FONT_DOC_FORMAT,
      data,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "contract read failed.") {
      throw error;
    }
    throw new Error("contract read failed.");
  }
};

const openColorFontDocument = async (options?: {
  appendCliResult?: boolean;
  raw?: boolean;
  rawDocument?: boolean;
}) => {
  const shouldAppendCliResult = options?.appendCliResult ?? false;
  clearThoughtDetailColorFontFallback();

  try {
    const doc = await fetchColorFontDoc();
    if (options?.raw) {
      if (shouldAppendCliResult) {
        appendCliOutput(doc.data.split("\n"), { preserveSpacing: true });
      }
      return doc;
    }

    const plainText = options?.rawDocument ? doc.data : buildColorFontPlainText(doc);
    revokeThoughtDetailColorFontUrl();
    thoughtDetailColorFontUrl = URL.createObjectURL(new Blob([plainText], { type: "text/plain;charset=utf-8" }));
    const opened = window.open(thoughtDetailColorFontUrl, "_blank");
    if (opened) {
      opened.opener = null;
    }

    if (!opened) {
      thoughtDetailColorFont.href = thoughtDetailColorFontUrl;
      thoughtDetailColorFont.target = "_blank";
      thoughtDetailColorFont.rel = "noopener noreferrer";
      thoughtDetailColorFont.dataset.blobReady = "true";
      thoughtDetailColorFontStatus.textContent = "popup blocked. click title again.";
    }

    if (shouldAppendCliResult) {
      appendCliOutput([
        "opening Color Font v1.",
        "source: on-chain ABI.",
        opened ? "" : "popup blocked. click color font title again.",
      ].filter(Boolean));
    }

    return doc;
  } catch (error) {
    const message = error instanceof Error ? error.message : "contract read failed.";
    const lines = message.includes("not configured")
      ? ["color font unavailable.", "THOUGHT contract not configured for this network."]
      : ["color font unavailable.", "contract read failed."];
    thoughtDetailColorFontStatus.textContent = lines.join(" ");
    if (shouldAppendCliResult) {
      appendCliError(lines);
    }
    return null;
  }
};

const thoughtSpecCachePayload = (spec: ActiveThoughtSpec) => ({
  chainId: THOUGHT_CHAIN_ID,
  registry: THOUGHT_SPEC_REGISTRY_ADDRESS,
  cacheKey: getThoughtSpecCacheKey(spec.specId, spec.specHash),
  source: {
    contract: "ThoughtSpecRegistry",
    read: "thoughtSpecText(bytes32)",
  },
  specId: spec.specId,
  specHash: spec.specHash,
  ref: spec.ref,
  pointer: spec.pointer,
  byteLength: spec.byteLength,
  text: spec.text,
  fetchedAt: spec.fetchedAt,
});

const specJsonFilename = (spec: ActiveThoughtSpec) =>
  `${(spec.ref || "THOUGHT.md").replace(/[^A-Za-z0-9._-]+/g, "-")}.${shortHex(spec.specId, 8, 6)}.json`;

const specLinkText = (ref?: string) => `${ref || "THOUGHT.v1.md"} ↗`;

const setThoughtDetailSpecJsonLink = (spec: ActiveThoughtSpec) => {
  revokeThoughtDetailSpecJsonUrl();
  const json = JSON.stringify(thoughtSpecCachePayload(spec), null, 2);
  thoughtDetailSpecJsonUrl = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json" }));
  thoughtDetailSpecRef.textContent = specLinkText(spec.ref);
  thoughtDetailSpecRef.href = thoughtDetailSpecJsonUrl;
  thoughtDetailSpecRef.target = "_blank";
  thoughtDetailSpecRef.rel = "noopener noreferrer";
  thoughtDetailSpecRef.title = `Open local cached spec JSON: ${specJsonFilename(spec)}`;
};

const clearThoughtDetailSpecJsonLink = (title = "Spec JSON loads after the spec is verified.") => {
  revokeThoughtDetailSpecJsonUrl();
  thoughtDetailSpecRef.href = "#";
  thoughtDetailSpecRef.removeAttribute("target");
  thoughtDetailSpecRef.removeAttribute("rel");
  thoughtDetailSpecRef.title = title;
};

const setThoughtDetailProvenanceJsonLink = (detail: ThoughtDetail, byteCount: number) => {
  revokeThoughtDetailProvenanceJsonUrl();
  thoughtDetailProvenanceJsonUrl = URL.createObjectURL(
    new Blob([detail.provenanceJson], { type: "application/json" }),
  );
  thoughtDetailProvenanceBytes.textContent = `${byteCount} bytes ↗`;
  thoughtDetailProvenanceBytes.href = thoughtDetailProvenanceJsonUrl;
  thoughtDetailProvenanceBytes.target = "_blank";
  thoughtDetailProvenanceBytes.rel = "noopener noreferrer";
  thoughtDetailProvenanceBytes.title = `Open local provenance bytes from ThoughtNFT.provenanceOf(${detail.tokenId})`;
};

const clearThoughtDetailProvenanceJsonLink = (text = "provenance unavailable.") => {
  revokeThoughtDetailProvenanceJsonUrl();
  thoughtDetailProvenanceBytes.textContent = text;
  thoughtDetailProvenanceBytes.href = "#";
  thoughtDetailProvenanceBytes.removeAttribute("target");
  thoughtDetailProvenanceBytes.removeAttribute("rel");
  thoughtDetailProvenanceBytes.title = "Provenance bytes unavailable.";
};

const resolveRecommendedThoughtSpecId = async (registry: Contract) => {
  if (RECOMMENDED_THOUGHT_SPEC_ID && RECOMMENDED_THOUGHT_SPEC_ID !== ZERO_BYTES32) {
    return RECOMMENDED_THOUGHT_SPEC_ID;
  }

  const latest = await withTimeout(
    registry.latestThoughtSpecId() as Promise<string>,
    PREFLIGHT_REQUEST_TIMEOUT_MS,
    "THOUGHT.md request timed out.",
  );
  if (!latest || latest === ZERO_BYTES32) {
    throw new Error("spec unavailable.");
  }
  return latest;
};

const loadThoughtSpecMeta = async (registry: Contract, specId: string) => {
  const [exists, specName, specHash, ref, pointer, byteLength_] = (await withTimeout(
    registry.thoughtSpecMeta(specId) as Promise<unknown>,
    PREFLIGHT_REQUEST_TIMEOUT_MS,
    "THOUGHT.md request timed out.",
  )) as [boolean, string, string, string, string, bigint, bigint];

  if (!exists || !specId || specId === ZERO_BYTES32) {
    throw new Error("spec unavailable.");
  }

  return {
    specId,
    specHash,
    ref: ref || specName || "THOUGHT.md",
    pointer,
    byteLength: Number(byteLength_),
  };
};

const loadActiveThoughtSpec = async () => {
  const registry = getReadThoughtSpecRegistry();
  if (!registry) {
    throw new Error("spec unavailable.");
  }

  const specId = await resolveRecommendedThoughtSpecId(registry);
  const meta = await loadThoughtSpecMeta(registry, specId);

  const cached = readCachedThoughtSpec(meta);
  if (
    cached &&
    await withTimeout(
      registry.validateThoughtSpec(specId, meta.specHash) as Promise<boolean>,
      PREFLIGHT_REQUEST_TIMEOUT_MS,
      "THOUGHT.md request timed out.",
    )
  ) {
    return cached;
  }

  const [validSpec, text] = await Promise.all([
    withTimeout(
      registry.validateThoughtSpec(specId, meta.specHash) as Promise<boolean>,
      PREFLIGHT_REQUEST_TIMEOUT_MS,
      "THOUGHT.md request timed out.",
    ),
    withTimeout(
      registry.thoughtSpecText(specId) as Promise<string>,
      PREFLIGHT_REQUEST_TIMEOUT_MS,
      "THOUGHT.md request timed out.",
    ),
  ]);
  if (!validSpec) {
    throw new Error("spec mismatch.");
  }
  if (byteLength(text) !== meta.byteLength || hashText(text).toLowerCase() !== meta.specHash.toLowerCase()) {
    throw new Error("spec mismatch.");
  }

  const spec = {
    ...meta,
    text,
    fetchedAt: new Date().toISOString(),
  };
  writeCachedThoughtSpec(spec);
  return spec;
};

const loadThoughtSpecById = async (specId: string) => {
  const registry = getReadThoughtSpecRegistry();
  if (!registry || !specId) {
    throw new Error("spec unavailable.");
  }

  const meta = await loadThoughtSpecMeta(registry, specId);
  const cached = readCachedThoughtSpec(meta);
  if (cached) {
    return cached;
  }

  const [validSpec, text] = await Promise.all([
    withTimeout(
      registry.validateThoughtSpec(specId, meta.specHash) as Promise<boolean>,
      PREFLIGHT_REQUEST_TIMEOUT_MS,
      "THOUGHT.md request timed out.",
    ),
    withTimeout(
      registry.thoughtSpecText(specId) as Promise<string>,
      PREFLIGHT_REQUEST_TIMEOUT_MS,
      "THOUGHT.md request timed out.",
    ),
  ]);
  if (!validSpec || byteLength(text) !== meta.byteLength || hashText(text).toLowerCase() !== meta.specHash.toLowerCase()) {
    throw new Error("spec mismatch.");
  }

  const spec = {
    ...meta,
    text,
    fetchedAt: new Date().toISOString(),
  };
  writeCachedThoughtSpec(spec);
  return spec;
};

const ensureActiveThoughtSpec = async (options: { force?: boolean } = {}) => {
  if (options.force) {
    activeThoughtSpec = null;
    activeThoughtSpecPromise = null;
  }

  if (activeThoughtSpec) {
    return activeThoughtSpec;
  }

  activeThoughtSpecPromise ??= loadActiveThoughtSpec()
    .then((spec) => {
      activeThoughtSpec = spec;
      activeThoughtSpecPromise = null;
      return spec;
    })
    .catch((error) => {
      activeThoughtSpecPromise = null;
      throw error;
    });

  return activeThoughtSpecPromise;
};

const bundledThoughtSpecHash = () => IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecHash
  : THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash;

const bundledThoughtSpecRef = () => IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_RELEASE.spec.ref
  : THOUGHT_V2_PROTOCOL_RELEASE.spec.ref;

const bundledThoughtSpecId = () => IS_LOCAL_THOUGHT_V2
  ? THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId
  : THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId;

const buildBundledActiveThoughtSpec = (): ActiveThoughtSpec => ({
  specId: bundledThoughtSpecId(),
  specHash: bundledThoughtSpecHash(),
  ref: bundledThoughtSpecRef(),
  pointer: THOUGHT_V2_PROTOCOL_RELEASE.publicSpecPath,
  byteLength: IS_LOCAL_THOUGHT_V2
    ? THOUGHT_V2_LOCAL_RELEASE.spec.byteLength
    : THOUGHT_V2_PROTOCOL_RELEASE.spec.byteLength,
  text: thoughtInstructions,
  fetchedAt: new Date().toISOString(),
});

const shouldUseBundledThoughtSpecFallback = () =>
  IS_DEV_MODE && LOCAL_BROWSER_HOSTS.has(window.location.hostname);

const ensureThoughtDockActiveSpec = async () => {
  if (THOUGHT_AGENT_FIXTURE_MODE && shouldUseBundledThoughtSpecFallback()) {
    activeThoughtSpec = buildBundledActiveThoughtSpec();
    activeThoughtSpecPromise = null;
    return activeThoughtSpec;
  }
  if (IS_LOCAL_THOUGHT_V2) {
    return ensureActiveThoughtSpec({ force: true });
  }
  activeThoughtSpec = buildBundledActiveThoughtSpec();
  activeThoughtSpecPromise = null;
  return activeThoughtSpec;
};

const formatThoughtSpecError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|network|connection refused|could not connect|econnrefused/i.test(message)) {
    return "Failed to fetch THOUGHT.md.";
  }

  if (!message || message === "spec unavailable.") {
    return "THOUGHT.md unavailable.";
  }

  if (message === "spec mismatch.") {
    return "THOUGHT.md spec mismatch.";
  }

  return message.includes("THOUGHT.md") ? message : `THOUGHT.md ${message}`;
};

type StableJsonValue =
  | string
  | number
  | boolean
  | null
  | StableJsonValue[]
  | { [key: string]: StableJsonValue };

const stableStringify = (value: StableJsonValue): string => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const getCurrentProviderForProvenance = (): ThoughtRunProvider => {
  if (sessionState.mode === "connect") {
    return "openrouter";
  }

  if (sessionState.mode === "direct") {
    return sessionState.direct.provider;
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    return MY_BRAIN_PROVIDER;
  }

  if (sessionState.mode === CODEX_MODE) {
    return CODEX_PROVIDER;
  }

  return LOCAL_MODEL_SOURCE_ID;
};

const isThoughtRunProvider = (value: string): value is ThoughtRunProvider =>
  value === "openrouter" ||
  value === "openai" ||
  value === "anthropic" ||
  value === "ollama" ||
  value === MY_BRAIN_PROVIDER ||
  value === CODEX_PROVIDER;

const buildCurrentThoughtRunPayload = (prompt: string, model: string) => {
  const spec = activeThoughtSpec;
  if (!spec) {
    throw new Error("spec unavailable.");
  }

  return buildThoughtRunPayload({
    route: sessionState.mode,
    provider: getCurrentProviderForProvenance(),
    model,
    promptLine: prompt,
    thoughtSpec: {
      id: spec.specId,
      ref: spec.ref,
      hash: spec.specHash,
      text: getActiveThoughtInstructions(),
    },
  });
};

const buildThoughtRunPayloadFromContext = (context: ThoughtRunContext) => {
  const spec = activeThoughtSpec;
  if (!spec) {
    throw new Error("spec unavailable.");
  }

  return buildThoughtRunPayload({
    route: context.mode,
    provider: isThoughtRunProvider(context.provider) ? context.provider : getCurrentProviderForProvenance(),
    model: context.model,
    promptLine: context.prompt,
    thoughtSpec: {
      id: spec.specId,
      ref: spec.ref,
      hash: spec.specHash,
      text: getActiveThoughtInstructions(),
    },
  });
};

const provenanceRequestConfig = (request?: ThoughtRunProvenanceRequestConfig | { maxOutputTokens?: unknown }) => ({
  maxOutputTokens: String(request?.maxOutputTokens ?? THOUGHT_MAX_OUTPUT_TOKENS),
  stop: "stop" in (request ?? {}) ? String((request as { stop?: unknown }).stop ?? "none") : "none",
});

const provenanceWebConfig = (context: ThoughtRunContext, payload: ThoughtRunPayload): ThoughtRunWebConfig => {
  if (context.web) {
    return context.web;
  }

  const provenanceConfig = thoughtRunProvenanceConfig(payload);
  return provenanceConfig.web;
};

const buildProvenanceJson = (
  textHash: string,
  mint?: {
    minter: string;
    pathId: string | bigint;
    promptHash?: string;
  },
  work?: ThoughtMintWorkSnapshot,
) => {
  const spec = activeThoughtSpec;
  if (!spec) {
    throw new Error("spec unavailable.");
  }

  const context = work?.runContext ?? currentRunContext ?? {
    mode: sessionState.mode,
    provider: getCurrentProviderForProvenance(),
    model: getCurrentModelValue().trim(),
    prompt: sessionState.prompt,
    clientGeneratedAt: new Date().toISOString(),
  };
  if (IS_LOCAL_THOUGHT_V2 && mint) {
    const agentLine = work?.text || currentOutputText || context.returnedText || "";
    let process: ThoughtV2LocalProcess;
    if (context.mode === MY_BRAIN_MODE) {
      process = { kind: "manual" };
    } else {
      const evidence = context.agentEvidence;
      if (!evidence) {
        throw new Error("This work has no current V2 Agent evidence. Run the work again before minting.");
      }
      process = buildThoughtV2LocalAgentProcess(evidence, agentLine);
    }
    return buildThoughtV2LocalProvenance({
      promptLine: context.prompt,
      agentLine,
      process,
      mintContext: {
        chainId: String(THOUGHT_CHAIN_ID),
        thoughtNft: THOUGHT_NFT_ADDRESS,
        pathNft: PATH_NFT_ADDRESS,
        minter: mint.minter,
        movement: "THOUGHT",
        pathId: typeof mint.pathId === "bigint" ? mint.pathId.toString() : mint.pathId,
      },
    });
  }
  const fallbackPayload = buildThoughtRunPayloadFromContext(context);
  const isExternalReturnRun = context.mode === MY_BRAIN_MODE || context.mode === CODEX_MODE;
  const request = isExternalReturnRun ? null : provenanceRequestConfig(context.request);
  const web = isExternalReturnRun ? null : provenanceWebConfig(context, fallbackPayload);
  const thoughtSpec = context.thoughtSpec ?? {
    hash: spec.specHash,
    id: spec.specId,
    ref: spec.ref,
  };
  const promptHash = mint?.promptHash || hashText(context.prompt);
  const returnedText = context.returnedText ?? work?.text ?? currentOutputText;
  const returnedTextHash = hashText(returnedText);
  const contractSvg = work?.svg ?? currentWorkSvg;
  const contractSvgHash = contractSvg ? hashText(contractSvg) : undefined;
  const previewProvider = context.previewProvider;
  const frontendPreviewed = previewProvider?.method === "frontendRender";
  const chain = mint
    ? {
        chainId: String(THOUGHT_CHAIN_ID),
        pathNFT: PATH_NFT_ADDRESS,
        thoughtNft: THOUGHT_NFT_ADDRESS,
      }
    : undefined;
  const mintContext = mint
    ? {
        minter: mint.minter,
        movement: "THOUGHT",
        pathId: typeof mint.pathId === "bigint" ? mint.pathId.toString() : mint.pathId,
      }
    : undefined;

  return stableStringify({
    app: "THOUGHT",
    appBuild: APP_BUILD,
    appVersion: APP_VERSION,
    ...(chain ? { chain } : {}),
    client: {
      generatedAt: context.clientGeneratedAt,
    },
    hashes: {
      promptHash,
      returnedTextHash,
      textHash,
    },
    route: context.mode,
    model: context.model,
    ...(mintContext ? { mint: mintContext } : {}),
    output: {
      returnedText,
      format: "thought.text.v1",
      normalizer: frontendPreviewed ? "frontend-renderer" : "contract-preview",
      textHash,
      ...(contractSvgHash ? { contractSvgHash } : {}),
    },
    ...(previewProvider
      ? {
          preview: {
            contractPreviewed: previewProvider.method === "previewWork",
            method: previewProvider.method,
            provider: {
              kind: previewProvider.kind,
              ...(previewProvider.chainId ? { chainId: String(previewProvider.chainId) } : {}),
              ...(previewProvider.endpointLabel ? { endpointLabel: previewProvider.endpointLabel } : {}),
            },
            thoughtNft: previewProvider.contractAddress ?? THOUGHT_NFT_ADDRESS,
          },
        }
      : {}),
    prompt: context.prompt,
    provider: context.provider,
    ...(request ? { request } : {}),
    schema: "thought.provenance.v1",
    thoughtSpec,
    ...(web ? { web } : {}),
  });
};

const parsePathTokenId = (value: string) => {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }
  return BigInt(trimmed);
};

const indexedAddressTopic = (address: string) =>
  `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

const transferLogTokenId = (topics: readonly string[]) => {
  const tokenIdTopic = topics[3];
  if (!tokenIdTopic) {
    return null;
  }

  try {
    return BigInt(tokenIdTopic);
  } catch {
    return null;
  }
};

const verifyThoughtSpecAnchor = async () => {
  const registry = getReadThoughtSpecRegistry();
  if (!registry || !activeThoughtSpec) {
    return false;
  }

  return Boolean(await registry.isRegisteredThoughtSpec(
    activeThoughtSpec.specId,
    activeThoughtSpec.specHash,
  ));
};

const clearMintAuthorization = () => {
  mintAuthorizationRequestId += 1;
  mintFlowData.deadline = null;
  mintFlowData.signature = "";
};

const clearMintPathSelection = () => {
  mintFlowData.pathIdInput = "";
  mintFlowData.pathId = null;
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  walletState.txState = "idle";
  walletState.txError = "";
  clearMintAuthorization();
};

const isPendingMintDeploymentCompatible = (pending: PendingMintTransaction) =>
  pending.chainId === THOUGHT_CHAIN_ID &&
  pending.thoughtNft.toLowerCase() === THOUGHT_NFT_ADDRESS.toLowerCase();

const projectPendingMintTransaction = (
  pending: PendingMintTransaction,
  options?: { deploymentWarning?: boolean },
) => {
  mintAttemptId = pending.attemptId?.trim() || mintAttemptId || nextMintAttemptId("resume");
  mintFlowData.textHash = pending.workHash;
  mintFlowData.pathIdInput = pending.pathId;
  mintFlowData.pathId = BigInt(pending.pathId);
  mintFlowData.txHash = pending.hash;
  walletState.txHash = pending.hash;
  walletState.txState = "submitted";
  const deploymentWarning = options?.deploymentWarning === true;
  const conflictingHashes = conflictingMintTransactions
    .filter((transaction) => transaction.hash !== pending.hash)
    .map((transaction) => shortHex(transaction.hash, 10, 8));
  const trackingWarning = deploymentWarning
    ? `Automatic confirmation monitoring is unavailable: this hash belongs to chain ${pending.chainId} and contract ${shortHex(pending.thoughtNft)}. Hash retained; do not submit a duplicate.`
    : conflictingHashes.length > 0
      ? `Multiple transaction hashes returned (${shortHex(pending.hash, 10, 8)}, ${conflictingHashes.join(", ")}). Tracking all known hashes; do not submit a duplicate.`
      : "";
  walletState.txError = trackingWarning;
  mintFlowData.error = trackingWarning;
  mintFlowData.errorKind = trackingWarning ? "mint" : "none";
  mintFlowState = "minting";
  const work = getThoughtDockWorkView();
  if (work) {
    setThoughtDockState({ kind: "work_ready", work });
  }
};

const adoptDurablePendingMintTransaction = () => {
  if (pendingMintTransaction) {
    return pendingMintTransaction;
  }
  const durable = readPendingMintTransaction();
  if (!durable) {
    const retainedConflicts = [
      ...readConflictingMintTransactions(),
      ...conflictingMintTransactions,
    ].filter((transaction, index, all) =>
      all.findIndex((candidate) => candidate.hash === transaction.hash) === index
    );
    const promoted = retainedConflicts[0] ?? null;
    if (!promoted) {
      return null;
    }
    pendingMintTransaction = promoted;
    conflictingMintTransactions = retainedConflicts
      .filter((transaction) => transaction.hash !== promoted.hash);
    writePendingMintTransaction(promoted);
    writeConflictingMintTransactions(conflictingMintTransactions);
    projectPendingMintTransaction(promoted, {
      deploymentWarning: !isPendingMintDeploymentCompatible(promoted),
    });
    return promoted;
  }
  pendingMintTransaction = durable;
  projectPendingMintTransaction(durable, {
    deploymentWarning: !isPendingMintDeploymentCompatible(durable),
  });
  return durable;
};

const blockPendingMintMutation = (options?: { cli?: boolean }) => {
  const pending = adoptDurablePendingMintTransaction();
  const submissionUnresolved = mintTransactionInFlight || walletMintSubmitPromiseUnresolved;
  if (!pending && !submissionUnresolved) {
    return false;
  }

  if (pending) {
    projectPendingMintTransaction(pending, {
      deploymentWarning: !isPendingMintDeploymentCompatible(pending),
    });
  } else {
    const work = getThoughtDockWorkView();
    if (work) {
      setThoughtDockState({ kind: "work_ready", work });
    }
  }
  if (currentOutputText) {
    runState = "output_ready";
  }
  runInFlight = false;
  emitThoughtConsoleEvent({
    kind: pending ? "pending_mint_preserved" : "wallet_mint_request_preserved",
    title: pending ? "mint still pending" : "wallet mint request still open",
    detail: pending
      ? `Keep tracking ${shortHex(pending.hash, 10, 8)} before changing this work.`
      : "Resolve or cancel the wallet request before changing this work.",
    eventId: pending
      ? `pending-preserved:${pending.hash.toLowerCase()}`
      : `wallet-request-preserved:${activeMintTransactionRequestId}`,
  });
  recordCurrentMintConsoleState();
  syncInterface();
  if (options?.cli) {
    appendCliOutput([
      pending ? "mint still pending." : "wallet mint request still unresolved.",
      pending ? `tx: ${shortHex(pending.hash, 10, 8)}` : "resolve or cancel it in your wallet.",
      "do not submit a duplicate.",
      pending ? "use: view tx" : "use: current",
    ]);
  }
  if (pending && isPendingMintDeploymentCompatible(pending)) {
    resumePendingMintReceiptMonitoring();
  }
  return true;
};

function resetPathInventoryState() {
  pathInventoryRequestId += 1;
  pathInventoryState = {
    status: "idle",
    wallet: "",
    chainId: null,
    items: [],
    error: "",
  };
}

const resetPathAcquisitionUiState = () => {
  pathAcquisitionRequestId += 1;
  pathAcquisitionReceiptMonitorHash = "";
  const pending = readPendingPathAcquisition();
  pathAcquisitionState = pending ? "submitted" : "idle";
  pathAcquisitionPrice = 0n;
  pathAcquisitionTxHash = pending?.txHash ?? "";
  pathAcquisitionError = "";
  pathAcquisitionCompletedForAttempt = false;
};

const resetMintFlow = (options?: { preserveAttempt?: boolean }) => {
  if (blockPendingMintMutation()) {
    return false;
  }
  if (!options?.preserveAttempt) {
    mintAttemptId = nextMintAttemptId("idle");
  }
  thoughtExistenceCheckRequestId += 1;
  mintFlowState = "closed";
  mintFlowUiMode = THOUGHT_PANEL_MINT_UI_MODE;
  activeMintWork = null;
  mintFlowData.rawText = "";
  mintFlowData.textHash = "";
  mintFlowData.promptHash = "";
  mintFlowData.thoughtSpecId = "";
  mintFlowData.thoughtSpecHash = "";
  mintFlowData.provenanceJson = "";
  mintFlowData.existingTokenId = null;
  mintFlowData.pathIdInput = "";
  mintFlowData.pathId = null;
  mintFlowData.txHash = "";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  clearMintAuthorization();
  resetPathInventoryState();
  resetPathAcquisitionUiState();
  return true;
};

const resetMintRuntimeState = () => {
  if (blockPendingMintMutation()) {
    return false;
  }
  resetMintFlow();
  walletState.txState = "idle";
  walletState.txError = "";
  walletState.txHash = "";
  walletState.mintedTokenId = null;
  return true;
};

const closeMintSheet = () => {
  if (blockPendingMintMutation()) {
    return;
  }
  resetMintFlow();
  syncInterface();
};

const signPathConsumeAuthorization = async (
  signer: JsonRpcSigner,
  claimer: string,
  pathId: bigint,
  onStage: (stage: ThoughtAuthorizationStage) => void,
) => {
  const pathNft = getReadPathNft();
  if (!pathNft) {
    throw new Error("$PATH signature unavailable.");
  }
  onStage("nonce");
  const nonce = await withTimeout(
    pathNft.getConsumeNonce(claimer) as Promise<bigint>,
    PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS,
    "$PATH signature request timed out.",
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + PATH_CONSUME_AUTH_TTL_SECONDS;
  onStage("digest");
  const structHash = keccak256(
    EVM_ABI_CODER.encode(
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
        CONSUME_AUTHORIZATION_TYPEHASH,
        PATH_NFT_ADDRESS,
        BigInt(THOUGHT_CHAIN_ID),
        pathId,
        PATH_MOVEMENT_THOUGHT,
        claimer,
        THOUGHT_NFT_ADDRESS,
        nonce,
        deadline,
      ],
    ),
  );
  onStage("signature");
  const signature = await signer.signMessage(getBytes(structHash));
  return { deadline, signature };
};

const copyToClipboard = async (value: string) => {
  if (!value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
};

const getWalletNetworkLabel = () => {
  if (walletState.chainId === null) {
    return "not connected";
  }

  if (walletState.chainId === THOUGHT_CHAIN_ID) {
    return THOUGHT_CHAIN_NAME;
  }

  return `chain ${walletState.chainId}`;
};

const getWalletDotState = (): WalletDotState => {
  if (walletState.txState === "awaiting_signature" || walletState.txState === "submitted") {
    return "pending";
  }

  if (walletState.address && walletState.chainId !== null && walletState.chainId !== THOUGHT_CHAIN_ID) {
    return "warn";
  }

  if (
    walletState.txState === "failed" ||
    (!!walletState.preflightError && !!walletState.address && walletState.chainId === THOUGHT_CHAIN_ID)
  ) {
    return "error";
  }

  if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID) {
    return "on";
  }

  return "off";
};

const hasModelAccess = () => {
  if (!isRouteConfigured()) {
    return false;
  }

  if (sessionState.mode === MY_BRAIN_MODE || sessionState.mode === CODEX_MODE) {
    return true;
  }

  if (sessionState.mode === "connect") {
    return sessionState.connect.apiKey.trim().length > 0;
  }

  if (sessionState.mode === "direct") {
    return getDirectApiKey().length > 0;
  }

  return sessionState.local.available === true;
};

const isDebugActive = () => IS_DEV_MODE && debugState.enabled;

const isDebugCtaOverrideActive = () => isDebugActive() && debugState.cta !== "auto";

const getDebugActionPresentation = (): ActionPresentation | null => {
  if (!isDebugCtaOverrideActive()) {
    return null;
  }

  if (debugState.cta === "run") {
    return {
      primaryLabel: "[ run ]",
      primaryDisabled: false,
      primaryAction: "none",
      status: "",
      secondaryLabel: "",
      secondaryAction: "none",
    };
  }

  if (debugState.cta === "running") {
    return {
      primaryLabel: "[ running ]",
      primaryDisabled: true,
      primaryAction: "none",
      status: "",
      secondaryLabel: "",
      secondaryAction: "none",
    };
  }

  if (debugState.cta === "retry") {
    return {
      primaryLabel: "[ retry ]",
      primaryDisabled: false,
      primaryAction: "none",
      status: "generation failed",
      secondaryLabel: "",
      secondaryAction: "none",
    };
  }

  if (debugState.cta === "mint") {
    return {
      primaryLabel: "[ mint ]",
      primaryDisabled: debugState.ctaStatus === "mint_unavailable",
      primaryAction: "none",
      status: "ready",
      secondaryLabel: "[ reset ]",
      secondaryAction: "reset",
    };
  }

  if (debugState.cta === "view_thought") {
    return {
      primaryLabel: "[ view THOUGHT ]",
      primaryDisabled: false,
      primaryAction: "none",
      status: "minted",
      secondaryLabel: "",
      secondaryAction: "none",
    };
  }

  return null;
};

const applyDebugStatusOverride = (action: ActionPresentation): ActionPresentation => {
  if (!isDebugActive() || debugState.ctaStatus === "auto") {
    return action;
  }

  const debugStatusText: Record<Exclude<ThoughtDebugCtaStatusOverride, "auto">, string> = {
    none: "",
    ready: "ready",
    minted: "minted",
    model_needed: "model access needed",
    generation_failed: "generation failed",
    mint_unavailable: "mint unavailable",
  };

  return {
    ...action,
    status: debugStatusText[debugState.ctaStatus],
  };
};

const getActionPresentation = (): ActionPresentation => {
  const debugAction = getDebugActionPresentation();
  if (debugAction) {
    return applyDebugStatusOverride(debugAction);
  }

  const hasOutput = currentOutputText.length > 0;
  let action: ActionPresentation;

  if (runState === "running" || runInFlight) {
    action = {
      primaryLabel: "[ running ]",
      primaryDisabled: true,
      primaryAction: "none",
      status: "",
      secondaryLabel: "",
      secondaryAction: "none",
    };
    return applyDebugStatusOverride(action);
  }

  if (walletState.mintedTokenId !== null) {
    action = {
      primaryLabel: "",
      primaryDisabled: true,
      primaryAction: "none",
      status: "minted",
      secondaryLabel: "[ view THOUGHT ]",
      secondaryAction: "view_thought",
      hidePrimary: true,
    };
    return applyDebugStatusOverride(action);
  }

  if (hasOutput) {
    if (!THOUGHT_RPC_URL || !THOUGHT_NFT_ADDRESS) {
      action = {
        primaryLabel: "[ mint ]",
        primaryDisabled: true,
        primaryAction: "none",
        status: "mint unavailable",
        secondaryLabel: "[ reset ]",
        secondaryAction: "reset",
      };
      return applyDebugStatusOverride(action);
    }

    action = {
      primaryLabel: "[ mint ]",
      primaryDisabled: false,
      primaryAction: "mint",
      status: "ready",
      secondaryLabel: "[ reset ]",
      secondaryAction: "reset",
    };
    return applyDebugStatusOverride(action);
  }

  if (runState === "run_failed") {
    action = {
      primaryLabel: "[ retry ]",
      primaryDisabled: !hasModelAccess(),
      primaryAction: hasModelAccess() ? "retry_run" : "none",
      status: "generation failed",
      secondaryLabel: "",
      secondaryAction: "none",
    };
    return applyDebugStatusOverride(action);
  }

  if (runState === "candidate_ready") {
    action = {
      primaryLabel: "[ run ]",
      primaryDisabled: !hasModelAccess(),
      primaryAction: hasModelAccess() ? "run" : "none",
      status: "candidate",
      secondaryLabel: "[ reset ]",
      secondaryAction: "reset",
    };
    return applyDebugStatusOverride(action);
  }

  if (!isRouteConfigured()) {
    action = {
      primaryLabel: "[ run ]",
      primaryDisabled: true,
      primaryAction: "none",
      status: "config needed",
      secondaryLabel: "",
      secondaryAction: "none",
    };
    return applyDebugStatusOverride(action);
  }

  action = {
    primaryLabel: "[ run ]",
    primaryDisabled: !hasModelAccess(),
    primaryAction: hasModelAccess() ? "run" : "none",
    status: hasModelAccess() ? "" : "model access needed",
    secondaryLabel: "",
    secondaryAction: "none",
  };
  return applyDebugStatusOverride(action);
};

const clearNoticeTimer = (timer: number | null) => {
  if (timer !== null) {
    window.clearTimeout(timer);
  }
};

const updateNotice = (element: HTMLElement, message: string) => {
  element.textContent = message;
  element.classList.toggle("is-hidden", message.length === 0);
};

const setWarning = (message: string, options?: { flashMs?: number; level?: PanelWarningLevel }) => {
  clearNoticeTimer(warningTimer);
  warningTimer = null;
  panelWarningMessage = message;
  panelWarningLevel = options?.level ?? "error";
  syncWarningBox();

  if (message && options?.flashMs) {
    warningTimer = window.setTimeout(() => {
      panelWarningMessage = "";
      panelWarningLevel = "error";
      syncWarningBox();
      warningTimer = null;
    }, options.flashMs);
  }
};

const setStatus = (message: string, options?: { flashMs?: number }) => {
  clearNoticeTimer(statusTimer);
  statusTimer = null;
  updateNotice(runStatus, message);

  if (message && options?.flashMs) {
    statusTimer = window.setTimeout(() => {
      updateNotice(runStatus, "");
      statusTimer = null;
    }, options.flashMs);
  }
};

const getDebugWarningPresentation = () => {
  const debugWarningCopy: Record<
    Exclude<ThoughtDebugWarningOverride, "auto">,
    { level: PanelWarningLevel; text: string }
  > = {
    none: { level: "info", text: "" },
    prompt_required: { level: "warn", text: "prompt is required." },
    model_required: { level: "warn", text: "model is required." },
    openrouter_required: { level: "warn", text: "authorize openrouter first." },
    api_key_required: { level: "warn", text: "api key is required." },
    ollama_not_found: { level: "error", text: "ollama not found." },
    spec_unavailable: { level: "error", text: "spec unavailable." },
    provider_error: { level: "error", text: "provider returned error." },
    external_service: { level: "error", text: "external service returned error." },
    openrouter_connect_constraint: {
      level: "warn",
      text: "openrouter connect needs localhost or https.",
    },
    wallet_missing: { level: "warn", text: "No supported wallet found." },
    wallet_connect_failed: { level: "error", text: "wallet connect failed." },
    wallet_switch_failed: { level: "error", text: "wallet switch failed." },
    thought_too_large: {
      level: "warn",
      text: `work exceeds the ${MAX_TEXT_BYTES}-byte mint limit.`,
    },
    mint_contract_unavailable: { level: "error", text: "mint contract not configured." },
  };

  return debugState.warning === "auto" ? null : debugWarningCopy[debugState.warning];
};

const syncWarningBox = () => {
  const debugWarning = isDebugActive() ? getDebugWarningPresentation() : null;
  const warningCopy = debugWarning?.text ?? panelWarningMessage;
  const warningLevel = debugWarning?.level ?? panelWarningLevel;
  warningBox.classList.remove("is-info", "is-warn", "is-error");
  warningBox.classList.add(`is-${warningLevel}`);
  updateNotice(warningBox, warningCopy);
};

const setMintFlowError = (
  message: string,
  kind: MintFlowErrorKind = "mint",
  options: { preserveAuthorization?: boolean; preserveSubmittedTransaction?: boolean } = {},
) => {
  mintErrorSequence += 1;
  mintFlowState = "error";
  mintFlowData.error = message;
  mintFlowData.errorKind = kind;
  if (!options.preserveAuthorization) {
    clearMintAuthorization();
  }
  if (!options.preserveSubmittedTransaction) {
    walletState.txState = "failed";
  }
  walletState.txError = message;
  recordCurrentMintConsoleState();
};

const hiddenMintSheetAction = (): MintSheetActionConfig => ({
  action: "none",
  hidden: true,
  label: "",
});

const mintSheetAction = (
  action: MintSheetAction,
  label: string,
  disabled = false,
): MintSheetActionConfig => ({
  action,
  disabled,
  label,
});

const isPathRecoveryError = () =>
  mintFlowState === "error" &&
  (
    mintFlowData.errorKind === "path_invalid" ||
    mintFlowData.errorKind === "path_not_found" ||
    mintFlowData.errorKind === "path_consumed" ||
    mintFlowData.errorKind === "path_not_ready" ||
    mintFlowData.errorKind === "path_unknown"
  );

const isThoughtLevelMintError = () =>
  mintFlowState === "error" &&
  (
    mintFlowData.errorKind === "thought" ||
    mintFlowData.errorKind === "spec" ||
    mintFlowData.errorKind === "mint" ||
    mintFlowData.errorKind === "funds" ||
    mintFlowData.errorKind === "signature"
  );

const canContinueWithPathInput = () => parsePathTokenId(mintFlowData.pathIdInput) !== null;

const applyMintPathInputValue = (value: string) => {
  const trimmed = value.trim();
  mintFlowData.pathIdInput = trimmed;
  mintFlowData.pathId = parsePathTokenId(trimmed);
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  clearMintAuthorization();
  if (mintFlowState !== "closed") {
    mintFlowState = "path_required";
  }
};

const pathInventoryMatchesCurrentWallet = () =>
  !!walletState.address &&
  pathInventoryState.wallet === walletState.address.toLowerCase() &&
  pathInventoryState.chainId === walletState.chainId;

const availablePathInventoryItems = () =>
  pathInventoryMatchesCurrentWallet() && pathInventoryState.status === "loaded"
    ? pathInventoryState.items.filter((item) => item.status === "available")
    : [];

const hasAvailablePathInventory = () => availablePathInventoryItems().length > 0;

const hasLoadedPathInventoryWithoutAvailable = () =>
  pathInventoryMatchesCurrentWallet() &&
  pathInventoryState.status === "loaded" &&
  availablePathInventoryItems().length === 0;

const displayPathInventoryStatus = (status: string) => (status === "unknown" ? "unverified" : status);

const shouldAutoLoadPathInventory = () =>
  mintFlowState === "path_required" &&
  !!walletState.address &&
  walletState.chainId === THOUGHT_CHAIN_ID;

const isPathInventoryReadPending = () =>
  shouldAutoLoadPathInventory() &&
  (!pathInventoryMatchesCurrentWallet() || pathInventoryState.status === "idle" || pathInventoryState.status === "loading");

const isPathInventoryManualFallbackState = () =>
  pathInventoryMatchesCurrentWallet() &&
  (pathInventoryState.status === "unavailable" || pathInventoryState.status === "error");

const shouldRevealManualPathInput = () =>
  isMintPathFieldVisible() &&
  isPathInventoryManualFallbackState() &&
  !shouldUsePathInventoryPicker();

const refreshPathInventoryForCurrentWallet = async (options?: { force?: boolean }) => {
  if (!walletState.address || walletState.chainId !== THOUGHT_CHAIN_ID) {
    resetPathInventoryState();
    syncInterface();
    return;
  }

  if (
    !options?.force &&
    pathInventoryMatchesCurrentWallet() &&
    pathInventoryState.status !== "idle"
  ) {
    return;
  }

  const wallet = walletState.address;
  const chainId = walletState.chainId;
  const requestId = pathInventoryRequestId + 1;
  pathInventoryRequestId = requestId;
  pathInventoryState = {
    status: "loading",
    wallet: wallet.toLowerCase(),
    chainId,
    items: [],
    error: "",
  };
  syncInterface();

  try {
    const inventory = await readWalletPathInventory(wallet);
    if (requestId !== pathInventoryRequestId) {
      return;
    }

    if (inventory.kind === "unavailable") {
      pathInventoryState = {
        status: "unavailable",
        wallet: wallet.toLowerCase(),
        chainId,
        items: [],
        error: inventory.message,
      };
      if (IS_LOCAL_THOUGHT_V2 && isThoughtV2LocalDeploymentError(inventory.message)) {
        setMintFlowError(inventory.message, "thought");
      } else {
        recordCurrentMintConsoleState();
      }
    } else {
      pathInventoryState = {
        status: "loaded",
        wallet: wallet.toLowerCase(),
        chainId,
        items: inventory.items,
        error: "",
      };
      const availableItems = inventory.items.filter((item) => item.status === "available");
      if (availableItems.length === 0) {
        clearMintPathSelection();
        if (mintFlowState === "error" && isPathRecoveryError()) {
          mintFlowState = "path_required";
        }
        if (pathAcquisitionState === "idle") {
          void handleMintPath();
        } else {
          recordCurrentMintConsoleState();
        }
      } else {
        recordCurrentMintConsoleState();
      }
    }
  } catch (error) {
    if (requestId !== pathInventoryRequestId) {
      return;
    }
    pathInventoryState = {
      status: "error",
      wallet: wallet.toLowerCase(),
      chainId,
      items: [],
      error: error instanceof Error ? error.message : "path list unavailable.",
    };
    recordCurrentMintConsoleState();
  }

  syncInterface();
};

const moveMintFlowToWalletOrPathSelection = () => {
  if (!walletState.address) {
    mintFlowState = "wallet_required";
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
    recordCurrentMintConsoleState();
    return false;
  }

  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    setMintFlowError("wrong network.", "wrong_network");
    return false;
  }

  mintFlowState = "path_required";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  recordCurrentMintConsoleState();
  return true;
};

const maybeLoadPathInventory = () => {
  if (
    shouldAutoLoadPathInventory() &&
    (!pathInventoryMatchesCurrentWallet() || pathInventoryState.status === "idle")
  ) {
    void refreshPathInventoryForCurrentWallet();
  }
};

const selectPathInventoryItem = (pathId: bigint) => {
  applyMintPathInputValue(pathId.toString());
  syncInterface();
  focusMintDockStage();
  void checkPathEligibility();
};

const isMintPathFieldVisible = () => {
  const thoughtLevelMintError = isThoughtLevelMintError();
  return (
    mintFlowState === "path_required" ||
    mintFlowState === "path_checking" ||
    mintFlowState === "path_ready" ||
    mintFlowState === "authorizing" ||
    mintFlowState === "authorized" ||
    (mintFlowState === "error" && !thoughtLevelMintError)
  );
};

const isMintPathInputDisabled = () =>
  mintFlowState === "path_checking" ||
  mintFlowState === "path_ready" ||
  mintFlowState === "authorizing" ||
  mintFlowState === "authorized" ||
  mintFlowState === "minting" ||
  mintFlowState === "minted";

const shouldUsePathInventoryPicker = () =>
  hasAvailablePathInventory() &&
  mintFlowState === "path_required";

const focusRestoredMintElement = (element: HTMLElement) => {
  thoughtDockPath.querySelectorAll<HTMLElement>(".is-focus-restored").forEach((item) => {
    item.classList.remove("is-focus-restored");
  });
  element.classList.add("is-focus-restored");
  element.addEventListener("blur", () => {
    element.classList.remove("is-focus-restored");
  }, { once: true });
  element.focus({ preventScroll: true });
};

const focusMintDockStage = (preference: "action" | "path" = "action") => {
  requestAnimationFrame(() => {
    if (mintFlowUiMode !== "dock" || thoughtDockPath.classList.contains("is-hidden")) {
      return;
    }

    if (preference === "path") {
      if (!thoughtDockPathInventorySelect.disabled) {
        focusRestoredMintElement(thoughtDockPathInventorySelect);
        return;
      }
    }

    const action = [thoughtDockPathPrimary, thoughtDockPathSecondary, thoughtDockPathTertiary]
      .find((button) => !button.disabled && !button.classList.contains("is-hidden"));
    if (action) {
      focusRestoredMintElement(action);
      return;
    }

  });
};

const focusMintPathInput = () => {
  if (mintFlowUiMode === "dock") {
    focusMintDockStage("path");
    return;
  }

  const input = shouldUsePathInventoryPicker() ? mintSheetPathSelect : mintSheetPathBox;
  requestAnimationFrame(() => {
    if (!input.disabled) {
      input.focus();
    }
  });
};

const getLegacyMintSheetActionConfigs = (): [
  MintSheetActionConfig,
  MintSheetActionConfig,
  MintSheetActionConfig,
] => {
  if (mintFlowState === "thought_checking") {
    return [
      mintSheetAction("none", "checking", true),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "text_taken") {
    return [
      mintSheetAction("view_thought", "view thought"),
      mintSheetAction("reset", "reset"),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "wallet_required") {
    if (isInjectedWalletMissing()) {
      return [
        mintSheetAction("reset", "reset"),
        hiddenMintSheetAction(),
        hiddenMintSheetAction(),
      ];
    }
    return [
      mintSheetAction("connect_wallet", "connect wallet", walletConnectInFlight),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "path_required") {
    if (walletState.address && walletState.chainId !== THOUGHT_CHAIN_ID) {
      return [
        mintSheetAction("switch_network", "switch network"),
        mintSheetAction("disconnect_wallet", "disconnect"),
        hiddenMintSheetAction(),
      ];
    }

    if (isPathInventoryReadPending()) {
      return [
        mintSheetAction("none", "checking", true),
        mintSheetAction("disconnect_wallet", "disconnect"),
        hiddenMintSheetAction(),
      ];
    }

    if (hasLoadedPathInventoryWithoutAvailable()) {
      return [
        mintSheetAction("mint_path", "mint path"),
        hiddenMintSheetAction(),
        hiddenMintSheetAction(),
      ];
    }

    if (isPathInventoryManualFallbackState()) {
      if (canContinueWithPathInput()) {
        return [
          mintSheetAction("continue", "continue"),
          mintSheetAction("mint_path", "mint path"),
          hiddenMintSheetAction(),
        ];
      }
      return [
        mintSheetAction("enter_path_manually", "enter path manually"),
        mintSheetAction("mint_path", "mint path"),
        hiddenMintSheetAction(),
      ];
    }

    if (hasAvailablePathInventory()) {
      return [
        mintSheetAction("continue", "continue", !canContinueWithPathInput()),
        hiddenMintSheetAction(),
        hiddenMintSheetAction(),
      ];
    }

    return [
      mintSheetAction("continue", "continue", !canContinueWithPathInput()),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "path_checking") {
    return [
      mintSheetAction("none", "checking", true),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "path_ready") {
    return [
      mintSheetAction("authorize", "sign"),
      mintSheetAction("choose_another", "pick another"),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "authorizing") {
    return [
      mintSheetAction("none", "signing", true),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "authorized") {
    return [
      mintSheetAction("confirm_mint", "confirm mint"),
      mintSheetAction("choose_another", "pick another"),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "minting") {
    return [
      mintSheetAction("none", "minting", true),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "minted") {
    return [
      mintSheetAction("view_tx", "view tx"),
      mintSheetAction("view_thought", "view thought"),
      hiddenMintSheetAction(),
    ];
  }

  if (mintFlowState === "error") {
    if (mintFlowData.errorKind === "wrong_network") {
      return [
        mintSheetAction("switch_network", "switch network"),
        mintSheetAction("disconnect_wallet", "disconnect"),
        hiddenMintSheetAction(),
      ];
    }

    if (isPathRecoveryError()) {
      if (hasLoadedPathInventoryWithoutAvailable()) {
        return [
          mintSheetAction("mint_path", "mint path"),
          hiddenMintSheetAction(),
          hiddenMintSheetAction(),
        ];
      }
      if (isPathInventoryManualFallbackState()) {
        return [
          mintSheetAction("enter_path_manually", "enter path manually"),
          mintSheetAction("mint_path", "mint path"),
          hiddenMintSheetAction(),
        ];
      }
      return [
        mintSheetAction("choose_another", "pick another"),
        hiddenMintSheetAction(),
        hiddenMintSheetAction(),
      ];
    }

    return [
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
      hiddenMintSheetAction(),
    ];
  }

  return [
    mintSheetAction("continue", "continue", true),
    hiddenMintSheetAction(),
    hiddenMintSheetAction(),
  ];
};

const getMintSheetActionConfigs = (): [
  MintSheetActionConfig,
  MintSheetActionConfig,
  MintSheetActionConfig,
] => {
  // Keep the legacy mapper referenced until the CLI-only mint commands move to
  // the same presentation model in a follow-up deletion pass.
  void getLegacyMintSheetActionConfigs;
  const actions = getCurrentMintPresentation().actions
    .filter((item) => item.id !== "none")
    .slice(0, 3)
    .map((item): MintSheetActionConfig => ({
      action: item.id,
      label: item.label,
      disabled: item.disabled,
    }));

  return [
    actions[0] ?? hiddenMintSheetAction(),
    actions[1] ?? hiddenMintSheetAction(),
    actions[2] ?? hiddenMintSheetAction(),
  ];
};

const syncMintFlowSteps = (container: HTMLElement) => {
  const presentation = getCurrentMintPresentation();
  const stepMap = {
    select: "path",
    authorize: "sign",
    confirm: "mint",
  } as const;
  const completedSteps = new Set(presentation.completedSteps);

  container.querySelectorAll<HTMLElement>("[data-step]").forEach((step) => {
    const stepId = step.dataset.step ?? "";
    const canonicalStep = stepMap[stepId as keyof typeof stepMap];
    const isActive = canonicalStep === presentation.activeStep;
    step.classList.toggle("is-active", isActive);
    step.classList.toggle("is-complete", Boolean(canonicalStep && completedSteps.has(canonicalStep)));
    if (isActive) {
      step.setAttribute("aria-current", "step");
    } else {
      step.removeAttribute("aria-current");
    }
  });
};

const syncMintSheetFlow = () => {
  syncMintFlowSteps(mintSheetFlow);
};

const getLegacyMintSheetStatusCopy = () => {
  const selectedPathId = mintFlowData.pathId?.toString() ?? mintFlowData.pathIdInput.trim();

  if (mintFlowState === "thought_checking") {
    return "checking uniqueness and mint state.";
  }
  if (mintFlowState === "text_taken") {
    return "This exact THOUGHT is already on-chain; your $PATH was not used.";
  }
  if (mintFlowState === "wallet_required") {
    if (isInjectedWalletMissing()) {
      return "install or enable an injected wallet, then refresh.";
    }
    return walletConnectInFlight ? "opening wallet." : "connect reads address only.";
  }
  if (mintFlowState === "path_required") {
    if (walletState.address && walletState.chainId !== THOUGHT_CHAIN_ID) {
      return PUBLIC_NETWORK_CONFIG.switchNetworkNotice;
    }
    if (pathInventoryMatchesCurrentWallet() && pathInventoryState.status === "loading") {
      return "reading wallet $PATH tokens.";
    }
    if (pathInventoryMatchesCurrentWallet() && (pathInventoryState.status === "unavailable" || pathInventoryState.status === "error")) {
      return "refresh or enter $PATH manually.";
    }
    if (pathInventoryMatchesCurrentWallet() && pathInventoryState.status === "loaded") {
      return availablePathInventoryItems().length > 0
        ? "pick one available $PATH."
        : "mint a $PATH, then return here.";
    }
    if (shouldAutoLoadPathInventory()) {
      return "reading wallet $PATH tokens.";
    }
    return "checking wallet $PATH tokens.";
  }
  if (mintFlowState === "path_checking") {
    return selectedPathId ? `checking $PATH #${selectedPathId}.` : "checking $PATH.";
  }
  if (mintFlowState === "path_ready") {
    return "signature only. does not mint.";
  }
  if (mintFlowState === "authorizing") {
    return "confirm signature in wallet.";
  }
  if (mintFlowState === "authorized") {
    return selectedPathId ? `transaction will consume $PATH #${selectedPathId}.` : "ready to mint.";
  }
  if (mintFlowState === "minting") {
    return walletState.txState === "submitted" || walletState.txHash || mintFlowData.txHash
      ? "waiting for chain confirmation."
      : "confirm transaction in wallet.";
  }
  if (mintFlowState === "minted") {
    return "official token created.";
  }
  if (mintFlowState === "error") {
    if (mintFlowData.errorKind === "wrong_network") {
      return PUBLIC_NETWORK_CONFIG.switchNetworkNotice;
    }
    return visibleMintErrorCopy();
  }
  return "";
};

const getMintSheetStatusCopy = () => {
  void getLegacyMintSheetStatusCopy;
  return getCurrentMintPresentation().stageCopy;
};

const mintReviewNetworkRows = () => [
  { label: "network", value: THOUGHT_ENVIRONMENT_LABEL },
  { label: "chain", value: THOUGHT_CHAIN_NAME },
  { label: "chain id", value: String(THOUGHT_CHAIN_ID) },
  { label: "currency", value: THOUGHT_CURRENCY_LABEL },
];

const cliNetworkReviewRows = () => [
  cliReviewRow("network", THOUGHT_ENVIRONMENT_LABEL),
  cliReviewRow("chain", THOUGHT_CHAIN_NAME),
  cliReviewRow("chain id", String(THOUGHT_CHAIN_ID)),
  cliReviewRow("currency", THOUGHT_CURRENCY_LABEL),
];

const mintReviewContractValue = (label: string, address: string) =>
  address ? `${label} ${shortHex(address, 6, 4)}` : `${label} unavailable`;

const getLegacyMintSheetCopy = () => {
  if (mintFlowState === "wallet_required") {
    if (isInjectedWalletMissing()) {
      return "install or enable an injected wallet.";
    }
    return "reads address only. no signature. no tx.";
  }
  if (mintFlowState === "path_ready" || mintFlowState === "authorizing") {
    return "signature only. does not mint.";
  }
  if (mintFlowState === "authorized" || mintFlowState === "minting") {
    return "mints THOUGHT and consumes $PATH.";
  }
  return "one THOUGHT needs one $PATH.";
};

const getMintSheetCopy = () => {
  void getLegacyMintSheetCopy;
  return getCurrentMintPresentation().detail;
};

const getMintSheetReviewConfig = (): MintSheetReviewConfig => {
  const selectedPathId = mintFlowData.pathId?.toString() ?? mintFlowData.pathIdInput.trim();

  if (mintFlowState === "wallet_required") {
    return {
      note: isInjectedWalletMissing()
        ? "no wallet\ninstall or enable an injected wallet, then refresh."
        : "connect wallet\nreads address only. no signature. no tx.",
      verifyLink: true,
    };
  }

  if (mintFlowState === "path_ready" || mintFlowState === "authorizing") {
    return {
      rows: [
        ...mintReviewNetworkRows(),
        { label: "$PATH", value: selectedPathId ? `#${selectedPathId}` : "-" },
        {
          label: "contract",
          value: mintReviewContractValue("PathNFT", PATH_NFT_ADDRESS),
          href: thoughtAddressUrl(PATH_NFT_ADDRESS),
        },
        {
          label: "signature",
          value: "$PATH mint permission",
        },
        {
          label: "executor",
          value: mintReviewContractValue("ThoughtNFT", THOUGHT_NFT_ADDRESS),
          href: thoughtAddressUrl(THOUGHT_NFT_ADDRESS),
        },
        { label: "ETH sent", value: "0 ETH" },
        { label: "network gas", value: "none" },
        { label: "expires", value: `${Math.floor(Number(PATH_CONSUME_AUTH_TTL_SECONDS) / 3600)} hour` },
      ],
      note: selectedPathId
        ? `sign $PATH permission — 1 of 2\nallows the THOUGHT contract to use one THOUGHT mint from $PATH #${selectedPathId}.\nno transaction. no gas. does not mint yet.`
        : "sign $PATH permission — 1 of 2\nno transaction. no gas. does not mint yet.",
      verifyLink: true,
    };
  }

  if ((mintFlowState === "authorized" || mintFlowState === "minting") && selectedPathId) {
    return {
      rows: [
        ...mintReviewNetworkRows(),
        {
          label: "contract",
          value: mintReviewContractValue("ThoughtNFT", THOUGHT_NFT_ADDRESS),
          href: thoughtAddressUrl(THOUGHT_NFT_ADDRESS),
        },
        {
          label: "function",
          value: "mint(string,uint256,bytes32,bytes32,bytes32,string,uint256,bytes)",
        },
        { label: "$PATH", value: `#${selectedPathId}` },
        { label: "uses", value: "1 THOUGHT mint" },
        { label: "ETH sent", value: "0 ETH" },
        { label: "signature", value: "$PATH signature attached" },
        { label: "network gas", value: "shown in wallet" },
      ],
      note: `mint THOUGHT — 2 of 2\ncreates the token using one THOUGHT mint from $PATH #${selectedPathId}.\nthe $PATH token stays in this wallet. network gas applies.`,
      verifyLink: true,
    };
  }

  return {};
};

const appendMintSheetReviewLink = (
  parent: HTMLElement,
  href: string,
  text: string,
  className = "mint-sheet-review-link",
) => {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
  parent.appendChild(link);
};

type MintReviewRenderClasses = {
  link?: string;
  note?: string;
  review?: string;
  row?: string;
};

const renderMintReviewContent = (
  container: HTMLElement,
  config: MintSheetReviewConfig,
  classes: MintReviewRenderClasses = {},
) => {
  if (config.rows?.length) {
    const review = document.createElement("div");
    review.className = classes.review ?? "mint-sheet-review";
    for (const row of config.rows) {
      const rowElement = document.createElement("div");
      rowElement.className = classes.row ?? "mint-sheet-review-row";
      const label = document.createElement("span");
      label.textContent = row.label;
      const value = document.createElement("strong");
      if (row.href) {
        appendMintSheetReviewLink(value, row.href, `${row.value} ↗`, classes.link ?? "mint-sheet-review-link");
      } else {
        value.textContent = row.value;
      }
      rowElement.append(label, value);
      review.appendChild(rowElement);
    }
    container.appendChild(review);
  }

  if (config.note) {
    const note = document.createElement("div");
    note.className = classes.note ?? "mint-sheet-review-note";
    note.textContent = config.note;
    container.appendChild(note);
  }

  if (config.verifyLink) {
    const verify = document.createElement("div");
    verify.className = classes.note ?? "mint-sheet-review-note";
    appendMintSheetReviewLink(
      verify,
      PATH_VERIFY_CONTRACTS_URL,
      "verify contracts ↗",
      classes.link ?? "mint-sheet-review-link",
    );
    container.appendChild(verify);
  }
};

const syncPathInventoryOptions = (datalist: HTMLDataListElement) => {
  datalist.replaceChildren(
    ...availablePathInventoryItems().map((item) => {
      const option = document.createElement("option");
      option.value = item.pathId.toString();
      option.label = `$PATH #${item.pathId.toString()} ${displayPathInventoryStatus(item.status)}`;
      return option;
    }),
  );
};

const syncPathInventorySelect = (select: HTMLSelectElement) => {
  const available = availablePathInventoryItems();
  const selectedValue = mintFlowData.pathIdInput.trim();
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = "pick a $PATH";
  select.appendChild(placeholder);

  for (const item of available) {
    const option = document.createElement("option");
    option.value = item.pathId.toString();
    option.textContent = `$PATH #${item.pathId.toString()}`;
    select.appendChild(option);
  }

  select.value = available.some((item) => item.pathId.toString() === selectedValue)
    ? selectedValue
    : "";
  placeholder.selected = select.value === "";
  select.disabled = isMintPathInputDisabled();
};

const syncThoughtDockPathInventory = () => {
  const available = availablePathInventoryItems();
  const isVisible = shouldUsePathInventoryPicker() && available.length > 0;
  thoughtDockPathInventory.classList.toggle("is-hidden", !isVisible);

  if (!isVisible) {
    thoughtDockPathInventorySelect.replaceChildren();
    return false;
  }

  thoughtDockPathInventoryLabel.textContent = `available $PATH (${available.length})`;
  syncPathInventorySelect(thoughtDockPathInventorySelect);
  return true;
};

const handlePathInventorySelectChange = (select: HTMLSelectElement) => {
  if (!select.value) {
    applyMintPathInputValue("");
    syncInterface();
    return;
  }
  selectPathInventoryItem(BigInt(select.value));
};

const renderPathInventoryContext = () => {
  if (
    !walletState.address ||
    walletState.chainId !== THOUGHT_CHAIN_ID ||
    (mintFlowState !== "path_required" && !(mintFlowState === "error" && isPathRecoveryError()))
  ) {
    return null;
  }

  const inventory = document.createElement("div");
  inventory.className = "mint-sheet-path-inventory";

  const title = document.createElement("p");
  title.className = "mint-sheet-path-inventory-title";

  const detail = document.createElement("p");
  detail.className = "mint-sheet-path-inventory-detail";

  const inventoryMatchesWallet = pathInventoryMatchesCurrentWallet();
  if (!inventoryMatchesWallet || pathInventoryState.status === "loading" || pathInventoryState.status === "idle") {
    title.textContent = "checking $PATH";
    detail.textContent = "reading wallet $PATH tokens.";
    inventory.append(title, detail);
    return inventory;
  }

  if (pathInventoryState.status === "unavailable" || pathInventoryState.status === "error") {
    title.textContent = "$PATH list unavailable";
    detail.textContent = pathInventoryState.error || "refresh or enter $PATH manually.";
    inventory.append(title, detail);
    return inventory;
  }

  if (pathInventoryState.status !== "loaded") {
    return null;
  }

  const available = availablePathInventoryItems();
  if (available.length > 0) {
    return null;
  }

  title.textContent = available.length > 0 ? "$PATH" : pathInventoryState.items.length ? "no available $PATH" : "no $PATH found";
  detail.textContent = pathInventoryState.items.length
    ? "wallet $PATH tokens found, but none have an available THOUGHT mint. mint a $PATH to get one."
    : "mint a $PATH first, then return here.";
  inventory.append(title, detail);
  return inventory;
};

const renderMintContext = (container: HTMLElement, options: { includeWalletReview?: boolean } = {}) => {
  const config = getMintSheetReviewConfig();
  container.replaceChildren();

  const inventory = renderPathInventoryContext();
  if (inventory) {
    container.appendChild(inventory);
  }

  if (options.includeWalletReview !== false) {
    renderMintReviewContent(container, config);
  }

  container.classList.toggle("is-hidden", container.childNodes.length === 0);
};

const renderMintSheetContext = () => {
  renderMintContext(mintSheetContext);
};

const getMintSheetProvenanceCopy = () => {
  if (!mintFlowData.provenanceJson) {
    return "";
  }

  return formatProvenanceBytes(byteLength(mintFlowData.provenanceJson));
};

const syncMintSheetButton = (
  button: HTMLButtonElement,
  config: MintSheetActionConfig,
) => {
  button.textContent = config.label;
  button.disabled = !!config.disabled;
  button.classList.toggle("is-hidden", !!config.hidden);
};

const getMintDockPathActionConfigs = (): [
  MintSheetActionConfig,
  MintSheetActionConfig,
  MintSheetActionConfig,
] => {
  const actions = getMintSheetActionConfigs()
    .filter((config) => config.action !== "enter_path_manually" && config.action !== "continue");
  return [
    actions[0] ?? hiddenMintSheetAction(),
    actions[1] ?? hiddenMintSheetAction(),
    actions[2] ?? hiddenMintSheetAction(),
  ];
};

const syncMintSheet = () => {
  const isOpen = mintFlowUiMode === "sheet" && mintFlowState !== "closed";
  mintSheetBackdrop.classList.toggle("is-hidden", !isOpen);
  mintSheet.classList.toggle("is-hidden", !isOpen);

  if (!isOpen) {
    return;
  }

  mintSheetTitle.textContent = "mint THOUGHT";
  mintSheetCopy.textContent = getMintSheetCopy();
  syncMintSheetFlow();

  const pathInputVisible = isMintPathFieldVisible();
  const pathSelectVisible = pathInputVisible && shouldUsePathInventoryPicker();
  const manualPathVisible = pathInputVisible && shouldRevealManualPathInput();
  const pathFieldVisible = pathSelectVisible || manualPathVisible;
  mintSheetPathField.classList.toggle("is-hidden", !pathFieldVisible);
  mintSheetPathBox.classList.toggle("is-hidden", pathSelectVisible);
  mintSheetPathSelect.classList.toggle("is-hidden", !pathSelectVisible);
  mintSheetPathBox.value = mintFlowData.pathIdInput;
  mintSheetPathBox.disabled = isMintPathInputDisabled() || pathSelectVisible;
  syncPathInventoryOptions(mintSheetPathOptions);
  syncPathInventorySelect(mintSheetPathSelect);

  const provenanceCopy = pathInputVisible ? getMintSheetProvenanceCopy() : "";
  mintSheetProvenance.textContent = provenanceCopy;
  mintSheetProvenance.classList.toggle("is-hidden", !provenanceCopy);

  mintSheetStatus.textContent = getMintSheetStatusCopy();
  renderMintSheetContext();
  maybeLoadPathInventory();
  const [primary, secondary, tertiary] = getMintSheetActionConfigs();
  mintSheetPrimaryAction = primary.action;
  mintSheetSecondaryAction = secondary.action;
  mintSheetTertiaryAction = tertiary.action;
  syncMintSheetButton(mintSheetPrimary, primary);
  syncMintSheetButton(mintSheetSecondary, secondary);
  syncMintSheetButton(mintSheetTertiary, tertiary);
};

const syncMintDockPathPanel = () => {
  const isVisible = mintDockRevealed;

  if (!isVisible) {
    thoughtDockPath.classList.add("is-hidden");
    return;
  }

  const presentation = getCurrentMintPresentation();
  thoughtDockPathTitle.dataset.tone = presentation.tone;
  if (presentation.tone === "running") {
    appendThoughtProgressEllipsis(thoughtDockPathTitle, presentation.title, true);
  } else {
    thoughtDockPathTitle.textContent = presentation.title;
  }

  const pathInventoryVisible = syncThoughtDockPathInventory();
  const hideRedundantPathStatus =
    (mintFlowState === "path_required" && pathInventoryVisible) ||
    mintFlowState === "path_ready";
  thoughtDockMintStep.classList.toggle("is-hidden", hideRedundantPathStatus);

  maybeLoadPathInventory();
  syncMintFlowSteps(thoughtDockPathFlow);

  const [primary, secondary, tertiary] = getMintDockPathActionConfigs();
  mintSheetPrimaryAction = primary.action;
  mintSheetSecondaryAction = secondary.action;
  mintSheetTertiaryAction = tertiary.action;
  syncMintSheetButton(thoughtDockPathPrimary, primary);
  syncMintSheetButton(thoughtDockPathSecondary, secondary);
  syncMintSheetButton(thoughtDockPathTertiary, tertiary);
  thoughtDockPath.classList.remove("is-hidden");
};

const syncWorkLibraryPanel = () => {
  if (!workLibraryRevealed) {
    thoughtDockWorks.classList.add("is-hidden");
    return;
  }

  const works = [...readStoredThoughtWorks()].reverse();
  thoughtDockWorksLabel.textContent = "load a saved work";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = works.length ? "load a saved work" : "no saved works";
  const options = works.map((work) => {
    const option = document.createElement("option");
    option.value = String(work.id);
    option.textContent = formatSavedWorkPromptLabel(work.prompt || work.runContext.prompt);
    option.title = work.prompt || work.runContext.prompt;
    return option;
  });
  thoughtDockWorksSelect.replaceChildren(placeholder, ...options);
  const selectedId = currentWorkId === null ? "" : String(currentWorkId);
  thoughtDockWorksSelect.value = works.some((work) => String(work.id) === selectedId)
    ? selectedId
    : "";
  placeholder.selected = thoughtDockWorksSelect.value === "";
  thoughtDockWorksSelect.disabled = works.length === 0;
  thoughtDockWorks.classList.remove("is-hidden");
};

const syncWalletMenu = () => {};

const syncThoughtInstructionsControls = () => {
  thoughtFileField.classList.toggle("is-hidden", !ENABLE_THOUGHT_UPLOAD);
  thoughtFileStatus.textContent = `using ${getActiveThoughtInstructionsLabel()}.`;
  syncThoughtInstructionsLink();
  clearThoughtFileButton.classList.toggle(
    "is-hidden",
    !ENABLE_THOUGHT_UPLOAD || !thoughtInstructionsOverride,
  );
};

const syncPrimaryCtaAvailability = () => {
  const action = getActionPresentation();
  primaryActionState = action.primaryAction;
  secondaryActionState = action.secondaryAction;
  runAgentButton.disabled = action.primaryDisabled;
};

const refreshMintPreflight = async () => {
  walletState.preflightLoading = true;
  walletState.preflightError = "";
  syncPrimaryCtaAvailability();

  const provider = getReadProvider();

  if (!provider || !THOUGHT_NFT_ADDRESS) {
    walletState.balance = null;
    walletState.preflightLoading = false;
    walletState.preflightError = "mint contract not configured.";
    syncPrimaryCtaAvailability();
    syncWalletMenu();
    return;
  }

  try {
    walletState.balance = walletState.address ? await provider.getBalance(walletState.address) : null;
    walletState.preflightError = "";
  } catch (error) {
    walletState.balance = null;
    walletState.preflightError =
      error instanceof Error ? error.message : "mint preflight failed.";
  } finally {
    walletState.preflightLoading = false;
    syncPrimaryCtaAvailability();
    syncWalletMenu();
  }
};

const refreshWalletState = async () => {
  const previousAddress = walletState.address;
  const previousChainId = walletState.chainId;
  const sharedWallet = getThoughtShellWallet();
  const ethereum = getEthereumProvider();
  walletState.detected = sharedWallet.ready
    ? sharedWallet.connectorCount > 0 || sharedWallet.provider !== null
    : ethereum !== null;

  if (sharedWallet.ready && sharedWallet.address) {
    walletDisconnectedByUser = false;
  }

  if (walletDisconnectedByUser) {
    walletState.address = "";
    walletState.chainId = null;
  } else if (sharedWallet.ready) {
    walletState.address = sharedWallet.address;
    walletState.chainId = sharedWallet.chainId;
  } else if (!ethereum) {
    walletState.address = "";
    walletState.chainId = null;
  } else {
    try {
      const [accounts, chainHex] = await Promise.all([
        ethereum.request({ method: "eth_accounts" }),
        ethereum.request({ method: "eth_chainId" }),
      ]);

      walletState.address =
        Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      walletState.chainId =
        typeof chainHex === "string" && chainHex.length > 0 ? Number(BigInt(chainHex)) : null;
    } catch {
      walletState.address = "";
      walletState.chainId = null;
    }
  }

  if (
    walletStateHydrated &&
    (walletState.address !== previousAddress || walletState.chainId !== previousChainId)
  ) {
    resetPathInventoryState();
    if (pendingMintTransaction) {
      emitThoughtConsoleEvent({
        kind: "wallet_changed_after_submission",
        title: "wallet changed",
        detail: `Active wallet: ${walletState.address ? shortHex(walletState.address) : "disconnected"} on chain ${walletState.chainId ?? "none"}. Mint from ${shortHex(pendingMintTransaction.account)} keeps tracking.`,
      });
    } else {
      mintAttemptId = nextMintAttemptId("wallet");
      clearMintPathSelection();
      if (mintFlowState !== "closed" && mintFlowState !== "wallet_required") {
        if (!walletState.address) {
          mintFlowState = "wallet_required";
          mintFlowData.error = "";
          mintFlowData.errorKind = "none";
        } else if (walletState.chainId !== THOUGHT_CHAIN_ID) {
          mintFlowState = "error";
          mintFlowData.error = "wrong network.";
          mintFlowData.errorKind = "wrong_network";
        } else {
          mintFlowState = "path_required";
          mintFlowData.error = "";
          mintFlowData.errorKind = "none";
        }
      }
      recordThoughtConsoleContextBoundary();
      if (mintFlowState !== "closed") {
        recordCurrentMintConsoleState();
      }
    }
  }

  walletStateHydrated = true;
  await refreshMintPreflight();
};

async function refreshThoughtWalletFromShell() {
  const shouldValidateSelectedPath =
    mintFlowState === "path_required" ||
    mintFlowState === "path_ready" ||
    (mintFlowState === "error" && isPathRecoveryError());

  await refreshWalletState();
  syncMintFlowAfterWalletCommand();

  const pathHandoff = readPathMintHandoff();
  const pathReturn = pathHandoff
    ? readPathMintReturnRecord(getPathMintReturnStorageHost(), pathHandoff.attemptId)
    : null;
  if (pathHandoff && (pathReturn || mintFlowData.errorKind === "wallet_account_mismatch")) {
    await resumePathMintHandoff();
    syncInterface();
    return;
  }

  if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID) {
    await refreshPathInventoryForCurrentWallet({ force: true });
    if (shouldValidateSelectedPath && canContinueWithPathInput()) {
      await checkPathEligibility();
      return;
    }
    if (mintFlowState === "error" && isPathRecoveryError()) {
      moveMintFlowToWalletOrPathSelection();
    }
  }

  syncInterface();
}

const bindThoughtShellWallet = () => {
  if (thoughtShellWalletSubscribed) {
    return;
  }

  thoughtShellWalletSubscribed = true;
  subscribeThoughtShellWallet((snapshot) => {
    if (!snapshot.ready || thoughtShellWalletRefreshQueued) {
      return;
    }

    if (snapshot.address) {
      walletDisconnectedByUser = false;
    }
    thoughtShellWalletRefreshQueued = true;
    window.queueMicrotask(() => {
      thoughtShellWalletRefreshQueued = false;
      void refreshWalletState().then(() => {
        syncMintFlowAfterWalletCommand();
        syncInterface();
      });
    });
  });
};

const bindWalletProviderEvents = () => {
  if (walletListenersBound) {
    return;
  }

  const providers = getInjectedProviders().filter((provider) => typeof provider.on === "function");
  if (providers.length === 0) {
    return;
  }

  const handleWalletChange = () => {
    void refreshWalletState().then(() => {
      syncInterface();
    });
  };

  providers.forEach((provider) => {
    provider.on?.("accountsChanged", handleWalletChange);
    provider.on?.("chainChanged", handleWalletChange);
  });
  walletListenersBound = true;
};

const pendingMintIdentityMatches = (
  left: PendingMintTransaction,
  right: PendingMintTransaction,
) =>
  left.account === right.account &&
  left.chainId === right.chainId &&
  left.thoughtNft === right.thoughtNft &&
  left.workHash === right.workHash &&
  left.pathId === right.pathId &&
  left.nonce === right.nonce;

const bindPendingMintStorageEvents = () => {
  if (pendingMintStorageListenerBound) {
    return;
  }
  pendingMintStorageListenerBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key === THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY) {
      conflictingMintTransactions = [
        ...parseConflictingMintTransactions(event.newValue),
      ];
      if (pendingMintTransaction) {
        projectPendingMintTransaction(pendingMintTransaction, {
          deploymentWarning: !isPendingMintDeploymentCompatible(pendingMintTransaction),
        });
      }
      resumeConflictingMintReceiptMonitoring();
      recordCurrentMintConsoleState();
      syncInterface();
      return;
    }
    if (event.key !== THOUGHT_PENDING_MINT_TX_STORAGE_KEY || event.newValue === null) {
      // A different tab may clear storage after confirmation; this tab keeps its live
      // hash until its own receipt monitor verifies the terminal receipt.
      return;
    }
    const incoming = parsePendingMintTransaction(event.newValue);
    if (!incoming) {
      return;
    }
    if (
      pendingMintTransaction &&
      !pendingMintTransactionMatches(pendingMintTransaction, incoming.hash) &&
      !pendingMintIdentityMatches(pendingMintTransaction, incoming)
    ) {
      return;
    }
    if (
      pendingMintTransaction &&
      !pendingMintTransactionMatches(pendingMintTransaction, incoming.hash)
    ) {
      appendConflictingMintTransaction(pendingMintTransaction);
    }
    pendingMintTransaction = incoming;
    projectPendingMintTransaction(incoming, {
      deploymentWarning: !isPendingMintDeploymentCompatible(incoming),
    });
    recordCurrentMintConsoleState();
    syncInterface();
    if (isPendingMintDeploymentCompatible(incoming)) {
      resumePendingMintReceiptMonitoring();
    }
    resumeConflictingMintReceiptMonitoring();
  });
};

const walletConnectionConsoleFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (code === "4001" || /reject|denied|cancel/i.test(message)) {
    return { title: "wallet connection canceled", detail: "nothing changed" };
  }
  if (code === "-32002" || /already.*(?:pending|open)|request.*pending/i.test(message)) {
    return { title: "wallet request already open", detail: "finish or cancel it in your wallet" };
  }
  return { title: "wallet not connected", detail: "try connecting again" };
};

const requestWalletConnect = async () => {
  const sharedWallet = getThoughtShellWallet();
  if (sharedWallet.ready) {
    trackThoughtAnalytics("wallet_connect_started", {
      walletKind: "shared_shell",
      walletStage: "connector",
    });
    walletDisconnectedByUser = false;
    setWarning("");
    walletConnectInFlight = true;
    if (mintFlowState !== "closed") {
      emitThoughtConsoleEvent({
        kind: "wallet_connection_requested",
        title: "wallet connection requested",
        detail: "finish or cancel the request in your wallet",
      });
    }
    syncInterface();

    try {
      await sharedWallet.connect();
      const startedAt = Date.now();
      while (!getThoughtShellWallet().address && Date.now() - startedAt < 18000) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 100);
        });
      }
      await refreshWalletState();
      if (!walletState.address) {
        throw new Error("wallet did not expose an account.");
      }
      setStatus("wallet connected.", { flashMs: NOTICE_FLASH_MS });
      trackThoughtAnalytics("wallet_connect_succeeded", {
        walletKind: "shared_shell",
        walletStage: "connected",
      });
    } catch (error) {
      trackThoughtAnalytics("wallet_connect_failed", {
        walletKind: "shared_shell",
        walletStage: "connector",
        errorCategory: thoughtAnalyticsErrorCategory(error),
      });
      const message = error instanceof Error ? error.message : "wallet connect failed.";
      setWarning(message);
      setStatus("");
      if (mintFlowState !== "closed") {
        const consoleFailure = walletConnectionConsoleFailure(error);
        emitThoughtConsoleEvent({
          kind: "wallet_connection_failed",
          ...consoleFailure,
          tone: "warning",
        });
      }
    } finally {
      walletConnectInFlight = false;
      syncInterface();
    }
    return;
  }

  trackThoughtAnalytics("wallet_connect_started", {
    walletKind: "injected",
    walletStage: "request_accounts",
  });
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    trackThoughtAnalytics("wallet_connect_failed", {
      walletKind: "injected",
      walletStage: "request_accounts",
      errorCategory: "wallet_missing",
    });
    setWarning("No supported wallet found.", { level: "warn" });
    setStatus("");
    return;
  }

  walletDisconnectedByUser = false;
  setWarning("");
  walletConnectInFlight = true;
  if (mintFlowState !== "closed") {
    emitThoughtConsoleEvent({
      kind: "wallet_connection_requested",
      title: "wallet connection requested",
      detail: "finish or cancel the request in your wallet",
    });
  }
  syncInterface();

  try {
    const existingAccount = extractPrimaryAccount(await ethereum.request({ method: "eth_accounts" }));

    if (!existingAccount) {
      let requestError: unknown = null;
      const requestAccounts = ethereum
        .request({ method: "eth_requestAccounts" })
        .then((accounts) => extractPrimaryAccount(accounts))
        .catch((error) => {
          requestError = error;
          return "";
        });

      const detectedAccount = await Promise.race([
        requestAccounts,
        waitForWalletAddress(ethereum),
      ]);

      if (!detectedAccount) {
        const requestedAccount = await requestAccounts;
        if (!requestedAccount && requestError) {
          throw requestError;
        }
      }
    }

    await refreshWalletState();

    if (!walletState.address) {
      throw new Error("wallet did not expose an account.");
    }

    syncInterface();
    setStatus("wallet connected.", { flashMs: NOTICE_FLASH_MS });
    trackThoughtAnalytics("wallet_connect_succeeded", {
      walletKind: "injected",
      walletStage: "connected",
    });
  } catch (error) {
    trackThoughtAnalytics("wallet_connect_failed", {
      walletKind: "injected",
      walletStage: "request_accounts",
      errorCategory: thoughtAnalyticsErrorCategory(error),
    });
    const message = error instanceof Error ? error.message : "wallet connect failed.";
    setWarning(message);
    setStatus("");
    if (mintFlowState !== "closed") {
      const consoleFailure = walletConnectionConsoleFailure(error);
      emitThoughtConsoleEvent({
        kind: "wallet_connection_failed",
        ...consoleFailure,
        tone: "warning",
      });
    }
  } finally {
    walletConnectInFlight = false;
    syncInterface();
  }
};

const switchWalletChain = async () => {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    setWarning("No supported wallet found.", { level: "warn" });
    setStatus("");
    return;
  }

  setWarning("");
  setStatus("");

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: THOUGHT_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: unknown }).code)
        : null;

    if (errorCode === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: THOUGHT_CHAIN_ID_HEX,
            chainName: THOUGHT_CHAIN_NAME,
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: THOUGHT_WALLET_RPC_URLS,
            blockExplorerUrls: THOUGHT_EXPLORER_BASE_URL ? [THOUGHT_EXPLORER_BASE_URL] : [],
          },
        ],
      });
    } else {
      const message = error instanceof Error ? error.message : "wallet switch failed.";
      setWarning(message);
      setStatus("");
      return;
    }
  }

  await refreshWalletState();
  syncInterface();
  setStatus("chain ready.", { flashMs: NOTICE_FLASH_MS });
};

const disconnectThoughtDockWallet = (options?: { appendCli?: boolean }) => {
  const trackedMint = adoptDurablePendingMintTransaction();
  const keepsSubmittedMint = Boolean(trackedMint);
  const sharedWallet = getThoughtShellWallet();
  if (sharedWallet.ready) {
    void sharedWallet.disconnect();
  }
  walletDisconnectedByUser = true;
  walletState.address = "";
  walletState.chainId = null;
  walletState.balance = null;
  walletState.preflightLoading = false;
  walletState.preflightError = "";
  if (!trackedMint) {
    resetPathInventoryState();
    clearMintPathSelection();
  }

  if (!keepsSubmittedMint) {
    mintAttemptId = nextMintAttemptId("wallet");
  }

  if (!trackedMint && mintFlowState !== "closed" && mintFlowState !== "minted") {
    mintFlowState = "wallet_required";
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
  }

  if (options?.appendCli) {
    appendCliOutput([
      "wallet disconnected.",
      "disconnected in THOUGHT. disconnect this site in your wallet to fully revoke access.",
      "use: wallet connect",
    ]);
  } else {
    setStatus("wallet disconnected.", { flashMs: NOTICE_FLASH_MS });
  }

  if (keepsSubmittedMint && trackedMint) {
    projectPendingMintTransaction(trackedMint, {
      deploymentWarning: !isPendingMintDeploymentCompatible(trackedMint),
    });
    emitThoughtConsoleEvent({
      kind: "wallet_changed_after_submission",
      title: "wallet disconnected",
      detail: `Mint from ${shortHex(trackedMint.account)} on chain ${trackedMint.chainId} keeps tracking.`,
    });
  } else {
    recordThoughtConsoleContextBoundary();
    if (mintFlowState !== "closed") recordCurrentMintConsoleState();
  }

  syncInterface();
};

const refreshWalletChainRpc = async () => {
  const ethereum = getEthereumProvider();
  if (!ethereum || THOUGHT_WALLET_RPC_URLS.length === 0) {
    return false;
  }

  try {
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: THOUGHT_CHAIN_ID_HEX,
          chainName: THOUGHT_CHAIN_NAME,
          nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: THOUGHT_WALLET_RPC_URLS,
          blockExplorerUrls: THOUGHT_EXPLORER_BASE_URL ? [THOUGHT_EXPLORER_BASE_URL] : [],
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
};

const extractMintedTokenId = (receipt: { logs?: readonly { topics: readonly string[]; data: string }[] }) => {
  const contract = getReadThoughtNFT();
  if (!contract) {
    return null;
  }

  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "ThoughtMinted") {
        return Number(parsed.args[0]);
      }
    } catch {
      continue;
    }
  }

  return null;
};

const lookupExistingThoughtToken = async (token: Contract, agentLineHash: string) =>
  IS_LOCAL_THOUGHT_V2
    ? token.tokenOfAgentLineHash(agentLineHash) as Promise<bigint>
    : token.tokenOfThought(agentLineHash) as Promise<bigint>;

const preflightCurrentThoughtExistence = async () => {
  if (!currentOutputText || runState !== "output_ready") {
    return;
  }

  const requestId = thoughtExistenceCheckRequestId + 1;
  thoughtExistenceCheckRequestId = requestId;
  const checkedText = currentOutputText;

  try {
    await verifyLocalThoughtV2Deployment();
    const textHash = await textHashFromContract(checkedText);
    const token = getReadThoughtNFT();
    if (!token) return;
    const existingTokenId = await lookupExistingThoughtToken(token, textHash);
    if (
      requestId !== thoughtExistenceCheckRequestId ||
      currentOutputText !== checkedText ||
      runState !== "output_ready" ||
      mintFlowState !== "closed"
    ) {
      return;
    }
    if (existingTokenId === 0n) {
      return;
    }

    mintFlowData.rawText = checkedText;
    mintFlowData.textHash = textHash;
    mintFlowData.existingTokenId = Number(existingTokenId);
    mintFlowData.error = "";
    mintFlowData.errorKind = "none";
    mintFlowState = "text_taken";
    recordCurrentMintConsoleState();
    syncInterface();
  } catch {
    // Background verification is opportunistic. Mint click retries it before PICK.
  }
};

const handlePendingTx = async () => {
  if (!walletState.txHash) {
    return;
  }

  const copied = await copyToClipboard(walletState.txHash);
  if (copied) {
    setStatus("tx hash copied.", { flashMs: NOTICE_FLASH_MS });
  }
};

const openMintFlow = async (
  uiMode: MintFlowUiMode = THOUGHT_PANEL_MINT_UI_MODE,
  options?: { attemptId?: string; pathId?: string; work?: ThoughtMintWorkSnapshot },
) => {
  const trackedMint = adoptDurablePendingMintTransaction();
  if (trackedMint) {
    projectPendingMintTransaction(trackedMint, {
      deploymentWarning: !isPendingMintDeploymentCompatible(trackedMint),
    });
    recordCurrentMintConsoleState();
    syncInterface();
    if (isPendingMintDeploymentCompatible(trackedMint)) {
      resumePendingMintReceiptMonitoring();
    }
    return;
  }
  const mintWork = options?.work ?? captureCurrentMintWork();
  if (!mintWork) {
    return;
  }
  resetMintFlow({ preserveAttempt: true });
  activeMintWork = mintWork;
  mintAttemptId = options?.attemptId?.trim() || nextMintAttemptId("mint");
  mintFlowData.pathIdInput = options?.pathId?.trim() ?? "";
  mintFlowUiMode = uiMode;

  if (!THOUGHT_V2_MINT_ENABLED) {
    setMintFlowError(THOUGHT_V2_MINT_UNAVAILABLE_COPY, "thought");
    syncInterface();
    return;
  }
  if (currentCandidate && runState === "candidate_ready") {
    setMintFlowError("current candidate is not previewed.", "thought");
    syncInterface();
    return;
  }

  if (!mintWork.svg.trim().startsWith("<svg")) {
    setMintFlowError("contract SVG missing.", "thought");
    syncInterface();
    return;
  }

  mintFlowData.rawText = mintWork.text;
  mintFlowData.promptHash = hashText(mintWork.runContext.prompt);
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  mintFlowData.txHash = "";
  walletState.txState = "idle";
  walletState.txError = "";
  mintFlowState = "thought_checking";
  syncInterface();

  try {
    await verifyLocalThoughtV2Deployment();
  } catch (error) {
    setMintFlowError(
      error instanceof Error ? error.message : "local THOUGHT V2 deployment unavailable.",
      "thought",
    );
    syncInterface();
    return;
  }

  try {
    mintFlowData.textHash = await textHashFromContract(mintWork.text);
  } catch {
    setMintFlowError("text preview unavailable.", "thought");
    syncInterface();
    return;
  }

  if (byteLength(mintFlowData.rawText) > MAX_TEXT_BYTES) {
    setMintFlowError("THOUGHT too large.", "thought");
    syncInterface();
    return;
  }

  let spec: ActiveThoughtSpec;
  try {
    spec = await ensureActiveThoughtSpec();
    syncThoughtInstructionsControls();
  } catch (error) {
    const message = formatThoughtSpecError(error);
    setMintFlowError(message, message.includes("THOUGHT.md") ? "spec" : "thought");
    syncInterface();
    return;
  }

  mintFlowData.thoughtSpecId = spec.specId;
  mintFlowData.thoughtSpecHash = spec.specHash;
  if (IS_LOCAL_THOUGHT_V2) {
    mintFlowData.provenanceJson = "";
  } else {
    const provenanceJson = buildProvenanceJson(mintFlowData.textHash, undefined, mintWork);
    const provenanceBytes = byteLength(provenanceJson);
    if (provenanceBytes > MAX_PROVENANCE_BYTES) {
      setMintFlowError(provenanceTooLargeMessage(provenanceBytes), "thought");
      syncInterface();
      return;
    }
    mintFlowData.provenanceJson = provenanceJson;
  }

  const token = getReadThoughtNFT();
  if (!token) {
    setMintFlowError("mint unavailable.", "thought");
    syncInterface();
    return;
  }

  try {
    if (!await verifyThoughtSpecAnchor()) {
      setMintFlowError("spec mismatch.", "spec");
      syncInterface();
      return;
    }

    const existingTokenId = await lookupExistingThoughtToken(token, mintFlowData.textHash);
    if (existingTokenId !== 0n) {
      mintFlowData.existingTokenId = Number(existingTokenId);
      mintFlowState = "text_taken";
      recordCurrentMintConsoleState();
      syncInterface();
      return;
    }

    if (!mintFlowData.pathIdInput && PRESELECTED_PATH_ID) {
      mintFlowData.pathIdInput = PRESELECTED_PATH_ID;
    }

    mintFlowData.pathId = parsePathTokenId(mintFlowData.pathIdInput);
    await refreshWalletState();
    const pathSelectionReady = moveMintFlowToWalletOrPathSelection();
    syncInterface();
    if (pathSelectionReady) {
      focusMintPathInput();
    }
  } catch {
    setMintFlowError("mint unavailable.", "thought");
    syncInterface();
  }
};

type PathEligibilityResult =
  | { ok: true }
  | { ok: false; kind: MintFlowErrorKind; message: string };

const readPathEligibility = async (
  pathId: bigint,
  address: string,
): Promise<PathEligibilityResult> => {
  const pathNft = getReadPathNft();
  if (!pathNft) {
    return { ok: false, kind: "thought", message: "mint unavailable." };
  }

  try {
    const owner = (await pathNft.ownerOf(pathId)) as string;
    const [authorizedMinter, stage, stageMinted, movementQuota] = await Promise.all([
      pathNft.getAuthorizedMinter(PATH_MOVEMENT_THOUGHT) as Promise<string>,
      pathNft.getStage(pathId) as Promise<bigint>,
      pathNft.getStageMinted(pathId) as Promise<bigint>,
      pathNft.getMovementQuota(PATH_MOVEMENT_THOUGHT) as Promise<bigint>,
    ]);
    if (owner.toLowerCase() !== address.toLowerCase()) {
      return {
        ok: false,
        kind: "path_not_found",
        message: `wallet does not hold $PATH #${pathId.toString()}.`,
      };
    }
    if (
      authorizedMinter.toLowerCase() !== THOUGHT_NFT_ADDRESS.toLowerCase() ||
      movementQuota === 0n
    ) {
      return {
        ok: false,
        kind: "path_not_ready",
        message: `$PATH #${pathId.toString()} not ready for THOUGHT.`,
      };
    }
    if (stage !== 0n || stageMinted >= movementQuota) {
      return {
        ok: false,
        kind: "path_consumed",
        message: `$PATH #${pathId.toString()} has no THOUGHT mint available.`,
      };
    }
    return { ok: true };
  } catch (error) {
    const notFound = error instanceof Error && /invalid token|nonexistent|erc721|owner query/i.test(error.message);
    return {
      ok: false,
      kind: notFound ? "path_not_found" : "path_unknown",
      message: notFound
        ? `wallet does not hold $PATH #${pathId.toString()}.`
        : `$PATH #${pathId.toString()} status unknown.`,
    };
  }
};

const checkPathEligibility = async () => {
  clearMintAuthorization();
  walletState.txState = "idle";
  walletState.txError = "";

  if (!PATH_NFT_ADDRESS || !THOUGHT_NFT_ADDRESS) {
    setMintFlowError("mint unavailable.", "thought");
    syncInterface();
    focusMintDockStage();
    return;
  }

  const ethereum = getEthereumProvider();
  if (!ethereum) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  await refreshWalletState();

  if (!walletState.address) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    setMintFlowError("wrong network.", "wrong_network");
    syncInterface();
    focusMintDockStage();
    return;
  }

  const pathId = parsePathTokenId(mintFlowData.pathIdInput);
  if (pathId === null) {
    setMintFlowError("enter a valid $PATH #.", "path_invalid");
    syncInterface();
    focusMintDockStage();
    return;
  }

  mintFlowData.pathId = pathId;
  mintFlowState = "path_checking";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  syncInterface();

  const eligibility = await readPathEligibility(pathId, walletState.address);
  if (!eligibility.ok) {
    setMintFlowError(eligibility.message, eligibility.kind);
    syncInterface();
    focusMintDockStage();
    return;
  }

  try {
    await rebuildFinalMintProvenance();
  } catch (error) {
    const presentation = formatThoughtAuthorizationError(error, "preparing");
    setMintFlowError(presentation.message, presentation.kind);
    syncInterface();
    focusMintDockStage();
    return;
  }

  mintFlowState = "path_ready";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  recordCurrentMintConsoleState();
  syncInterface();
  focusMintDockStage();
};

const authorizeMint = async () => {
  if (mintAuthorizationInFlight) {
    return;
  }
  if (blockPendingMintMutation()) {
    return;
  }
  if (!getEthereumProvider() || !walletState.address || mintFlowData.pathId === null) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  mintAuthorizationInFlight = true;
  const expectedAddress = walletState.address;
  const expectedPathId = mintFlowData.pathId;
  const requestId = mintAuthorizationRequestId + 1;
  mintAuthorizationRequestId = requestId;
  let authorizationStage: ThoughtAuthorizationStage = "wallet";
  mintFlowState = "authorizing";
  walletState.txError = "";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  recordCurrentMintConsoleState();
  syncInterface();
  setWarning("");
  setStatus("");

  try {
    const ethereum = getEthereumProvider();
    if (!ethereum) {
      throw new Error("wallet not connected");
    }
    const [liveAccounts, liveChainHex] = await withTimeout(
      Promise.all([
        ethereum.request({ method: "eth_accounts" }),
        ethereum.request({ method: "eth_chainId" }),
      ]),
      PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS,
      "wallet status request timed out.",
    );
    if (requestId !== mintAuthorizationRequestId) return;
    const liveAddress = extractPrimaryAccount(liveAccounts);
    const liveChainId =
      typeof liveChainHex === "string" && liveChainHex.length > 0
        ? Number(BigInt(liveChainHex))
        : null;
    if (!liveAddress) {
      throw new Error("wallet not connected");
    }
    if (liveChainId !== THOUGHT_CHAIN_ID) {
      throw new Error("wrong network");
    }
    if (liveAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error("wallet account changed");
    }
    if (mintFlowData.pathId !== expectedPathId) return;

    const browserProvider = new BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner(expectedAddress);
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error("wallet account changed");
    }
    const consumeAuth = await signPathConsumeAuthorization(
      signer,
      signerAddress,
      expectedPathId,
      (stage) => {
        authorizationStage = stage;
      },
    );
    if (requestId !== mintAuthorizationRequestId) return;
    mintFlowData.deadline = consumeAuth.deadline;
    mintFlowData.signature = consumeAuth.signature;
    mintFlowState = "authorized";
    recordCurrentMintConsoleState();
  } catch (error) {
    if (requestId !== mintAuthorizationRequestId) return;
    const presentation = formatThoughtAuthorizationError(error, authorizationStage);
    setMintFlowError(presentation.message, presentation.kind);
    syncInterface();
    focusMintDockStage();
    return;
  } finally {
    mintAuthorizationInFlight = false;
  }

  syncInterface();
  focusMintDockStage();
};

type MintTransactionResponse = {
  hash: string;
  nonce?: number;
  from?: string;
  wait: () => Promise<MintReceipt | null>;
};

type MintReceipt = {
  status?: unknown;
  logs?: readonly { topics: readonly string[]; data: string }[];
};

type MintReceiptResult = Readonly<{
  hash: string;
  receipt: MintReceipt;
}>;

const mintErrorMessage = (error: unknown) => {
  const errorName =
    typeof error === "object" && error !== null && "errorName" in error
      ? String((error as { errorName?: unknown }).errorName ?? "")
      : "";
  const shortMessage =
    typeof error === "object" && error !== null && "shortMessage" in error
      ? String((error as { shortMessage?: unknown }).shortMessage ?? "")
      : "";
  const message = error instanceof Error ? error.message : shortMessage;

  if (
    errorName === "AgentLineAlreadyMinted" ||
    /AgentLineAlreadyMinted/i.test(message)
  ) {
    return "this exact Agent line is already minted.";
  }
  if (errorName === "ThoughtAlreadyMinted" || /ThoughtAlreadyMinted/i.test(message)) {
    return "this exact THOUGHT is already on-chain.";
  }
  if (/expired/i.test(message)) {
    return "$PATH signature expired.";
  }
  if (/eth_sendRawTransaction|RPC method is not allowed/i.test(message)) {
    return "wallet RPC is read-only. Update the current chain RPC in wallet and retry.";
  }
  if (/rejected|denied|cancel/i.test(message)) {
    return "transaction rejected.";
  }
  if (/not submitted|timed out|timeout/i.test(message)) {
    return "wallet transaction not submitted.";
  }
  if (/BAD_MOVEMENT_ORDER|QUOTA_EXHAUSTED/i.test(message)) {
    return "$PATH has no THOUGHT mint available.";
  }
  if (/BAD_CONSUME_AUTH/i.test(message)) {
    return "$PATH signature expired.";
  }
  if (/ERR_NOT_OWNER/i.test(message)) {
    return "wallet does not hold this $PATH.";
  }
  return shortMessage || message || "mint failed.";
};

const sleep = (ms: number) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const mintReceiptFromUnknown = (value: unknown): MintReceipt | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as { status?: unknown; logs?: unknown };
  const logs = Array.isArray(item.logs)
    ? item.logs.flatMap((log) => {
        if (typeof log !== "object" || log === null) return [];
        const candidate = log as { topics?: unknown; data?: unknown };
        if (
          !Array.isArray(candidate.topics) ||
          !candidate.topics.every((topic) => typeof topic === "string") ||
          typeof candidate.data !== "string"
        ) {
          return [];
        }
        return [{ topics: candidate.topics, data: candidate.data }];
      })
    : [];
  return { status: item.status, logs };
};

const migratePendingMintTransactionHash = (
  expectedHash: string,
  replacementHash: string,
) => {
  const durable = readPendingMintTransaction();
  const current = pendingMintTransaction ?? durable;
  if (!pendingMintTransactionMatches(current, expectedHash)) {
    return false;
  }
  if (
    durable &&
    !pendingMintTransactionMatches(durable, expectedHash) &&
    !pendingMintIdentityMatches(current!, durable)
  ) {
    return false;
  }

  pendingMintTransaction = replacePendingMintTransactionHash(current!, replacementHash);
  writePendingMintTransaction(pendingMintTransaction);
  walletState.txHash = pendingMintTransaction.hash;
  mintFlowData.txHash = pendingMintTransaction.hash;
  pendingMintReceiptMonitorHash = pendingMintTransaction.hash;
  recordCurrentMintConsoleState();
  syncInterface();
  return true;
};

const waitForMintReceiptByHash = async (
  tx: MintTransactionResponse,
  onTrackedHash?: (hash: string) => void,
): Promise<MintReceiptResult> => {
  let trackedHash = tx.hash.toLowerCase();
  try {
    const receipt = await withTimeout(
      tx.wait(),
      MINT_RECEIPT_WAIT_TIMEOUT_MS,
      MINT_RECEIPT_MONITOR_TIMEOUT_MESSAGE,
    );
    if (receipt && mintReceiptStatusOutcome(receipt.status) !== "unknown") {
      return Object.freeze({ hash: trackedHash, receipt });
    }
  } catch (error) {
    const replacement = parseMintTransactionReplacement(error);
    if (replacement) {
      if (replacement.cancelled) {
        throw error;
      }
      migratePendingMintTransactionHash(trackedHash, replacement.hash);
      trackedHash = replacement.hash;
      onTrackedHash?.(trackedHash);
      const replacementReceipt = mintReceiptFromUnknown(replacement.receipt);
      if (
        replacementReceipt &&
        mintReceiptStatusOutcome(replacementReceipt.status) !== "unknown"
      ) {
        return Object.freeze({ hash: trackedHash, receipt: replacementReceipt });
      }
    } else if (!classifyMintTrackingFailure(error, trackedHash).keepTracking) {
      throw error;
    }
  }

  const deadline = Date.now() + MINT_RECEIPT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    for (const provider of getMintReceiptMonitoringProviders()) {
      try {
        const receipt = await provider.getTransactionReceipt(trackedHash);
        if (receipt && mintReceiptStatusOutcome(receipt.status) !== "unknown") {
          return Object.freeze({ hash: trackedHash, receipt });
        }
      } catch {
        // Keep polling; a persisted hash is the source of truth while RPC reads recover.
      }
    }
    await sleep(MINT_RECEIPT_POLL_MS);
  }

  throw new Error(MINT_RECEIPT_MONITOR_TIMEOUT_MESSAGE);
};

const resolveMintedTokenId = async (receipt: MintReceipt | null) => {
  const fromReceipt = extractMintedTokenId(receipt ?? { logs: [] });
  if (fromReceipt !== null) {
    return fromReceipt;
  }

  if (!mintFlowData.textHash) {
    return null;
  }

  try {
    const token = getReadThoughtNFT();
    const tokenId = token ? await lookupExistingThoughtToken(token, mintFlowData.textHash) : 0n;
    return tokenId === 0n ? null : Number(tokenId);
  } catch {
    return null;
  }
};

const resolveExistingThoughtTokenId = async () => {
  if (!mintFlowData.textHash) {
    return null;
  }

  try {
    const token = getReadThoughtNFT();
    const tokenId = token ? await lookupExistingThoughtToken(token, mintFlowData.textHash) : 0n;
    return tokenId === 0n ? null : Number(tokenId);
  } catch {
    return null;
  }
};

const selectedPathAlreadyConsumed = async () => {
  const pathId = mintFlowData.pathId;
  const pathNft = getReadPathNft();
  if (pathId === null || !pathNft) {
    return false;
  }

  try {
    const [stage, stageMinted, movementQuota] = await Promise.all([
      pathNft.getStage(pathId) as Promise<bigint>,
      pathNft.getStageMinted(pathId) as Promise<bigint>,
      pathNft.getMovementQuota(PATH_MOVEMENT_THOUGHT) as Promise<bigint>,
    ]);
    return stage !== 0n || (movementQuota !== 0n && stageMinted >= movementQuota);
  } catch {
    return false;
  }
};

const clearPendingMintTransactionIfMatches = (expectedHash: string) => {
  if (!pendingMintTransactionMatches(pendingMintTransaction, expectedHash)) {
    return false;
  }
  const durable = readPendingMintTransaction();
  if (durable && !pendingMintTransactionMatches(durable, expectedHash)) {
    return false;
  }
  pendingMintTransaction = null;
  writePendingMintTransaction(null);
  return true;
};

const recoverMintStateAfterRevert = async (
  shouldAppendCliResult: boolean,
  expectedTrackedHash?: string,
) => {
  const stillOwnsTrackedMint = () =>
    !expectedTrackedHash || pendingMintTransactionMatches(
      pendingMintTransaction,
      expectedTrackedHash,
    );
  if (!stillOwnsTrackedMint()) {
    return false;
  }
  const existingTokenId = await resolveExistingThoughtTokenId();
  if (existingTokenId !== null) {
    if (!stillOwnsTrackedMint()) {
      return false;
    }
    if (
      expectedTrackedHash &&
      !clearPendingMintTransactionIfMatches(expectedTrackedHash)
    ) {
      return false;
    }
    walletState.txState = "idle";
    walletState.txError = "";
    walletState.mintedTokenId = existingTokenId;
    mintFlowData.existingTokenId = existingTokenId;
    mintFlowState = "minted";
    pendingMyBrainRunPayload = null;
    clearThoughtGalleryCache();
    await refreshMintPreflight();
    recordCurrentMintConsoleState();
    syncInterface();

    if (shouldAppendCliResult) {
      const consumedPathId = selectedCliPathId();
      appendCliOutput([
        "already minted.",
        `THOUGHT: #${existingTokenId}`,
        consumedPathId ? `$PATH #${consumedPathId} THOUGHT mint already used.` : "",
        walletState.txHash || mintFlowData.txHash ? "use: view tx" : "",
        viewThoughtUseLine(existingTokenId),
        "use: gallery",
      ].filter(Boolean));
    }
    return true;
  }

  if (await selectedPathAlreadyConsumed()) {
    if (!stillOwnsTrackedMint()) {
      return false;
    }
    if (
      expectedTrackedHash &&
      !clearPendingMintTransactionIfMatches(expectedTrackedHash)
    ) {
      return false;
    }
    const pathId = selectedCliPathId();
    setMintFlowError(
      pathId ? `$PATH #${pathId} has no THOUGHT mint available.` : "$PATH has no THOUGHT mint available.",
      "path_consumed",
    );
    syncInterface();
    return true;
  }

  return false;
};

const waitForMintReceipt = async (tx: MintTransactionResponse, shouldAppendCliResult: boolean) => {
  let trackedHash = tx.hash.toLowerCase();
  try {
    const result = await waitForMintReceiptByHash(tx, (replacementHash) => {
      trackedHash = replacementHash;
    });
    trackedHash = result.hash;
    if (!pendingMintTransactionMatches(pendingMintTransaction, trackedHash)) {
      return;
    }
    const receiptOutcome = mintReceiptStatusOutcome(result.receipt.status);
    if (receiptOutcome === "reverted") {
      throw new Error("transaction reverted.");
    }
    if (receiptOutcome !== "success") {
      throw new Error("mint receipt status unavailable.");
    }
    const mintedTokenId = await resolveMintedTokenId(result.receipt);
    if (!pendingMintTransactionMatches(pendingMintTransaction, trackedHash)) {
      return;
    }
    if (!clearPendingMintTransactionIfMatches(trackedHash)) {
      return;
    }

    walletState.txState = "idle";
    walletState.txError = "";
    walletState.mintedTokenId = mintedTokenId;
    walletState.txHash = trackedHash;
    mintFlowData.txHash = trackedHash;
    mintFlowState = "minted";
    pendingMyBrainRunPayload = null;
    clearThoughtGalleryCache();
    await refreshMintPreflight();
    recordCurrentMintConsoleState();
    syncInterface();
    trackThoughtAnalytics("mint_succeeded", {
      mintStage: "confirmed",
    });

    if (shouldAppendCliResult) {
      const consumedPathId = selectedCliPathId();
      appendCliOutput([
        "minted.",
        mintedTokenId !== null ? `THOUGHT: #${mintedTokenId}` : "THOUGHT: minted",
        consumedPathId ? `$PATH #${consumedPathId} THOUGHT mint used.` : "",
        "use: view tx",
        viewThoughtUseLine(mintedTokenId),
        "use: gallery",
      ].filter(Boolean));
    }
  } catch (error) {
    const ownedHash = pendingMintTransactionMatches(pendingMintTransaction, trackedHash)
      ? trackedHash
      : "";
    if (!ownedHash) {
      return;
    }
    const trackingFailure = classifyMintTrackingFailure(error, ownedHash);
    if (
      !trackingFailure.keepTracking &&
      await recoverMintStateAfterRevert(shouldAppendCliResult, ownedHash)
    ) {
      return;
    }
    if (!pendingMintTransactionMatches(pendingMintTransaction, ownedHash)) {
      return;
    }
    const message = mintErrorMessage(error);
    const errorKind = message.includes("provenance too large")
      ? "thought"
      : message.includes("expired")
        ? "signature"
        : "mint";
    const shouldKeepTracking = trackingFailure.keepTracking;
    if (shouldKeepTracking) {
      walletState.txState = "submitted";
      walletState.txError = message;
      mintFlowState = "minting";
      mintFlowData.error = message;
      mintFlowData.errorKind = "mint";
      recordCurrentMintConsoleState();
    } else {
      if (!clearPendingMintTransactionIfMatches(ownedHash)) {
        const durable = readPendingMintTransaction();
        if (durable) {
          pendingMintTransaction = durable;
          projectPendingMintTransaction(durable, {
            deploymentWarning: !isPendingMintDeploymentCompatible(durable),
          });
        }
        syncInterface();
        return;
      }
      setMintFlowError(message, errorKind, {
        preserveAuthorization: errorKind === "mint",
        preserveSubmittedTransaction: false,
      });
    }
    syncInterface();
    setStatus("");
    trackThoughtAnalytics("mint_failed", {
      mintStage: "confirmation",
      errorCategory: thoughtAnalyticsErrorCategory(error),
    });

    if (shouldAppendCliResult) {
      appendCliError([message, "use: current"]);
    }
  }
};

const detectSubmittedTxNonceGap = async (
  tx: MintTransactionResponse,
  submission: MintSubmissionContext,
  provider: JsonRpcProvider | BrowserProvider | null,
) => {
  if (!provider) {
    return null;
  }

  const submittedNonce = typeof tx.nonce === "number" ? tx.nonce : submission.nonce;

  try {
    const expectedNonce = await provider.getTransactionCount(submission.account, "pending");
    return submittedNonce > expectedNonce ? { actual: submittedNonce, expected: expectedNonce } : null;
  } catch {
    return null;
  }
};

const appendConflictingMintTransaction = (
  transaction: PendingMintTransaction,
) => {
  const durable = readConflictingMintTransactions();
  const next = [...durable, ...conflictingMintTransactions, transaction]
    .filter((candidate, index, all) =>
      all.findIndex((item) => item.hash === candidate.hash) === index
    )
    .slice(-8);
  conflictingMintTransactions = next;
  writeConflictingMintTransactions(next);
};

const removeConflictingMintTransaction = (hash: string) => {
  const normalizedHash = hash.toLowerCase();
  const next = conflictingMintTransactions.filter(
    (transaction) => transaction.hash !== normalizedHash,
  );
  if (next.length === conflictingMintTransactions.length) {
    return false;
  }
  conflictingMintTransactions = next;
  writeConflictingMintTransactions(next);
  return true;
};

const removeConflictingMintIdentity = (transaction: PendingMintTransaction) => {
  const next = conflictingMintTransactions.filter(
    (candidate) => !pendingMintIdentityMatches(candidate, transaction),
  );
  conflictingMintTransactions = next;
  writeConflictingMintTransactions(next);
};

const clearPendingMintIdentityIfMatches = (transaction: PendingMintTransaction) => {
  const durable = readPendingMintTransaction();
  const current = pendingMintTransaction ?? durable;
  if (current && !pendingMintIdentityMatches(current, transaction)) {
    return false;
  }
  if (durable && !pendingMintIdentityMatches(durable, transaction)) {
    return false;
  }
  pendingMintTransaction = null;
  writePendingMintTransaction(null);
  return true;
};

const finalizeSuccessfulKnownMint = async (
  transaction: PendingMintTransaction,
  receipt: MintReceipt,
  shouldAppendCliResult: boolean,
) => {
  const current = pendingMintTransaction ?? readPendingMintTransaction();
  if (current && !pendingMintIdentityMatches(current, transaction)) {
    return false;
  }
  const mintedTokenId = await resolveMintedTokenId(receipt);
  if (!clearPendingMintIdentityIfMatches(transaction)) {
    return false;
  }
  removeConflictingMintIdentity(transaction);

  mintAttemptId = transaction.attemptId?.trim() || mintAttemptId;
  mintFlowData.textHash = transaction.workHash;
  mintFlowData.pathIdInput = transaction.pathId;
  mintFlowData.pathId = BigInt(transaction.pathId);
  mintFlowData.txHash = transaction.hash;
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  walletState.txState = "idle";
  walletState.txError = "";
  walletState.txHash = transaction.hash;
  walletState.mintedTokenId = mintedTokenId;
  mintFlowState = "minted";
  pendingMyBrainRunPayload = null;
  clearThoughtGalleryCache();
  await refreshMintPreflight();
  emitThoughtConsoleEvent({
    kind: "mint_receipt_confirmed",
    title: "THOUGHT mint confirmed",
    detail: `${shortHex(transaction.hash, 10, 8)} confirmed on-chain.`,
    eventId: `mint-confirmed:${transaction.hash}`,
  });
  recordCurrentMintConsoleState();
  syncInterface();
  trackThoughtAnalytics("mint_succeeded", {
    mintStage: "confirmed",
  });

  if (shouldAppendCliResult) {
    appendCliOutput([
      "minted.",
      mintedTokenId !== null ? `THOUGHT: #${mintedTokenId}` : "THOUGHT: minted",
      `$PATH #${transaction.pathId} THOUGHT mint used.`,
      "use: view tx",
      viewThoughtUseLine(mintedTokenId),
      "use: gallery",
    ].filter(Boolean));
  }
  return true;
};

const readKnownMintReceiptOnce = async (hash: string): Promise<MintReceipt | null> => {
  for (const provider of getMintReceiptMonitoringProviders()) {
    try {
      const receipt = await withTimeout(
        provider.getTransactionReceipt(hash),
        MINT_RECEIPT_WAIT_TIMEOUT_MS,
        MINT_RECEIPT_MONITOR_TIMEOUT_MESSAGE,
      );
      if (receipt && mintReceiptStatusOutcome(receipt.status) !== "unknown") {
        return {
          status: receipt.status,
          logs: receipt.logs.map((log) => ({
            topics: [...log.topics],
            data: log.data,
          })),
        };
      }
    } catch {
      // A transport failure is not a terminal receipt result. Try another provider.
    }
  }
  return null;
};

const reconcileKnownMintReceipt = async (
  transaction: PendingMintTransaction,
  receipt: MintReceipt,
  shouldAppendCliResult: boolean,
) => {
  const outcome = mintReceiptStatusOutcome(receipt.status);
  if (outcome === "success") {
    return finalizeSuccessfulKnownMint(transaction, receipt, shouldAppendCliResult);
  }
  if (outcome !== "reverted") {
    return false;
  }

  if (pendingMintTransactionMatches(pendingMintTransaction, transaction.hash)) {
    if (await recoverMintStateAfterRevert(shouldAppendCliResult, transaction.hash)) {
      return true;
    }
    if (!clearPendingMintTransactionIfMatches(transaction.hash)) {
      return false;
    }
    const promoted = adoptDurablePendingMintTransaction();
    if (promoted) {
      projectPendingMintTransaction(promoted, {
        deploymentWarning: !isPendingMintDeploymentCompatible(promoted),
      });
      if (isPendingMintDeploymentCompatible(promoted)) {
        resumePendingMintReceiptMonitoring();
      }
      recordCurrentMintConsoleState();
      syncInterface();
      return true;
    }
    setMintFlowError("transaction reverted.", "mint", {
      preserveAuthorization: true,
      preserveSubmittedTransaction: false,
    });
    recordCurrentMintConsoleState();
    syncInterface();
    resumeConflictingMintReceiptMonitoring();
    return true;
  }

  if (!removeConflictingMintTransaction(transaction.hash)) {
    return false;
  }
  emitThoughtConsoleEvent({
    kind: "conflicting_mint_reverted",
    title: "returned mint hash reverted",
    detail: `${shortHex(transaction.hash, 10, 8)} reverted; the original hash remains tracked.`,
    eventId: `conflicting-mint-reverted:${transaction.hash}`,
    tone: "warning",
  });
  if (pendingMintTransaction) {
    projectPendingMintTransaction(pendingMintTransaction, {
      deploymentWarning: !isPendingMintDeploymentCompatible(pendingMintTransaction),
    });
  }
  recordCurrentMintConsoleState();
  syncInterface();
  return true;
};

const monitorConflictingMintReceipt = async (
  transaction: PendingMintTransaction,
  shouldAppendCliResult: boolean,
) => {
  const deadline = Date.now() + MINT_RECEIPT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!conflictingMintTransactions.some((candidate) => candidate.hash === transaction.hash)) {
      return;
    }
    const receipt = await readKnownMintReceiptOnce(transaction.hash);
    if (receipt && await reconcileKnownMintReceipt(
      transaction,
      receipt,
      shouldAppendCliResult,
    )) {
      return;
    }
    await sleep(MINT_RECEIPT_POLL_MS);
  }

  if (!conflictingMintTransactions.some((candidate) => candidate.hash === transaction.hash)) {
    return;
  }
  const message = `Automatic confirmation monitoring is delayed for returned hash ${shortHex(transaction.hash, 10, 8)}. Hash retained; do not submit a duplicate.`;
  walletState.txState = "submitted";
  walletState.txError = message;
  mintFlowData.error = message;
  mintFlowData.errorKind = "mint";
  mintFlowState = "minting";
  recordCurrentMintConsoleState();
  syncInterface();
};

const startConflictingMintReceiptMonitor = (
  transaction: PendingMintTransaction,
  shouldAppendCliResult = false,
) => {
  if (
    !isPendingMintDeploymentCompatible(transaction) ||
    conflictingMintReceiptMonitorHashes.has(transaction.hash)
  ) {
    return false;
  }
  conflictingMintReceiptMonitorHashes.add(transaction.hash);
  void monitorConflictingMintReceipt(transaction, shouldAppendCliResult).finally(() => {
    conflictingMintReceiptMonitorHashes.delete(transaction.hash);
  });
  return true;
};

const resumeConflictingMintReceiptMonitoring = () => {
  conflictingMintTransactions.forEach((transaction) => {
    startConflictingMintReceiptMonitor(transaction);
  });
};

const startMintReceiptMonitor = (
  tx: MintTransactionResponse,
  shouldAppendCliResult: boolean,
) => {
  const hash = tx.hash.toLowerCase();
  if (pendingMintReceiptMonitorHash === hash) {
    return;
  }
  const generation = pendingMintReceiptMonitorGeneration + 1;
  pendingMintReceiptMonitorGeneration = generation;
  pendingMintReceiptMonitorHash = hash;
  void waitForMintReceipt(tx, shouldAppendCliResult).finally(() => {
    if (pendingMintReceiptMonitorGeneration === generation) {
      pendingMintReceiptMonitorHash = "";
    }
  });
};

const registerSubmittedMintTx = async (
  tx: MintTransactionResponse,
  shouldAppendCliResult: boolean,
  submission: MintSubmissionContext,
  provider: JsonRpcProvider | BrowserProvider | null,
) => {
  const existing = pendingMintTransaction ?? readPendingMintTransaction();
  if (existing) {
    pendingMintTransaction = existing;
    const sameHash = pendingMintTransactionMatches(existing, tx.hash);
    if (!sameHash) {
      const returnedTransaction = createPendingMintTransaction(
        submission,
        tx.hash,
        Date.now(),
      );
      appendConflictingMintTransaction(returnedTransaction);
      emitThoughtConsoleEvent({
        kind: "multiple_mint_hashes_returned",
        title: "multiple mint hashes returned",
        detail: `${shortHex(existing.hash, 10, 8)} and ${shortHex(returnedTransaction.hash, 10, 8)} are both retained and monitored. Do not submit a duplicate.`,
        eventId: `multiple-mint-hashes:${existing.hash}:${returnedTransaction.hash}`,
        tone: "warning",
      });
      startConflictingMintReceiptMonitor(returnedTransaction, shouldAppendCliResult);
    }
    projectPendingMintTransaction(existing, {
      deploymentWarning: !isPendingMintDeploymentCompatible(existing),
    });
    recordCurrentMintConsoleState();
    syncInterface();
    if (
      sameHash &&
      isPendingMintDeploymentCompatible(existing)
    ) {
      startMintReceiptMonitor(tx, shouldAppendCliResult);
    } else if (isPendingMintDeploymentCompatible(existing)) {
      resumePendingMintReceiptMonitoring();
    }
    return true;
  }

  mintAttemptId = submission.attemptId;
  mintFlowData.textHash = submission.workHash;
  mintFlowData.pathIdInput = submission.pathId;
  mintFlowData.pathId = BigInt(submission.pathId);
  pendingMintTransaction = createPendingMintTransaction(submission, tx.hash, Date.now());
  writePendingMintTransaction(pendingMintTransaction);
  walletState.txState = "submitted";
  walletState.txHash = tx.hash;
  mintFlowData.txHash = tx.hash;
  setStatus("");
  trackThoughtAnalytics("mint_started", {
    mintStage: "submitted",
  });
  recordCurrentMintConsoleState();
  syncInterface();

  if (shouldAppendCliResult) {
    appendCliOutput(["transaction submitted.", `tx: ${shortHex(tx.hash, 10, 8)}`, "waiting for chain confirmation...", "use: view tx"]);
  }

  startMintReceiptMonitor(tx, shouldAppendCliResult);
  resumeConflictingMintReceiptMonitoring();
  void detectSubmittedTxNonceGap(tx, submission, provider).then((nonceGap) => {
    if (
      !nonceGap ||
      pendingMintTransaction?.hash.toLowerCase() !== tx.hash.toLowerCase()
    ) {
      return;
    }
    const message = `transaction queued with nonce ${nonceGap.actual}; chain expects ${nonceGap.expected}.`;
    walletState.txState = "submitted";
    walletState.txError = message;
    mintFlowState = "minting";
    mintFlowData.error = message;
    mintFlowData.errorKind = "mint";
    recordCurrentMintConsoleState();
    syncInterface();
    trackThoughtAnalytics("mint_failed", {
      mintStage: "submitted",
      errorCategory: "rpc",
    });

    if (shouldAppendCliResult) {
      appendCliError([
        "transaction queued.",
        `tx: ${shortHex(tx.hash, 10, 8)}`,
        `wallet nonce: ${nonceGap.actual}`,
        `chain expects: ${nonceGap.expected}`,
        "mint is not pending on-chain yet.",
        "keep tracking this hash; do not submit a duplicate.",
        "check Rabby activity and nonce before taking wallet action.",
        "use: view tx",
      ]);
    }
  });
  return true;
};

const resumePendingMintReceiptMonitoring = () => {
  const pending = pendingMintTransaction;
  if (!pending) {
    return false;
  }

  const resumedTx: MintTransactionResponse = {
    hash: pending.hash,
    nonce: pending.nonce,
    from: pending.account,
    wait: async () => {
      const provider = getMintReceiptMonitoringProviders()[0];
      if (!provider) {
        throw new Error("mint receipt network unavailable.");
      }
      const receipt = await withTimeout(
        provider.waitForTransaction(pending.hash),
        MINT_RECEIPT_WAIT_TIMEOUT_MS,
        MINT_RECEIPT_MONITOR_TIMEOUT_MESSAGE,
      );
      if (!receipt) return null;
      return {
        status: receipt.status,
        logs: receipt.logs.map((log) => ({
          topics: [...log.topics],
          data: log.data,
        })),
      };
    },
  };
  startMintReceiptMonitor(resumedTx, false);
  return true;
};

const resumePendingMintTransaction = async () => {
  const pending = pendingMintTransaction;
  if (!pending) return false;

  if (
    pending.chainId !== THOUGHT_CHAIN_ID ||
    pending.thoughtNft.toLowerCase() !== THOUGHT_NFT_ADDRESS.toLowerCase()
  ) {
    projectPendingMintTransaction(pending, { deploymentWarning: true });
    emitThoughtConsoleEvent({
      kind: "pending_mint_deployment_mismatch",
      title: "mint deployment changed",
      detail: `Keep tracking ${shortHex(pending.hash, 10, 8)} on chain ${pending.chainId}; this deployment cannot inspect it.`,
      eventId: `pending-deployment:${pending.hash.toLowerCase()}`,
      tone: "warning",
    });
    recordCurrentMintConsoleState();
    syncInterface();
    resumeConflictingMintReceiptMonitoring();
    return true;
  }

  const retainedAttemptId = [...thoughtConsoleHistory.entries]
    .reverse()
    .find((entry) =>
      entry.kind === "transaction_submitted" &&
      entry.dedupeKey.includes(`transaction:${pending.hash.toLowerCase()}`)
    )?.context.attemptId;
  mintAttemptId = pending.attemptId?.trim() || retainedAttemptId || nextMintAttemptId("resume");
  walletState.txError = "";
  projectPendingMintTransaction(pending);
  recordCurrentMintConsoleState();
  syncInterface();
  resumePendingMintReceiptMonitoring();
  resumeConflictingMintReceiptMonitoring();
  return true;
};

const restorePathMintHandoffWork = (handoff: PathMintHandoff) => {
  if (handoff.work) {
    const output = thoughtProtocolText(handoff.work.output, IS_LOCAL_THOUGHT_V2);
    if (keccak256(toUtf8Bytes(output)).toLowerCase() !== handoff.workHash.toLowerCase()) {
      return false;
    }
    const migratedSvg = migrateLegacyThoughtV2Svg(output, handoff.work.svg);
    currentOutputText = output;
    currentWorkSvg = migratedSvg.svg;
    currentRunContext = isThoughtRunContext(handoff.work.runContext) ? handoff.work.runContext : null;
    currentWorkId = handoff.work.workId;
    runState = "output_ready";
    mintDockRevealed = true;
    writeCurrentOutputSession();
    syncCurrentWorkVisual({ suppressWarning: true });
    return true;
  }

  return Boolean(
    currentOutputText &&
    keccak256(toUtf8Bytes(currentOutputText)).toLowerCase() === handoff.workHash.toLowerCase()
  );
};

const pathTokenIdFromMintReceipt = (
  receipt: { logs?: readonly { address?: string; topics?: readonly string[] }[] },
  account: string,
) => {
  const zeroAddressTopic = `0x${"0".repeat(64)}`;
  const accountTopic = account.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  for (const log of receipt.logs ?? []) {
    const topics = log.topics ?? [];
    if (
      log.address?.toLowerCase() !== PATH_NFT_ADDRESS.toLowerCase() ||
      topics[0]?.toLowerCase() !== ERC721_TRANSFER_TOPIC.toLowerCase() ||
      topics[1]?.toLowerCase() !== zeroAddressTopic ||
      topics[2]?.toLowerCase().replace(/^0x/, "") !== accountTopic ||
      !topics[3]
    ) {
      continue;
    }
    try {
      return BigInt(topics[3]).toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const checkSubmittedPathMintReturn = async (
  record: NonNullable<ReturnType<typeof readPathMintReturnRecord>>,
) => {
  if (record.status !== "submitted" || record.chainId !== THOUGHT_CHAIN_ID) {
    return { outcome: "pending" as const, record };
  }

  const deadline = Date.now() + Math.min(5_000, MINT_RECEIPT_WAIT_TIMEOUT_MS);
  do {
    for (const provider of getMintReceiptMonitoringProviders()) {
      try {
        const receipt = await provider.getTransactionReceipt(record.txHash);
        if (!receipt) continue;
        const outcome = mintReceiptStatusOutcome(receipt.status);
        if (outcome === "reverted") {
          removePathMintReturnRecord(getPathMintReturnStorageHost(), record.handoffId);
          return { outcome: "reverted" as const, record };
        }
        if (outcome === "success") {
          const tokenId = pathTokenIdFromMintReceipt(receipt, record.account);
          const confirmed = {
            ...record,
            status: "confirmed" as const,
            ...(tokenId ? { tokenId } : {}),
            updatedAt: Date.now(),
          };
          writePathMintReturnRecord(getPathMintReturnStorageHost(), confirmed);
          return { outcome: "confirmed" as const, record: confirmed };
        }
      } catch {
        // Null and transport failures retain the submitted record for another check.
      }
    }
    await sleep(MINT_RECEIPT_POLL_MS);
  } while (Date.now() < deadline);

  return { outcome: "pending" as const, record };
};

const resumePathMintHandoff = async () => {
  if (blockPendingMintMutation()) {
    return true;
  }
  const handoff = readPathMintHandoff();
  if (!handoff || !restorePathMintHandoffWork(handoff)) return false;

  let returnRecord = readPathMintReturnRecord(
    getPathMintReturnStorageHost(),
    handoff.attemptId,
  );
  let submittedReturnOutcome: "pending" | "confirmed" | "reverted" | null = null;
  if (returnRecord?.status === "submitted") {
    const checked = await checkSubmittedPathMintReturn(returnRecord);
    submittedReturnOutcome = checked.outcome;
    returnRecord = checked.outcome === "reverted" ? null : checked.record;
  }
  const confirmedReturn = returnRecord?.status === "confirmed" ? returnRecord : null;
  const resumesSameWallet =
    Boolean(handoff.account) &&
    Boolean(walletState.address) &&
    walletState.address.toLowerCase() === handoff.account.toLowerCase() &&
    walletState.chainId === THOUGHT_CHAIN_ID &&
    (handoff.chainId === undefined || handoff.chainId === null || walletState.chainId === handoff.chainId);
  resetMintFlow({ preserveAttempt: true });
  mintAttemptId = confirmedReturn || resumesSameWallet
    ? handoff.attemptId
    : nextMintAttemptId("wallet");
  mintFlowUiMode = THOUGHT_PANEL_MINT_UI_MODE;
  mintFlowData.rawText = currentOutputText;
  mintFlowData.textHash = handoff.workHash;
  if (!confirmedReturn && !resumesSameWallet) {
    recordThoughtConsoleContextBoundary();
  }

  const showReturnError = (message: string, kind: MintFlowErrorKind) => {
    const work = getThoughtDockWorkView();
    if (work) {
      setThoughtDockState({ kind: "work_ready", work });
    }
    setMintFlowError(message, kind);
    syncInterface();
    return true;
  };

  if (submittedReturnOutcome === "reverted") {
    return showReturnError(
      "$PATH transaction reverted. Mint a $PATH or pick one already in this wallet.",
      "path_not_found",
    );
  }

  if (returnRecord?.status === "submitted" && returnRecord.chainId !== THOUGHT_CHAIN_ID) {
    return showReturnError(
      `$PATH transaction is on chain ${returnRecord.chainId}; THOUGHT needs ${THOUGHT_CHAIN_NAME} (${THOUGHT_CHAIN_ID}).`,
      "path_mint_chain_mismatch",
    );
  }

  if (returnRecord?.status === "submitted") {
    return showReturnError(
      `$PATH transaction ${shortHex(returnRecord.txHash, 10, 8)} is still confirming.`,
      "path_mint_pending",
    );
  }

  if (confirmedReturn && confirmedReturn.chainId !== THOUGHT_CHAIN_ID) {
    return showReturnError(
      `$PATH was minted on chain ${confirmedReturn.chainId}; THOUGHT needs ${THOUGHT_CHAIN_NAME} (${THOUGHT_CHAIN_ID}).`,
      "path_mint_chain_mismatch",
    );
  }

  if (
    confirmedReturn &&
    (!walletState.address || walletState.address.toLowerCase() !== confirmedReturn.account.toLowerCase())
  ) {
    return showReturnError(
      `$PATH was minted to ${shortHex(confirmedReturn.account)}; select that account in your wallet to continue.`,
      "wallet_account_mismatch",
    );
  }

  if (confirmedReturn && walletState.chainId !== THOUGHT_CHAIN_ID) {
    return showReturnError("wrong network.", "wrong_network");
  }

  emitThoughtConsoleEvent({
    kind: "path_mint_returned",
    title: "returned from $PATH mint",
    detail: "Refreshing wallet $PATH inventory and resuming this THOUGHT mint.",
    eventId: `path-return:${handoff.attemptId}`,
  });
  const resumed = await mintThoughtDockWork({
    attemptId: mintAttemptId,
    pathId: confirmedReturn?.tokenId,
  });
  if (!resumed) return false;

  let resumeSucceeded =
    mintFlowState === "text_taken" ||
    mintFlowState === "minted" ||
    mintFlowState === "path_ready";
  if (!resumeSucceeded && confirmedReturn) {
    if (confirmedReturn.tokenId && mintFlowState !== "error") {
      await checkPathEligibility();
      resumeSucceeded = mintFlowState === "path_ready";
    } else if (mintFlowState !== "error") {
      await refreshPathInventoryForCurrentWallet({ force: true });
      resumeSucceeded =
        pathInventoryMatchesCurrentWallet() &&
        pathInventoryState.status === "loaded" &&
        availablePathInventoryItems().length > 0;
    }
  } else if (
    !resumeSucceeded &&
    !confirmedReturn &&
    mintFlowState === "path_required" &&
    walletState.address &&
    walletState.chainId === THOUGHT_CHAIN_ID
  ) {
    await refreshPathInventoryForCurrentWallet({ force: true });
    resumeSucceeded =
      pathInventoryMatchesCurrentWallet() &&
      pathInventoryState.status === "loaded" &&
      availablePathInventoryItems().length > 0;
  }

  if (resumeSucceeded) {
    removePathMintReturnRecord(getPathMintReturnStorageHost(), handoff.attemptId);
    removePathMintHandoff(handoff.attemptId);
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete("pathHandoff");
    window.history.replaceState({}, "", `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`);
  }
  return true;
};

const rebuildFinalMintProvenance = async () => {
  if (!walletState.address || mintFlowData.pathId === null || !activeMintWork) {
    throw new Error("mint context unavailable.");
  }
  if (mintFlowData.rawText !== activeMintWork.text) {
    throw new Error("mint work changed.");
  }

  const spec = await ensureActiveThoughtSpec();
  mintFlowData.thoughtSpecId = spec.specId;
  mintFlowData.thoughtSpecHash = spec.specHash;
  if (!mintFlowData.textHash) {
    mintFlowData.textHash = await textHashFromContract(mintFlowData.rawText);
  }
  const promptHash = hashText(activeMintWork.runContext.prompt);
  mintFlowData.promptHash = promptHash;
  const provenanceJson = buildProvenanceJson(mintFlowData.textHash, {
    minter: walletState.address,
    pathId: mintFlowData.pathId,
    promptHash,
  }, activeMintWork);
  const provenanceBytes = byteLength(provenanceJson);
  if (provenanceBytes > MAX_PROVENANCE_BYTES) {
    throw new Error(provenanceTooLargeMessage(provenanceBytes));
  }
  mintFlowData.provenanceJson = provenanceJson;
};

const confirmMint = async (options?: { appendCliResult?: boolean }) => {
  const shouldAppendCliResult = options?.appendCliResult ?? false;
  if (mintTransactionInFlight) {
    return null;
  }
  if (blockPendingMintMutation({ cli: shouldAppendCliResult })) {
    return pendingMintTransaction?.hash ?? null;
  }
  const ethereum = getEthereumProvider();
  if (
    !ethereum ||
    !walletState.address ||
    mintFlowData.pathId === null ||
    !mintFlowData.provenanceJson ||
    !mintFlowData.thoughtSpecId ||
    !mintFlowData.thoughtSpecHash ||
    !mintFlowData.deadline ||
    !mintFlowData.signature ||
    !activeMintWork
  ) {
    clearMintAuthorization();
    mintFlowState = "path_ready";
    recordCurrentMintConsoleState();
    syncInterface();
    return;
  }

  if (mintFlowData.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    setMintFlowError("$PATH signature expired.", "signature");
    syncInterface();
    trackThoughtAnalytics("mint_failed", {
      mintStage: "signature",
      errorCategory: "timeout",
    });
    return;
  }

  const capturedAuthorization = Object.freeze({
    attemptId: mintAttemptId,
    account: walletState.address,
    pathId: mintFlowData.pathId,
    rawText: mintFlowData.rawText,
    deadline: mintFlowData.deadline,
    signature: mintFlowData.signature,
  });
  mintTransactionInFlight = true;
  const requestId = mintTransactionRequestId + 1;
  mintTransactionRequestId = requestId;
  activeMintTransactionRequestId = requestId;
  mintFlowState = "minting";
  walletState.txState = "awaiting_signature";
  walletState.txError = "";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  recordCurrentMintConsoleState();
  syncInterface();
  trackThoughtAnalytics("mint_started", {
    mintStage: "wallet_signature",
  });

  try {
    await rebuildFinalMintProvenance();
    if (
      walletState.address.toLowerCase() !== capturedAuthorization.account.toLowerCase() ||
      mintFlowData.pathId !== capturedAuthorization.pathId ||
      mintFlowData.rawText !== capturedAuthorization.rawText ||
      mintFlowData.deadline !== capturedAuthorization.deadline ||
      mintFlowData.signature !== capturedAuthorization.signature
    ) {
      throw new Error("mint context changed.");
    }
    const payload = Object.freeze({
      attemptId: capturedAuthorization.attemptId,
      account: capturedAuthorization.account,
      promptLine: activeMintWork.runContext.prompt,
      agentLine: capturedAuthorization.rawText,
      pathId: capturedAuthorization.pathId,
      thoughtSpecId: mintFlowData.thoughtSpecId,
      thoughtSpecHash: mintFlowData.thoughtSpecHash,
      promptHash: mintFlowData.promptHash,
      provenanceJson: mintFlowData.provenanceJson,
      deadline: capturedAuthorization.deadline,
      pathSignature: capturedAuthorization.signature,
      workHash: mintFlowData.textHash,
    });
    const browserProvider = new BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner(payload.account);
    const signerAddress = await signer.getAddress();
    if (signerAddress.toLowerCase() !== payload.account.toLowerCase()) {
      throw new Error("wallet account changed.");
    }
    const eligibility = await readPathEligibility(payload.pathId, signerAddress);
    if (!eligibility.ok) {
      setMintFlowError(eligibility.message, eligibility.kind);
      syncInterface();
      return null;
    }
    const readToken = getReadThoughtNFT();
    const existingTokenId = readToken
      ? await lookupExistingThoughtToken(readToken, payload.workHash)
      : 0n;
    if (existingTokenId !== 0n) {
      walletState.txState = "idle";
      walletState.txError = "";
      mintFlowData.existingTokenId = Number(existingTokenId);
      mintFlowState = "text_taken";
      recordCurrentMintConsoleState();
      syncInterface();
      return null;
    }
    const nonceProvider = getReadProvider() ?? browserProvider;
    const nonce = await nonceProvider.getTransactionCount(signerAddress, "pending");
    const writableToken = new Contract(THOUGHT_NFT_ADDRESS, THOUGHT_NFT_ABI, signer);
    const submission = createMintSubmissionContext({
      attemptId: payload.attemptId,
      account: signerAddress,
      chainId: THOUGHT_CHAIN_ID,
      thoughtNft: THOUGHT_NFT_ADDRESS,
      workHash: payload.workHash,
      pathId: payload.pathId,
      nonce,
    });
    let releaseLockAfterRecovery!: () => void;
    const releaseLockSignal = new Promise<void>((resolve) => {
      releaseLockAfterRecovery = resolve;
    });
    let resolveReleaseCompleted!: () => void;
    const releaseCompleted = new Promise<void>((resolve) => {
      resolveReleaseCompleted = resolve;
    });

    const lockedSubmission = await withMintSubmissionLock(
      mintSubmissionLockEnvironment(),
      async (lock) => {
        const [liveAccounts, liveChainHex] = await withTimeout(
          Promise.all([
            ethereum.request({ method: "eth_accounts" }),
            ethereum.request({ method: "eth_chainId" }),
          ]),
          PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS,
          "wallet status request timed out.",
        );
        const liveAddress = extractPrimaryAccount(liveAccounts);
        const liveChainId =
          typeof liveChainHex === "string" && liveChainHex.length > 0
            ? Number(BigInt(liveChainHex))
            : null;
        if (!liveAddress || liveAddress.toLowerCase() !== payload.account.toLowerCase()) {
          throw new Error("wallet account changed.");
        }
        if (liveChainId !== THOUGHT_CHAIN_ID) {
          throw new Error("wrong network.");
        }
        if (!lock.ownsExclusion()) {
          throw new Error("mint submission lock lost before wallet request.");
        }

        // This synchronous durable re-read is the last operation before opening
        // the wallet transaction request. The origin-wide lock makes it atomic
        // with respect to every cooperating THOUGHT tab.
        const competingPending = pendingMintTransaction ?? readPendingMintTransaction();
        if (competingPending) {
          pendingMintTransaction = competingPending;
          projectPendingMintTransaction(competingPending, {
            deploymentWarning: !isPendingMintDeploymentCompatible(competingPending),
          });
          recordCurrentMintConsoleState();
          syncInterface();
          if (isPendingMintDeploymentCompatible(competingPending)) {
            resumePendingMintReceiptMonitoring();
          }
          return competingPending.hash;
        }

        const txPromise = (IS_LOCAL_THOUGHT_V2
          ? writableToken.mint(
              {
                promptLine: payload.promptLine,
                agentLine: payload.agentLine,
                pathId: payload.pathId,
                thoughtSpecId: payload.thoughtSpecId,
                thoughtSpecHash: payload.thoughtSpecHash,
                provenanceJson: payload.provenanceJson,
                deadline: payload.deadline,
                pathSignature: payload.pathSignature,
              },
              { nonce },
            )
          : writableToken.mint(
              payload.agentLine,
              payload.pathId,
              payload.thoughtSpecId,
              payload.thoughtSpecHash,
              payload.promptHash,
              payload.provenanceJson,
              payload.deadline,
              payload.pathSignature,
              { nonce },
            )) as Promise<MintTransactionResponse>;

        walletMintSubmitPromiseUnresolved = true;
        unresolvedMintSubmission = Object.freeze({
          requestId,
          submission,
          provider: nonceProvider,
          releaseLockAfterRecovery,
          releaseCompleted,
        });
        try {
          try {
            const tx = await withTimeout(
              txPromise,
              WALLET_TX_SUBMIT_TIMEOUT_MS,
              "wallet transaction not submitted.",
            );
            await registerSubmittedMintTx(tx, shouldAppendCliResult, submission, nonceProvider);
            return tx.hash;
          } catch (error) {
            const message = mintErrorMessage(error);
            if (!message.includes("not submitted")) {
              throw error;
            }

            setMintFlowError(message, "mint", { preserveAuthorization: true });
            syncInterface();
            setStatus("");
            trackThoughtAnalytics("mint_failed", {
              mintStage: "wallet_signature",
              errorCategory: thoughtAnalyticsErrorCategory(error),
            });

            // Keep exclusion until the original wallet promise settles, unless
            // the explicit recovery flow proves twice that no hash or nonce
            // activity exists and asks this waiter to detach.
            const lateOutcome = await waitForMintSubmissionOrRelease(
              txPromise,
              releaseLockSignal,
            );
            if (lateOutcome.kind === "settled") {
              const lateTx = lateOutcome.value;
              await registerSubmittedMintTx(
                lateTx,
                shouldAppendCliResult,
                submission,
                nonceProvider,
              );
              return lateTx.hash;
            }
            if (lateOutcome.kind === "rejected") {
              const lateError = lateOutcome.error;
              const lateMessage = mintErrorMessage(lateError);
              setMintFlowError(lateMessage, "mint", { preserveAuthorization: true });
              recordCurrentMintConsoleState();
              trackThoughtAnalytics("mint_failed", {
                mintStage: "wallet_signature",
                errorCategory: thoughtAnalyticsErrorCategory(lateError),
              });
              return null;
            }

            // The provider promise itself is not cancelled. Any late hash is
            // still registered, persisted, and reconciled against a retried hash.
            void txPromise.then(
              async (lateTx) => {
                await registerSubmittedMintTx(
                  lateTx,
                  false,
                  submission,
                  nonceProvider,
                );
              },
              (lateError) => {
                emitThoughtConsoleEvent({
                  kind: "detached_mint_request_settled",
                  title: "detached wallet request closed",
                  detail: mintErrorMessage(lateError),
                  eventId: `detached-mint-settled:${requestId}`,
                });
              },
            );
            return null;
          }
        } finally {
          if (unresolvedMintSubmission?.requestId === requestId) {
            unresolvedMintSubmission = null;
            walletMintSubmitPromiseUnresolved = false;
          }
          syncInterface();
        }
      },
    );
    resolveReleaseCompleted();

    if (!lockedSubmission.acquired) {
      const competingPending = readPendingMintTransaction();
      if (competingPending) {
        pendingMintTransaction = competingPending;
        projectPendingMintTransaction(competingPending, {
          deploymentWarning: !isPendingMintDeploymentCompatible(competingPending),
        });
        recordCurrentMintConsoleState();
        syncInterface();
        if (isPendingMintDeploymentCompatible(competingPending)) {
          resumePendingMintReceiptMonitoring();
        }
        return competingPending.hash;
      }
      const unavailable = lockedSubmission.reason === "unavailable";
      setMintFlowError(
        unavailable
          ? "this browser cannot safely coordinate THOUGHT mint requests across tabs. Use a browser with Web Locks support; no wallet request was opened."
          : "another tab has an unresolved mint submission. Check wallet activity; do not submit a duplicate.",
        "mint",
        { preserveAuthorization: true },
      );
      syncInterface();
      return null;
    }
    return lockedSubmission.value;
  } catch (error) {
    const message = mintErrorMessage(error);
    if (await recoverMintStateAfterRevert(shouldAppendCliResult)) {
      setStatus("");
      return walletState.txHash || mintFlowData.txHash || null;
    }

    const errorKind: MintFlowErrorKind = message.includes("expired") ? "signature" : "mint";
    setMintFlowError(message, errorKind, {
      preserveAuthorization: errorKind === "mint",
    });
    syncInterface();
    setStatus("");
    trackThoughtAnalytics("mint_failed", {
      mintStage: "transaction",
      errorCategory: thoughtAnalyticsErrorCategory(error),
    });
    return null;
  } finally {
    if (activeMintTransactionRequestId === requestId) {
      activeMintTransactionRequestId = 0;
      mintTransactionInFlight = false;
    }
  }
};

const recoverUnresolvedMintSubmission = async () => {
  const durable = readPendingMintTransaction();
  if (durable) {
    pendingMintTransaction = durable;
    projectPendingMintTransaction(durable, {
      deploymentWarning: !isPendingMintDeploymentCompatible(durable),
    });
    if (isPendingMintDeploymentCompatible(durable)) {
      const receipt = await readKnownMintReceiptOnce(durable.hash);
      if (receipt && await reconcileKnownMintReceipt(durable, receipt, false)) {
        return;
      } else {
        resumePendingMintReceiptMonitoring();
      }
    }
    resumeConflictingMintReceiptMonitoring();
    emitThoughtConsoleEvent({
      kind: "mint_activity_checked",
      title: "mint activity checked",
      detail: `Transaction hash ${shortHex(durable.hash, 10, 8)} is retained. Do not submit a duplicate.`,
      eventId: `mint-activity-checked:${durable.hash}`,
    });
    recordCurrentMintConsoleState();
    syncInterface();
    return;
  }

  for (const transaction of conflictingMintTransactions) {
    if (!isPendingMintDeploymentCompatible(transaction)) continue;
    const receipt = await readKnownMintReceiptOnce(transaction.hash);
    if (receipt && await reconcileKnownMintReceipt(transaction, receipt, false)) {
      return;
    }
  }

  const unresolved = unresolvedMintSubmission;
  if (!unresolved?.provider) {
    setMintFlowError(
      "Another tab still controls the unresolved wallet submission. Check that tab and wallet activity; do not submit a duplicate.",
      "mint",
      { preserveAuthorization: true, preserveSubmittedTransaction: true },
    );
    syncInterface();
    return;
  }

  const readNonceSnapshot = async () => {
    try {
      const [latest, pending] = await withTimeout(
        Promise.all([
          unresolved.provider!.getTransactionCount(unresolved.submission.account, "latest"),
          unresolved.provider!.getTransactionCount(unresolved.submission.account, "pending"),
        ]),
        PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS,
        "wallet activity check timed out.",
      );
      return { latest, pending, conclusive: true } as const;
    } catch {
      return { latest: null, pending: null, conclusive: false } as const;
    }
  };
  const hasNonceActivity = (snapshot: Awaited<ReturnType<typeof readNonceSnapshot>>) =>
    snapshot.conclusive && (
      snapshot.latest > unresolved.submission.nonce ||
      snapshot.pending > unresolved.submission.nonce
    );

  const firstNonceSnapshot = await readNonceSnapshot();
  if (!hasNonceActivity(firstNonceSnapshot) && firstNonceSnapshot.conclusive) {
    await sleep(MINT_RECOVERY_NONCE_RECHECK_MS);
  }

  const lateDurable = readPendingMintTransaction();
  if (lateDurable) {
    pendingMintTransaction = lateDurable;
    projectPendingMintTransaction(lateDurable, {
      deploymentWarning: !isPendingMintDeploymentCompatible(lateDurable),
    });
    if (isPendingMintDeploymentCompatible(lateDurable)) {
      const receipt = await readKnownMintReceiptOnce(lateDurable.hash);
      if (receipt && await reconcileKnownMintReceipt(lateDurable, receipt, false)) {
        return;
      }
      resumePendingMintReceiptMonitoring();
    }
    syncInterface();
    return;
  }

  if (unresolvedMintSubmission?.requestId !== unresolved.requestId) {
    syncInterface();
    return;
  }

  const secondNonceSnapshot = firstNonceSnapshot.conclusive && !hasNonceActivity(firstNonceSnapshot)
    ? await readNonceSnapshot()
    : firstNonceSnapshot;
  const nonceAdvanced = hasNonceActivity(firstNonceSnapshot) || hasNonceActivity(secondNonceSnapshot);
  const safelyClear =
    firstNonceSnapshot.conclusive &&
    secondNonceSnapshot.conclusive &&
    !nonceAdvanced;

  if (safelyClear) {
    unresolved.releaseLockAfterRecovery();
    try {
      await withTimeout(
        unresolved.releaseCompleted,
        PATH_AUTHORIZATION_REQUEST_TIMEOUT_MS,
        "mint recovery release timed out.",
      );
      setMintFlowError(
        "Recovery check complete: two nonce checks found no hash or account activity. The old wallet waiter is detached and any late hash will still be retained and monitored. Retry only after confirming the wallet shows no open request.",
        "mint",
        { preserveAuthorization: true },
      );
      emitThoughtConsoleEvent({
        kind: "mint_submission_detached",
        title: "wallet waiter safely detached",
        detail: "No hash or nonce activity was found twice. Any late transaction remains monitored.",
        eventId: `mint-submission-detached:${unresolved.requestId}`,
        tone: "warning",
      });
      syncInterface();
      return;
    } catch {
      // A failed release is inconclusive; keep the UI in no-duplicate mode.
    }
  }

  setMintFlowError(
    nonceAdvanced
      ? `Wallet activity was detected at nonce ${unresolved.submission.nonce}, but no transaction hash has returned. The original submission is unresolved; do not submit a duplicate.`
      : "Wallet activity could not be ruled out twice. The original wallet request is still unresolved. Cancel or reject it in the wallet and wait for it to settle; do not submit a duplicate.",
    "mint",
    { preserveAuthorization: true, preserveSubmittedTransaction: true },
  );
  emitThoughtConsoleEvent({
    kind: "mint_activity_checked",
    title: nonceAdvanced ? "wallet activity detected" : "wallet request still unresolved",
    detail: mintFlowData.error,
    eventId: `mint-activity-checked:${unresolved.requestId}:${nonceAdvanced ? "advanced" : "waiting"}`,
    tone: "warning",
  });
  syncInterface();
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const readPathAcquisitionQuote = async () => {
  const provider = getPathReadProvider();
  if (!provider || !PATH_AUCTION_ADDRESS || !PATH_PULSE_ADAPTER_ADDRESS || !PATH_NFT_ADDRESS) {
    throw new Error("This V2 deployment has no in-place $PATH auction configured.");
  }

  const auction = new Contract(PATH_AUCTION_ADDRESS, PATH_AUCTION_ABI, provider);
  const adapter = new Contract(PATH_PULSE_ADAPTER_ADDRESS, PATH_PULSE_ADAPTER_ABI, provider);
  const [auctionCode, adapterCode, pathCode] = await Promise.all([
    provider.getCode(PATH_AUCTION_ADDRESS),
    provider.getCode(PATH_PULSE_ADAPTER_ADDRESS),
    provider.getCode(PATH_NFT_ADDRESS),
  ]);
  if (auctionCode === "0x" || adapterCode === "0x" || pathCode === "0x") {
    throw new Error("The configured $PATH auction deployment is unavailable on this network.");
  }

  const [active, price, mintAdapter, paymentToken, adapterAuction, adapterPathNft, wiringFrozen] =
    await Promise.all([
      auction.curveActive() as Promise<boolean>,
      auction.getCurrentPrice() as Promise<bigint>,
      auction.mintAdapter() as Promise<string>,
      auction.paymentToken() as Promise<string>,
      adapter.auction() as Promise<string>,
      adapter.pathNft() as Promise<string>,
      adapter.wiringFrozen() as Promise<boolean>,
    ]);

  if (!active) throw new Error("The $PATH auction is not open yet.");
  if (price <= 0n) throw new Error("The $PATH auction returned an invalid price.");
  if (
    mintAdapter.toLowerCase() !== PATH_PULSE_ADAPTER_ADDRESS.toLowerCase() ||
    adapterAuction.toLowerCase() !== PATH_AUCTION_ADDRESS.toLowerCase() ||
    adapterPathNft.toLowerCase() !== PATH_NFT_ADDRESS.toLowerCase() ||
    !wiringFrozen
  ) {
    throw new Error("The $PATH auction is not wired to this THOUGHT V2 deployment.");
  }
  if (paymentToken.toLowerCase() !== ZERO_ADDRESS) {
    throw new Error("This $PATH auction uses a token approval flow that is not supported here yet.");
  }

  return { price };
};

const pathAcquisitionFailureCopy = (error: unknown) => {
  const message = String(
    (error as { shortMessage?: unknown; message?: unknown })?.shortMessage ??
      (error as Error)?.message ??
      error ??
      "",
  );
  const code = String((error as { code?: unknown })?.code ?? "");
  if (code === "4001" || /reject|denied|cancel/i.test(message)) {
    return "$PATH transaction rejected in wallet.";
  }
  if (code === "-32002" || /already.*(?:pending|open)|request.*pending/i.test(message)) {
    return "A wallet request is already open.";
  }
  if (/insufficient funds|exceeds balance/i.test(message)) {
    return `Insufficient ${THOUGHT_CURRENCY_LABEL} for the $PATH price and gas.`;
  }
  return message || "$PATH mint failed.";
};

const setPathAcquisitionError = (error: unknown) => {
  pathAcquisitionRequestId += 1;
  pathAcquisitionState = "error";
  pathAcquisitionError = pathAcquisitionFailureCopy(error);
  emitThoughtConsoleEvent({
    kind: "path_acquisition_failed",
    title: "$PATH mint unavailable",
    detail: pathAcquisitionError,
    nextStep: "retry here, or explore $PATH at /path",
    tone: "warning",
    eventId: `path-acquisition-failed:${mintAttemptId}:${pathAcquisitionError}`,
  });
  syncInterface();
  focusMintDockStage();
};

const handleMintPath = async (options?: { submit?: boolean }) => {
  if (!currentOutputText) {
    setMintFlowError("No accepted work to preserve for $PATH mint.", "thought");
    syncInterface();
    return;
  }
  if (!walletState.address) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    return;
  }
  if (walletState.chainId !== THOUGHT_CHAIN_ID) {
    setMintFlowError("wrong network.", "wrong_network");
    syncInterface();
    return;
  }
  if (readPendingPathAcquisition()) {
    await resumePendingPathAcquisition();
    return;
  }

  const requestId = pathAcquisitionRequestId + 1;
  pathAcquisitionRequestId = requestId;
  pathAcquisitionState = "quoting";
  pathAcquisitionError = "";
  pathAcquisitionTxHash = "";
  syncInterface();

  try {
    const quote = await readPathAcquisitionQuote();
    if (requestId !== pathAcquisitionRequestId) return;
    pathAcquisitionPrice = quote.price;
    pathAcquisitionState = "review";
    emitThoughtConsoleEvent({
      kind: "path_acquisition_quote",
      title: "$PATH quote ready",
      detail: `${formatPathAcquisitionPrice(quote.price)} ${THOUGHT_CURRENCY_LABEL} at the current auction price.`,
      nextStep: "mint here, or explore $PATH at /path",
      eventId: `path-acquisition-quote:${mintAttemptId}:${quote.price}`,
    });
    syncInterface();
    focusMintDockStage();
    if (options?.submit) {
      await confirmPathAcquisition();
    }
  } catch (error) {
    if (requestId !== pathAcquisitionRequestId) return;
    setPathAcquisitionError(error);
  }
};

const finishPathAcquisitionReceipt = async (
  pending: PendingThoughtPathAcquisition,
  receipt: { status?: unknown; logs?: readonly { address?: string; topics?: readonly string[] }[] },
) => {
  const outcome = mintReceiptStatusOutcome(receipt.status);
  if (outcome === "unknown") return false;
  pathAcquisitionReceiptMonitorHash = "";
  if (outcome === "reverted") {
    writePendingPathAcquisition(null);
    setPathAcquisitionError("$PATH transaction reverted on-chain.");
    return true;
  }

  const tokenId = pathTokenIdFromMintReceipt(receipt, pending.account);
  writePendingPathAcquisition(null);
  pathAcquisitionState = "idle";
  pathAcquisitionError = "";
  pathAcquisitionTxHash = pending.txHash;
  pathAcquisitionCompletedForAttempt = true;
  emitThoughtConsoleEvent({
    kind: "path_acquisition_confirmed",
    title: "$PATH minted",
    detail: tokenId
      ? `$PATH #${tokenId} confirmed. Picking it for this THOUGHT.`
      : "$PATH confirmed. Refreshing inventory for this THOUGHT.",
    eventId: `path-acquisition-confirmed:${pending.txHash}`,
    tone: "success",
  });

  await refreshPathInventoryForCurrentWallet({ force: true });
  if (tokenId) {
    applyMintPathInputValue(tokenId);
    syncInterface();
    await checkPathEligibility();
    return true;
  }

  const available = availablePathInventoryItems();
  if (available.length === 1) {
    selectPathInventoryItem(available[0].pathId);
    return true;
  }

  setPathAcquisitionError(
    available.length > 1
      ? "$PATH confirmed, but the minted token could not be identified. Pick it from the updated list."
      : "$PATH confirmed, but the updated token is not visible in inventory yet. Refresh wallet from the shell bar.",
  );
  return true;
};

const monitorPendingPathAcquisition = async (pending: PendingThoughtPathAcquisition) => {
  if (pathAcquisitionReceiptMonitorHash === pending.txHash) return;
  pathAcquisitionReceiptMonitorHash = pending.txHash;
  while (pathAcquisitionReceiptMonitorHash === pending.txHash) {
    for (const provider of getMintReceiptMonitoringProviders()) {
      try {
        const receipt = await provider.getTransactionReceipt(pending.txHash);
        if (receipt && await finishPathAcquisitionReceipt(pending, receipt)) return;
      } catch {
        // Keep the durable hash and retry through the available providers.
      }
    }
    await sleep(MINT_RECEIPT_POLL_MS);
  }
};

const resumePendingPathAcquisition = async () => {
  const pending = readPendingPathAcquisition();
  if (!pending) return false;
  const workHash = currentOutputText ? keccak256(toUtf8Bytes(currentOutputText)) : "";
  const expected = {
    account: walletState.address,
    chainId: THOUGHT_CHAIN_ID,
    auction: PATH_AUCTION_ADDRESS,
    pathNft: PATH_NFT_ADDRESS,
    workHash,
  };
  if (!pendingThoughtPathAcquisitionMatches(pending, expected)) {
    pathAcquisitionState = "error";
    pathAcquisitionTxHash = pending.txHash;
    pathAcquisitionError = "A pending $PATH transaction belongs to another wallet, work, or V2 deployment.";
    emitThoughtConsoleEvent({
      kind: "path_acquisition_context_mismatch",
      title: "$PATH mint context changed",
      detail: "The retained transaction hash will not be applied to this THOUGHT.",
      nextStep: "restore the original wallet and work",
      tone: "warning",
      eventId: `path-acquisition-mismatch:${pending.txHash}`,
    });
    syncInterface();
    return true;
  }

  pathAcquisitionState = "submitted";
  pathAcquisitionTxHash = pending.txHash;
  pathAcquisitionError = "";
  syncInterface();
  void monitorPendingPathAcquisition(pending);
  return true;
};

const blockPendingPathAcquisitionMutation = () => {
  const pending = readPendingPathAcquisition();
  if (!pending && pathAcquisitionState !== "awaiting_signature") return false;
  if (pending) {
    void resumePendingPathAcquisition();
  }
  emitThoughtConsoleEvent({
    kind: "path_acquisition_preserved",
    title: pending ? "$PATH mint still pending" : "$PATH wallet request still open",
    detail: pending
      ? `${shortHex(pending.txHash, 10, 8)} remains attached to this work.`
      : "Resolve or reject the wallet request before changing this work.",
    eventId: pending
      ? `path-acquisition-preserved:${pending.txHash}`
      : `path-acquisition-wallet-preserved:${mintAttemptId}`,
    tone: "warning",
    nextStep: pending ? "wait for confirmation" : "resolve the wallet request",
  });
  syncInterface();
  return true;
};

const confirmPathAcquisition = async () => {
  if (pathAcquisitionState !== "review" || pathAcquisitionPrice <= 0n) return;
  const ethereum = getEthereumProvider();
  if (!ethereum || !walletState.address || walletState.chainId !== THOUGHT_CHAIN_ID) {
    setPathAcquisitionError("Connect the correct wallet and network before minting $PATH.");
    return;
  }

  const requestId = pathAcquisitionRequestId + 1;
  pathAcquisitionRequestId = requestId;
  const expectedAccount = walletState.address;
  const workHash = keccak256(toUtf8Bytes(currentOutputText));
  pathAcquisitionState = "awaiting_signature";
  pathAcquisitionError = "";
  emitThoughtConsoleEvent({
    kind: "path_acquisition_wallet",
    title: "confirm $PATH mint",
    detail: "Wallet request 1 of 3 for the complete THOUGHT flow.",
    eventId: `path-acquisition-wallet:${mintAttemptId}`,
  });
  syncInterface();

  try {
    const lockResult = await withThoughtPathAcquisitionLock(
      typeof navigator.locks?.request === "function"
        ? navigator.locks as unknown as Parameters<typeof withThoughtPathAcquisitionLock>[0]
        : null,
      async () => {
        if (readPendingPathAcquisition()) {
          throw new Error("A $PATH mint transaction is already pending.");
        }
        const [accounts, chainHex] = await Promise.all([
          ethereum.request({ method: "eth_accounts" }),
          ethereum.request({ method: "eth_chainId" }),
        ]);
        const liveAccount = extractPrimaryAccount(accounts);
        const liveChainId = typeof chainHex === "string" ? Number(BigInt(chainHex)) : null;
        if (liveAccount.toLowerCase() !== expectedAccount.toLowerCase()) {
          throw new Error("Wallet account changed before $PATH mint.");
        }
        if (liveChainId !== THOUGHT_CHAIN_ID) {
          throw new Error("Wrong network for $PATH mint.");
        }

        const quote = await readPathAcquisitionQuote();
        pathAcquisitionPrice = quote.price;
        const browserProvider = new BrowserProvider(ethereum);
        const signer = await browserProvider.getSigner(expectedAccount);
        const auction = new Contract(PATH_AUCTION_ADDRESS, PATH_AUCTION_ABI, signer);
        const tx = await auction.bid(quote.price, { value: quote.price }) as { hash: string };
        const pending: PendingThoughtPathAcquisition = Object.freeze({
          version: 1,
          account: expectedAccount.toLowerCase(),
          chainId: THOUGHT_CHAIN_ID,
          auction: PATH_AUCTION_ADDRESS.toLowerCase(),
          pathNft: PATH_NFT_ADDRESS.toLowerCase(),
          workHash: workHash.toLowerCase(),
          txHash: tx.hash.toLowerCase(),
          updatedAt: Date.now(),
        });
        writePendingPathAcquisition(pending);
        return pending;
      },
    );

    if (requestId !== pathAcquisitionRequestId) return;
    if (!lockResult.acquired) {
      throw new Error(
        lockResult.reason === "busy"
          ? "This $PATH mint is already open in another tab."
          : "$PATH minting requires browser tab coordination (Web Locks).",
      );
    }
    pathAcquisitionState = "submitted";
    pathAcquisitionTxHash = lockResult.value.txHash;
    emitThoughtConsoleEvent({
      kind: "path_acquisition_submitted",
      title: "$PATH mint submitted",
      detail: `${shortHex(lockResult.value.txHash, 10, 8)} · waiting for confirmation.`,
      eventId: `path-acquisition-submitted:${lockResult.value.txHash}`,
    });
    syncInterface();
    void monitorPendingPathAcquisition(lockResult.value);
  } catch (error) {
    if (requestId !== pathAcquisitionRequestId) return;
    setPathAcquisitionError(error);
  }
};

const viewPathAcquisitionTx = async () => {
  if (!pathAcquisitionTxHash) return;
  const txUrl = thoughtTxUrl(pathAcquisitionTxHash);
  if (txUrl) {
    window.open(txUrl, "_blank", "noopener,noreferrer");
    return;
  }
  await copyToClipboard(pathAcquisitionTxHash);
};

const chooseAnotherPath = () => {
  clearMintAuthorization();
  walletState.txState = "idle";
  walletState.txError = "";
  mintFlowData.error = "";
  mintFlowData.errorKind = "none";
  mintFlowData.pathIdInput = "";
  mintFlowData.pathId = null;
  const pathSelectionReady = moveMintFlowToWalletOrPathSelection();
  syncInterface();
  if (pathSelectionReady) {
    focusMintPathInput();
  }
};

const handleMintSheetAction = async (action: MintSheetAction) => {
  if (action === "none") {
    return;
  }

  if (action === "continue") {
    await checkPathEligibility();
    return;
  }

  if (action === "connect_wallet") {
    await requestWalletConnect();
    if (blockPendingMintMutation()) {
      return;
    }
    if (walletState.address && readPathMintHandoff()) {
      const resumed = await resumePathMintHandoff();
      if (resumed) {
        return;
      }
    }
    if (!walletState.address) {
      mintFlowState = "wallet_required";
      recordCurrentMintConsoleState();
    } else if (walletState.chainId !== THOUGHT_CHAIN_ID) {
      setMintFlowError("wrong network.", "wrong_network");
    } else {
      mintFlowState = "path_required";
      mintFlowData.error = "";
      mintFlowData.errorKind = "none";
      recordCurrentMintConsoleState();
    }
    syncInterface();
    focusMintDockStage("path");
    return;
  }

  if (action === "disconnect_wallet") {
    disconnectThoughtDockWallet();
    return;
  }

  if (action === "authorize") {
    await authorizeMint();
    return;
  }

  if (action === "confirm_mint") {
    await confirmMint();
    focusMintDockStage();
    return;
  }

  if (action === "view_tx") {
    await handleViewTx();
    return;
  }

  if (action === "recover_submission") {
    await recoverUnresolvedMintSubmission();
    return;
  }

  if (action === "view_thought") {
    await handleViewThought(walletState.mintedTokenId ?? mintFlowData.existingTokenId);
    return;
  }

  if (action === "choose_another") {
    chooseAnotherPath();
    return;
  }

  if (action === "enter_path_manually") {
    focusMintPathInput();
    return;
  }

  if (action === "mint_path") {
    await handleMintPath({ submit: true });
    return;
  }

  if (action === "confirm_path_mint") {
    await confirmPathAcquisition();
    return;
  }

  if (action === "view_path_tx") {
    await viewPathAcquisitionTx();
    return;
  }

  if (action === "reset") {
    closeMintSheet();
    resetThought();
    return;
  }

  if (action === "switch_network") {
    await switchWalletChain();
    if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID && readPathMintHandoff()) {
      const resumed = await resumePathMintHandoff();
      if (resumed) {
        syncInterface();
        focusMintDockStage("path");
        return;
      }
    }
    if (!walletState.address) {
      mintFlowState = "wallet_required";
      recordCurrentMintConsoleState();
    } else if (walletState.chainId !== THOUGHT_CHAIN_ID) {
      setMintFlowError("wrong network.", "wrong_network");
    } else {
      mintFlowState = "path_required";
      mintFlowData.error = "";
      mintFlowData.errorKind = "none";
      recordCurrentMintConsoleState();
    }
    syncInterface();
    focusMintDockStage("path");
  }
};

const handleViewTx = async () => {
  const txHash = walletState.txHash || mintFlowData.txHash;
  if (!txHash) {
    setStatus("tx unavailable.", { flashMs: NOTICE_FLASH_MS });
    return false;
  }

  const txUrl = thoughtTxUrl(txHash);
  if (txUrl) {
    window.open(txUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  const copied = await copyToClipboard(txHash);
  if (copied) {
    setStatus("tx hash copied.", { flashMs: NOTICE_FLASH_MS });
  }
  return copied;
};

const handleViewThought = async (tokenId?: number | null) => {
  const thoughtNftId = tokenId ?? walletState.mintedTokenId ?? mintFlowData.existingTokenId;
  if (thoughtNftId === null || thoughtNftId === undefined) {
    setStatus("THOUGHT unavailable.", { flashMs: NOTICE_FLASH_MS });
    return;
  }

  window.location.href = thoughtDetailUrl(thoughtNftId);
};

const galleryUrl = (targetTokenId?: number | null) => {
  const localGalleryRoute =
    !GALLERY_URL && LOCAL_BROWSER_HOSTS.has(window.location.hostname);
  const url = new URL(
    localGalleryRoute ? `${window.location.origin}/gallery` : GALLERY_URL,
    window.location.origin,
  );
  url.search = "";
  url.hash = "";
  if (targetTokenId !== null && targetTokenId !== undefined) {
    url.hash = `thought-${targetTokenId}`;
  }
  return url.toString();
};

const thoughtDetailUrl = (tokenId: number) => {
  const url = new URL(THOUGHT_DETAIL_BASE_URL, window.location.origin);
  url.search = "";
  url.hash = "";
  url.pathname = `/thought/${tokenId}`;
  return url.toString();
};

const thoughtImageUrl = (tokenId: number) => {
  const url = new URL("/api/thought-image", window.location.origin);
  url.searchParams.set("id", tokenId.toString());
  return url.toString();
};

const pathTokenDetailUrl = (tokenId: number | string) => {
  const url = new URL(PATH_MINT_URL, sameOriginAppOrigin());
  url.search = "";
  url.hash = "";
  url.pathname = `/path/${tokenId}`;
  return url.toString();
};

const parseThoughtNFTIdInput = (input: string) => {
  const trimmed = input.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  const tokenId = Number(trimmed);
  return Number.isSafeInteger(tokenId) ? tokenId : null;
};

const viewThoughtUseLine = (tokenId?: number | null) =>
  `use: view THOUGHT ${tokenId ?? "<id>"}`;

const thoughtCreateUrl = () => new URL(THOUGHT_APP_URL, window.location.origin).toString();
const inshellHomeUrl = () => INSHELL_HOME_URL;
const configureGalleryLink = () => {
  thoughtGalleryLink.href = galleryUrl();
  thoughtDetailGalleryLink.href = galleryUrl();
  galleryCreateLink.href = thoughtCreateUrl();
  galleryHomeLink.href = inshellHomeUrl();
  thoughtDetailCreateLink.href = thoughtCreateUrl();
};

const decodeBase64Utf8 = (value: string) => {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const decodeDataUriText = (uri: string) => {
  const commaIndex = uri.indexOf(",");
  if (!uri.startsWith("data:") || commaIndex === -1) {
    throw new Error("unsupported token uri");
  }

  const header = uri.slice(0, commaIndex);
  const payload = uri.slice(commaIndex + 1);
  return header.includes(";base64") ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
};

const readTokenMetadata = (uri: string): ThoughtNFTMetadata => {
  const decoded = decodeDataUriText(uri);
  const parsed = JSON.parse(decoded) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed as ThoughtNFTMetadata;
};

const svgToImageUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const readTokenUriPayload = (uri: string): ThoughtNFTUriPayload => {
  const trimmed = uri.trim();
  if (!trimmed) {
    return { metadata: {}, image: "" };
  }

  if (/^<svg[\s>]/i.test(trimmed)) {
    return { metadata: {}, image: svgToImageUri(trimmed) };
  }

  if (trimmed.startsWith("data:image/svg+xml")) {
    return { metadata: {}, image: trimmed };
  }

  try {
    const metadata = readTokenMetadata(trimmed);
    return { metadata, image: metadata.image ?? "" };
  } catch {
    return { metadata: {}, image: "" };
  }
};

const metadataString = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  return "";
};

const metadataNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
};

const shortHex = (value: string, front = 6, back = 4) =>
  value.length > front + back + 3 ? `${value.slice(0, front)}...${value.slice(-back)}` : value;

const quoteCliText = (value: string, maxLength = 48) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  const clipped =
    normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...` : normalized;
  return `"${clipped}"`;
};

const quoteCliFullText = (value: string) => `"${value.replace(/\s+/g, " ").trim()}"`;

const formatCliModelReturnValue = (returnedText: string, canonicalText: string) => {
  const normalizedReturn = returnedText.replace(/\s+/g, " ").trim();
  if (!normalizedReturn) {
    return "unavailable";
  }
  return normalizedReturn === canonicalText.replace(/\s+/g, " ").trim()
    ? "same as text"
    : quoteCliFullText(returnedText);
};

const galleryTipTime = (mintedAt: number | null) =>
  mintedAt === null
    ? "unknown time"
    : `${new Date(mintedAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const detailTime = (mintedAt: number | null) => {
  if (mintedAt === null) {
    return "unknown time";
  }

  return new Date(mintedAt * 1000)
    .toISOString()
    .replace(".000Z", "Z")
    .replace("T", " ")
    .replace("Z", " UTC");
};

const shortDetailAddress = (value: string) => shortHex(value, 18, 10);

const parseThoughtDetailSpec = (thought: GalleryThought): ThoughtDetailSpec => {
  const fallback = {
    id: thought.thoughtSpecId,
    ref: IS_LOCAL_THOUGHT_V2 ? "THOUGHT.v2.md" : "THOUGHT.v1.md",
    hash: thought.thoughtSpecHash,
    text: "",
  };

  if (!thought.provenanceJson) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(thought.provenanceJson) as {
      thoughtSpec?: {
        id?: unknown;
        ref?: unknown;
        hash?: unknown;
      };
    };
    const thoughtSpec = parsed.thoughtSpec;
    return {
      id: typeof thoughtSpec?.id === "string" ? thoughtSpec.id : fallback.id,
      ref: typeof thoughtSpec?.ref === "string" ? thoughtSpec.ref : fallback.ref,
      hash: typeof thoughtSpec?.hash === "string" ? thoughtSpec.hash : fallback.hash,
      text: "",
    };
  } catch {
    return fallback;
  }
};

const parseProvenanceMaterial = (provenanceJson: string) => {
  if (!provenanceJson) {
    return { prompt: "", promptHash: "", returnedText: "", returnedTextHash: "", mode: "", provider: "", model: "" };
  }

  try {
    const parsed = JSON.parse(provenanceJson) as {
      prompt?: unknown;
      route?: unknown;
      provider?: unknown;
      model?: unknown;
      work?: {
        promptLine?: unknown;
        agentLine?: unknown;
        promptLineKeccak256?: unknown;
        agentLineKeccak256?: unknown;
      };
      process?: {
        kind?: unknown;
        agentDeclaration?: {
          agentLabel?: unknown;
        };
        transport?: {
          adapter?: unknown;
        };
      };
      output?: {
        returnedText?: unknown;
      };
      hashes?: {
        promptHash?: unknown;
        returnedTextHash?: unknown;
      };
    };
    if (parsed.work && typeof parsed.work === "object") {
      const prompt = typeof parsed.work.promptLine === "string" ? parsed.work.promptLine : "";
      const returnedText = typeof parsed.work.agentLine === "string" ? parsed.work.agentLine : "";
      const promptHash = typeof parsed.work.promptLineKeccak256 === "string"
        ? parsed.work.promptLineKeccak256
        : prompt ? hashText(prompt) : "";
      const returnedTextHash = typeof parsed.work.agentLineKeccak256 === "string"
        ? parsed.work.agentLineKeccak256
        : returnedText ? hashText(returnedText) : "";
      const provider = typeof parsed.process?.transport?.adapter === "string"
        ? parsed.process.transport.adapter
        : typeof parsed.process?.agentDeclaration?.agentLabel === "string"
          ? parsed.process.agentDeclaration.agentLabel
          : parsed.process?.kind === "manual" ? "me" : "";
      const model = typeof parsed.process?.agentDeclaration?.agentLabel === "string"
        ? parsed.process.agentDeclaration.agentLabel
        : provider;
      return {
        prompt,
        promptHash,
        returnedText,
        returnedTextHash,
        mode: typeof parsed.process?.kind === "string" ? parsed.process.kind : "",
        provider,
        model,
      };
    }
    const prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
    const mode = typeof parsed.route === "string" ? parsed.route : "";
    const provider = typeof parsed.provider === "string" ? parsed.provider : "";
    const model = typeof parsed.model === "string" ? parsed.model : "";
    const promptHash = typeof parsed.hashes?.promptHash === "string" ? parsed.hashes.promptHash : "";
    const returnedText = typeof parsed.output?.returnedText === "string" ? parsed.output.returnedText : "";
    const returnedTextHash =
      typeof parsed.hashes?.returnedTextHash === "string" ? parsed.hashes.returnedTextHash : "";
    return {
      prompt,
      promptHash: promptHash || (prompt ? hashText(prompt) : ""),
      returnedText,
      returnedTextHash: returnedTextHash || (returnedText ? hashText(returnedText) : ""),
      mode,
      provider,
      model,
    };
  } catch {
    return { prompt: "", promptHash: "", returnedText: "", returnedTextHash: "", mode: "", provider: "", model: "" };
  }
};

const normalizeThoughtDetail = (thought: GalleryThought): ThoughtDetail => ({
  tokenId: thought.tokenId,
  rawText: thought.rawText,
  prompt: thought.prompt,
  returnedText: thought.returnedText,
  pathId: thought.pathId,
  minter: thought.minter,
  mintedAt: thought.mintedAt,
  txHash: thought.txHash,
  textHash: thought.textHash,
  promptHash: thought.promptHash,
  returnedTextHash: thought.returnedTextHash,
  provenanceHash: thought.provenanceHash,
  mode: thought.mode,
  provider: thought.provider,
  model: thought.model,
  thoughtSpec: parseThoughtDetailSpec(thought),
  provenanceJson: thought.provenanceJson,
  image: thought.image,
});

const showThoughtDetailStatus = (message: string) => {
  if (thoughtDetailStatusTimer !== null) {
    window.clearTimeout(thoughtDetailStatusTimer);
  }
  thoughtDetailCopyStatus.textContent = message;
  if (!message) {
    return;
  }
  thoughtDetailStatusTimer = window.setTimeout(() => {
    thoughtDetailCopyStatus.textContent = "";
    thoughtDetailStatusTimer = null;
  }, NOTICE_FLASH_MS);
};

const copyThoughtDetailValue = async (value: string, label = "copied.") => {
  const copied = await copyToClipboard(value);
  showThoughtDetailStatus(copied ? label : "copy unavailable.");
};

const formatProvenanceJson = (value: string) => {
  if (!value) {
    return "{}";
  }

  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
};

const thoughtDetailTextBlocks = [
  thoughtDetailCanonicalTitle,
  thoughtDetailPrompt,
  thoughtDetailModelReturn,
];

const thoughtDetailTextLineHeight = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.55;
};

const thoughtDetailNeedsTextWindow = (element: HTMLElement) =>
  element.scrollHeight > thoughtDetailTextLineHeight(element) * 2 + 1;

const syncThoughtDetailTextBlocks = () => {
  window.cancelAnimationFrame(thoughtDetailTextFrame);

  thoughtDetailTextFrame = window.requestAnimationFrame(() => {
    thoughtDetailTextBlocks.forEach((element) => {
      element.classList.remove("is-embedded");
      element.scrollTop = 0;
    });

    thoughtDetailTextBlocks.forEach((element) => {
      element.classList.toggle("is-embedded", thoughtDetailNeedsTextWindow(element));
    });

    syncThoughtDetailEmbeddedHeights();
  });
};

const setThoughtDetailTextBlock = (element: HTMLElement, value: string) => {
  element.textContent = value;
  element.classList.remove("is-embedded");
  syncThoughtDetailTextBlocks();
};

const visibleThoughtDetailEmbeds = () =>
  [
    thoughtDetailJsonPanel.classList.contains("is-hidden") ? null : thoughtDetailProvenanceJson,
  ].filter((element): element is HTMLElement => element !== null);

const thoughtDetailRailContentBottom = () =>
  Array.from(thoughtDetailRail.children).reduce(
    (bottom, element) => Math.max(bottom, element.getBoundingClientRect().bottom),
    thoughtDetailRail.getBoundingClientRect().top,
  );

const syncThoughtDetailEmbeddedHeights = () => {
  window.cancelAnimationFrame(thoughtDetailEmbeddedHeightFrame);

  thoughtDetailEmbeddedHeightFrame = window.requestAnimationFrame(() => {
    const embeddedWindows = visibleThoughtDetailEmbeds();
    embeddedWindows.forEach((element) => {
      element.style.maxHeight = "";
    });

    if (
      !embeddedWindows.length ||
      window.matchMedia("(max-width: 900px)").matches ||
      thoughtDetailBody.classList.contains("is-hidden")
    ) {
      return;
    }

    const canvasFrame = thoughtDetailImage.closest(".thought-detail__canvas-frame") as HTMLElement | null;
    if (!canvasFrame) {
      return;
    }

    const targetBottom = canvasFrame.getBoundingClientRect().bottom;
    const railBottom = thoughtDetailRailContentBottom();
    const overflow = Math.ceil(railBottom - targetBottom);

    if (overflow <= 0) {
      return;
    }

    const minimumHeight = 120;
    const reducibleHeights = embeddedWindows.map((element) =>
      Math.max(0, element.getBoundingClientRect().height - minimumHeight),
    );
    const totalReducibleHeight = reducibleHeights.reduce((sum, value) => sum + value, 0);

    if (totalReducibleHeight <= 0) {
      embeddedWindows.forEach((element) => {
        element.style.maxHeight = `${minimumHeight}px`;
      });
      return;
    }

    embeddedWindows.forEach((element, index) => {
      const currentHeight = element.getBoundingClientRect().height;
      const reduction = overflow * (reducibleHeights[index] / totalReducibleHeight);
      element.style.maxHeight = `${Math.max(minimumHeight, currentHeight - reduction - 2)}px`;
    });

    thoughtDetailEmbeddedHeightFrame = window.requestAnimationFrame(() => {
      const remainingOverflow = Math.ceil(thoughtDetailRailContentBottom() - targetBottom);
      if (remainingOverflow <= 0) {
        return;
      }

      const lastWindow = embeddedWindows[embeddedWindows.length - 1];
      const currentMaxHeight =
        Number.parseFloat(lastWindow.style.maxHeight) || lastWindow.getBoundingClientRect().height;
      lastWindow.style.maxHeight = `${Math.max(minimumHeight, currentMaxHeight - remainingOverflow - 2)}px`;
    });
  });
};

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const galleryThumbnailUri = (rawText: string) => {
  const title = thoughtProtocolText(rawText, IS_LOCAL_THOUGHT_V2);
  const chars = Array.from(title);
  const { imageSize, gap, rowWidth } = fitImagesToRow(chars.length, CANVAS_WIDTH);
  const xStart = (CANVAS_WIDTH - rowWidth) / 2;
  const yStart = (CANVAS_WIDTH - imageSize) / 2;
  const blocks = chars.map((char, index) => {
    if (char === " ") {
      return "";
    }

    const x = xStart + index * (imageSize + gap);
    return `<rect x="${x}" y="${yStart}" width="${imageSize}" height="${imageSize}" fill="${colorForCharacter(char)}"/>`;
  }).join("");
  const textSize = contractLikeSvgTextSize(chars.length);
  const label = title
    ? `<text x="${CANVAS_WIDTH / 2}" y="${CANVAS_WIDTH - CANVAS_PADDING}" font-family="monospace" font-size="${textSize}" font-weight="100" text-anchor="middle" fill="${CANVAS_LABEL_FILL}" fill-opacity="0.72">${escapeSvgText(title)}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_WIDTH}" shape-rendering="crispEdges"><rect width="${CANVAS_WIDTH}" height="${CANVAS_WIDTH}" fill="${BACKGROUND_FILL}"/>${blocks}${label}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const contractLikeSvgTextSize = (charCount: number) => {
  if (charCount <= 0) {
    return SVG_TEXT_MAX_SIZE;
  }

  const availableWidth = CANVAS_WIDTH - 2 * CANVAS_PADDING;
  const fitSize = Math.floor(availableWidth / (charCount * SVG_TEXT_CHAR_ADVANCE));
  return Math.max(SVG_TEXT_MIN_SIZE, Math.min(SVG_TEXT_MAX_SIZE, fitSize));
};

const renderGalleryCard = (thought: GalleryThought) => {
  const card = document.createElement("article");
  card.className = "thought-gallery__card";
  card.dataset.tokenId = thought.tokenId.toString();
  const title = thoughtProtocolText(thought.rawText, IS_LOCAL_THOUGHT_V2);

  const imageLink = document.createElement("a");
  imageLink.className = "thought-gallery__thumb";
  imageLink.href = thoughtDetailUrl(thought.tokenId);
  imageLink.setAttribute("aria-label", `Open THOUGHT #${thought.tokenId}`);

  const image = document.createElement("img");
  image.className = "thought-gallery__image";
  image.src = thought.image
    ? IS_LOCAL_THOUGHT_V2 ? thought.image : thoughtImageUrl(thought.tokenId)
    : galleryThumbnailUri(title);
  image.alt = `THOUGHT #${thought.tokenId}`;
  image.loading = "lazy";

  const tip = document.createElement("span");
  tip.className = "thought-gallery__tip";
  const tipTitle = document.createElement("strong");
  tipTitle.textContent = `THOUGHT #${thought.tokenId}`;
  const tipText = document.createElement("span");
  tipText.textContent = title || "(empty)";
  const tipBreak = document.createElement("span");
  tipBreak.className = "thought-gallery__tip-break";
  tipBreak.setAttribute("aria-hidden", "true");
  const tipPath = document.createElement("span");
  tipPath.textContent = `$PATH #${thought.pathId} THOUGHT mint used`;
  const tipMinted = document.createElement("span");
  tipMinted.textContent = `minted ${galleryTipTime(thought.mintedAt)}`;
  const tipMinter = document.createElement("span");
  tipMinter.textContent = `by ${shortHex(thought.minter, 6, 4)}`;
  tip.append(tipTitle, tipText, tipBreak, tipPath, tipMinted, tipMinter);

  imageLink.append(image, tip);
  card.append(imageLink);
  return card;
};

const isGalleryThought = (value: GalleryThought | null): value is GalleryThought => value !== null;

let galleryThoughtCache: GalleryThoughtCachePayload | null = null;

const thoughtGalleryCacheKey = () =>
  [
    "thought-gallery",
    "v1",
    THOUGHT_CHAIN_ID,
    THOUGHT_NFT_ADDRESS.toLowerCase(),
    THOUGHT_NFT_DEPLOY_BLOCK,
    THOUGHT_LOG_CHUNK_SIZE,
  ].join(":");

const isGalleryThoughtRecord = (value: unknown): value is GalleryThought => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<GalleryThought>;
  return (
    typeof item.tokenId === "number" &&
    Number.isFinite(item.tokenId) &&
    typeof item.pathId === "string" &&
    typeof item.minter === "string" &&
    typeof item.textHash === "string" &&
    typeof item.promptHash === "string" &&
    typeof item.provenanceHash === "string" &&
    typeof item.thoughtSpecId === "string" &&
    typeof item.thoughtSpecHash === "string" &&
    (typeof item.mintedAt === "number" || item.mintedAt === null) &&
    typeof item.rawText === "string" &&
    typeof item.prompt === "string" &&
    typeof item.mode === "string" &&
    typeof item.provider === "string" &&
    typeof item.model === "string" &&
    typeof item.returnedText === "string" &&
    typeof item.returnedTextHash === "string" &&
    typeof item.provenanceJson === "string" &&
    typeof item.image === "string" &&
    typeof item.tokenUri === "string" &&
    typeof item.txHash === "string" &&
    typeof item.blockNumber === "number" &&
    Number.isFinite(item.blockNumber)
  );
};

const validGalleryThoughtCache = (payload: GalleryThoughtCachePayload | null) => {
  if (!payload || !Number.isFinite(payload.cachedAt)) {
    return null;
  }
  if (Date.now() - payload.cachedAt > THOUGHT_GALLERY_CACHE_TTL_MS) {
    return null;
  }
  if (!Array.isArray(payload.thoughts) || !payload.thoughts.every(isGalleryThoughtRecord)) {
    return null;
  }
  return payload.thoughts;
};

const readThoughtGalleryCache = () => {
  const memory = validGalleryThoughtCache(galleryThoughtCache);
  if (memory) {
    return memory;
  }

  const storage = getSessionStorage();
  const raw = storage?.getItem(thoughtGalleryCacheKey()) ?? null;
  if (!raw) {
    galleryThoughtCache = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GalleryThoughtCachePayload;
    const thoughts = validGalleryThoughtCache(parsed);
    if (!thoughts) {
      storage?.removeItem(thoughtGalleryCacheKey());
      galleryThoughtCache = null;
      return null;
    }
    galleryThoughtCache = parsed;
    return thoughts;
  } catch {
    storage?.removeItem(thoughtGalleryCacheKey());
    galleryThoughtCache = null;
    return null;
  }
};

const writeThoughtGalleryCache = (thoughts: GalleryThought[]) => {
  const payload: GalleryThoughtCachePayload = {
    cachedAt: Date.now(),
    thoughts,
  };
  galleryThoughtCache = payload;
  try {
    getSessionStorage()?.setItem(thoughtGalleryCacheKey(), JSON.stringify(payload));
  } catch {
    // Browser storage is best-effort; live chain reads remain the source of truth.
  }
};

const shouldUseThoughtGalleryApi = () => {
  if (IS_LOCAL_THOUGHT_V2 || !GALLERY_API_URL || typeof fetch !== "function") {
    return false;
  }
  return true;
};

const readGalleryThoughtsFromApi = async (): Promise<GalleryThought[] | null> => {
  if (!shouldUseThoughtGalleryApi()) {
    return null;
  }

  const response = await fetch(GALLERY_API_URL, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "default",
  });
  if (!response.ok) {
    throw new Error(`gallery api unavailable: ${response.status}`);
  }
  const payload = (await response.json()) as { thoughts?: unknown };
  if (!Array.isArray(payload.thoughts)) {
    throw new Error("gallery api returned invalid payload");
  }
  const thoughts = payload.thoughts.filter(isGalleryThoughtRecord);
  thoughts.sort((left, right) => left.tokenId - right.tokenId);
  writeThoughtGalleryCache(thoughts);
  return thoughts;
};

const clearThoughtGalleryCache = () => {
  galleryThoughtCache = null;
  try {
    getSessionStorage()?.removeItem(thoughtGalleryCacheKey());
  } catch {
    // Ignore unavailable browser storage.
  }
};

const getThoughtMintedLogs = async (provider: JsonRpcProvider) => {
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.min(Math.max(0, THOUGHT_NFT_DEPLOY_BLOCK), latestBlock);
  const logs: Log[] = [];

  for (let chunkStart = fromBlock; chunkStart <= latestBlock; chunkStart += THOUGHT_LOG_CHUNK_SIZE) {
    const chunkEnd = Math.min(latestBlock, chunkStart + THOUGHT_LOG_CHUNK_SIZE - 1);
    logs.push(
      ...(await provider.getLogs({
        address: THOUGHT_NFT_ADDRESS,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
        topics: [THOUGHT_MINTED_TOPIC],
      })),
    );
  }

  return logs;
};

const readGalleryThoughts = async (options?: { bypassCache?: boolean }): Promise<GalleryThought[] | null> => {
  if (!options?.bypassCache) {
    const cached = readThoughtGalleryCache();
    if (cached) {
      return cached;
    }
  }

  try {
    const apiThoughts = await readGalleryThoughtsFromApi();
    if (apiThoughts) {
      return apiThoughts;
    }
  } catch {
    // Fall back to the legacy direct chain read when the cached API is unavailable.
  }

  const provider = getReadProvider();
  const token = getReadThoughtNFT();
  if (!provider || !token || !THOUGHT_NFT_ADDRESS) {
    return null;
  }

  const logs = await getThoughtMintedLogs(provider);

  const thoughts = (
    await Promise.all(logs.map(async (log): Promise<GalleryThought | null> => {
      try {
        const parsed = token.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed || parsed.name !== "ThoughtMinted") {
          return null;
        }

        if (IS_LOCAL_THOUGHT_V2) {
          const tokenId = Number(parsed.args.tokenId as bigint);
          const minter = String(parsed.args.minter);
          const pathId = (parsed.args.pathId as bigint).toString();
          const promptHash = String(parsed.args.promptLineHash);
          const agentLineHash = String(parsed.args.agentLineHash);
          const thoughtSpecId = String(parsed.args.thoughtSpecId);
          const thoughtSpecHash = String(parsed.args.thoughtSpecHash);
          const [prompt, agentLine, provenanceJson, provenanceHash, mintedAtValue, tokenUri] =
            await Promise.all([
              token.promptLineOf(tokenId) as Promise<string>,
              token.agentLineOf(tokenId) as Promise<string>,
              token.provenanceOf(tokenId) as Promise<string>,
              token.provenanceHashOf(tokenId) as Promise<string>,
              token.mintedAtOf(tokenId) as Promise<bigint>,
              token.tokenURI(tokenId, { gasLimit: TOKEN_URI_CALL_GAS_LIMIT }) as Promise<string>,
            ]);
          const payload = readTokenUriPayload(tokenUri);
          const provenanceMaterial = parseProvenanceMaterial(provenanceJson);
          return {
            tokenId,
            pathId,
            minter,
            textHash: agentLineHash,
            promptHash,
            provenanceHash,
            thoughtSpecId,
            thoughtSpecHash,
            mintedAt: Number(mintedAtValue),
            rawText: agentLine,
            prompt: prompt || provenanceMaterial.prompt,
            mode: provenanceMaterial.mode,
            provider: provenanceMaterial.provider,
            model: provenanceMaterial.model,
            returnedText: agentLine,
            returnedTextHash: agentLineHash,
            provenanceJson,
            image: payload.image || galleryThumbnailUri(agentLine),
            tokenUri,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          };
        }

        const tokenId = Number(parsed.args[0] as bigint);
        const minter = String(parsed.args[1]);
        const pathId = (parsed.args[2] as bigint).toString();
        const textHash = String(parsed.args[3]);
        const provenanceHash = String(parsed.args[4]);
        const thoughtSpecId = String(parsed.args[5]);
        const thoughtSpecHash = String(parsed.args[6]);
        const eventMintedAt = Number(parsed.args[7] as bigint);
        let tokenUri = "";
        let metadata: ThoughtNFTMetadata = {};
        let tokenImage = "";
        try {
          tokenUri = (await token.tokenURI(tokenId, { gasLimit: TOKEN_URI_CALL_GAS_LIMIT })) as string;
          const payload = readTokenUriPayload(tokenUri);
          metadata = payload.metadata;
          tokenImage = payload.image;
        } catch {
          // Long v0.8 works can exceed conservative eth_call gas defaults for tokenURI.
          tokenUri = "";
        }
        const properties = metadata.properties ?? {};
        const thoughtEnvelope = metadata.thought ?? {};
        const rawText =
          metadataString(properties.rawText) ||
          metadataString(thoughtEnvelope.text) ||
          String(await token.rawTextOf(tokenId));
        let onchainProvenanceJson = "";
        try {
          onchainProvenanceJson = String(await token.provenanceOf(tokenId));
        } catch {
          onchainProvenanceJson = "";
        }
        const provenanceJson =
          onchainProvenanceJson ||
          metadataString(properties.provenanceJson) ||
          metadataString(thoughtEnvelope.provenance) ||
          "";
        const provenanceMaterial = parseProvenanceMaterial(provenanceJson);

        return {
          tokenId,
          pathId: metadataString(properties.pathId) || pathId,
          minter: metadataString(properties.minter) || minter,
          textHash: metadataString(properties.textHash) || textHash,
          promptHash: metadataString(properties.promptHash) || provenanceMaterial.promptHash,
          provenanceHash: metadataString(properties.provenanceHash) || provenanceHash,
          thoughtSpecId: metadataString(properties.thoughtSpecId) || thoughtSpecId,
          thoughtSpecHash: metadataString(properties.thoughtSpecHash) || thoughtSpecHash,
          mintedAt: metadataNumber(properties.mintedAt) ?? eventMintedAt,
          rawText,
          prompt: provenanceMaterial.prompt,
          mode: provenanceMaterial.mode,
          provider: provenanceMaterial.provider,
          model: provenanceMaterial.model,
          returnedText: provenanceMaterial.returnedText,
          returnedTextHash: provenanceMaterial.returnedTextHash,
          provenanceJson,
          image: tokenImage || galleryThumbnailUri(rawText),
          tokenUri,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
      } catch {
        return null;
      }
    }))
  ).filter(isGalleryThought);

  thoughts.sort((left, right) => left.tokenId - right.tokenId);
  writeThoughtGalleryCache(thoughts);
  return thoughts;
};

const highlightGalleryTarget = () => {
  if (GALLERY_TARGET_TOKEN_ID === null) {
    return;
  }

  const target = galleryGrid.querySelector<HTMLElement>(
    `.thought-gallery__card[data-token-id="${GALLERY_TARGET_TOKEN_ID}"]`,
  );
  if (!target) {
    return;
  }

  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.add("is-highlighted");
  window.setTimeout(() => {
    target.classList.remove("is-highlighted");
  }, 1000);
};

let galleryLoadingTimer = 0;
let galleryLoadingDetailIndex = 0;

const renderChainLoadingStatus = (
  target: HTMLElement,
  status: string,
) => {
  const wrapper = document.createElement("span");
  wrapper.className = "inshell-chain-loading";
  wrapper.setAttribute("aria-label", `reading from chain: ${status}...`);

  const line = document.createElement("span");
  line.className = "inshell-chain-loading__line";
  line.append(`reading from chain: ${status}`);

  const dots = document.createElement("span");
  dots.className = "inshell-chain-loading__dots";
  dots.setAttribute("aria-hidden", "true");
  dots.textContent = "...";
  line.append(dots);

  wrapper.append(line);
  target.replaceChildren(wrapper);
};

const stopGalleryLoadingStatus = () => {
  if (galleryLoadingTimer) {
    window.clearInterval(galleryLoadingTimer);
    galleryLoadingTimer = 0;
  }
};

const startGalleryLoadingStatus = () => {
  stopGalleryLoadingStatus();
  galleryLoadingDetailIndex = 0;
  galleryCreateLink.hidden = true;
  renderChainLoadingStatus(
    galleryStatus,
    THOUGHT_GALLERY_LOADING_DETAILS[galleryLoadingDetailIndex],
  );
  galleryLoadingTimer = window.setInterval(() => {
    galleryLoadingDetailIndex =
      (galleryLoadingDetailIndex + 1) % THOUGHT_GALLERY_LOADING_DETAILS.length;
    renderChainLoadingStatus(
      galleryStatus,
      THOUGHT_GALLERY_LOADING_DETAILS[galleryLoadingDetailIndex],
    );
  }, CHAIN_LOADING_DETAIL_MS);
};

const settleGalleryCreateLink = () => {
  galleryCreateLink.hidden = false;
};

const renderThoughtGallery = (thoughts: GalleryThought[]) => {
  galleryStatus.textContent = thoughts.length === 0 ? "no minted THOUGHTs yet." : `${thoughts.length} minted THOUGHT${thoughts.length === 1 ? "" : "s"}.`;
  galleryGrid.replaceChildren(...thoughts.map(renderGalleryCard));
  settleGalleryCreateLink();
  highlightGalleryTarget();
};

const loadThoughtGallery = async () => {
  const cached = readThoughtGalleryCache();
  if (cached) {
    stopGalleryLoadingStatus();
    renderThoughtGallery(cached);
    void readGalleryThoughts({ bypassCache: true })
      .then((thoughts) => {
        if (thoughts) {
          renderThoughtGallery(thoughts);
        }
      })
      .catch(() => {
        // Keep the fresh cached gallery visible when background refresh fails.
      });
    return;
  }

  startGalleryLoadingStatus();
  galleryGrid.replaceChildren();

  try {
    const thoughts = await readGalleryThoughts();
    stopGalleryLoadingStatus();
    if (!thoughts) {
      galleryStatus.textContent = "gallery unavailable.";
      settleGalleryCreateLink();
      return;
    }

    renderThoughtGallery(thoughts);
  } catch {
    stopGalleryLoadingStatus();
    galleryStatus.textContent = "failed to read gallery.";
    settleGalleryCreateLink();
  }
};

const loadThoughtDetail = async () => {
  if (ROUTE_THOUGHT_NFT_ID === null) {
    thoughtDetailStatus.textContent = "THOUGHT unavailable.";
    return;
  }

  thoughtDetailTitleToken.textContent = ROUTE_THOUGHT_NFT_ID.toString();
  thoughtDetailBody.classList.add("is-hidden");
  thoughtDetailStatus.textContent = `loading THOUGHT #${ROUTE_THOUGHT_NFT_ID}...`;
  currentThoughtDetail = null;
  thoughtDetailJsonPanel.classList.add("is-hidden");
  clearThoughtDetailSpecJsonLink();
  revokeThoughtDetailColorFontUrl();
  clearThoughtDetailColorFontFallback();
  clearThoughtDetailProvenanceJsonLink();
  syncThoughtDetailEmbeddedHeights();
  showThoughtDetailStatus("");

  try {
    let thoughts = await readGalleryThoughts();
    if (!thoughts) {
      thoughtDetailStatus.textContent = "THOUGHT unavailable.";
      return;
    }

    let thought = thoughts.find((item) => item.tokenId === ROUTE_THOUGHT_NFT_ID);
    if (!thought) {
      thoughts = await readGalleryThoughts({ bypassCache: true });
      thought = thoughts?.find((item) => item.tokenId === ROUTE_THOUGHT_NFT_ID);
    }
    if (!thought) {
      thoughtDetailStatus.textContent = `THOUGHT #${ROUTE_THOUGHT_NFT_ID} not found.`;
      return;
    }

    const detail = normalizeThoughtDetail(thought);
    currentThoughtDetail = detail;
    const title = thoughtProtocolText(detail.rawText, IS_LOCAL_THOUGHT_V2);
    const rawText = detail.rawText || title || "-";
    const provenanceBytes = detail.provenanceJson ? byteLength(detail.provenanceJson) : 0;
    const txUrl = thoughtTxUrl(detail.txHash);
    document.title = `THOUGHT #${thought.tokenId}`;
    thoughtDetailTitleToken.textContent = detail.tokenId.toString();
    thoughtDetailStatus.textContent = "";
    thoughtDetailImage.src = detail.image
      ? IS_LOCAL_THOUGHT_V2 ? detail.image : thoughtImageUrl(detail.tokenId)
      : galleryThumbnailUri(title);
    thoughtDetailImage.alt = `THOUGHT #${detail.tokenId} canvas`;
    thoughtDetailModel.textContent = detail.model || "model unavailable.";
    setThoughtDetailTextBlock(thoughtDetailCanonicalTitle, rawText);
    setThoughtDetailTextBlock(thoughtDetailPrompt, detail.prompt || "prompt unavailable.");
    setThoughtDetailTextBlock(
      thoughtDetailModelReturn,
      detail.returnedText ? detail.returnedText : "model return unavailable.",
    );
    thoughtDetailPath.textContent = `$PATH #${detail.pathId} ↗`;
    thoughtDetailPath.href = pathTokenDetailUrl(detail.pathId);
    thoughtDetailPath.title = `Open $PATH #${detail.pathId} detail`;
    thoughtDetailMinter.textContent = shortDetailAddress(detail.minter);
    thoughtDetailMinter.title = detail.minter;
    thoughtDetailNetwork.textContent = THOUGHT_ENVIRONMENT_LABEL;
    thoughtDetailChain.textContent = THOUGHT_CHAIN_NAME;
    thoughtDetailChainId.textContent = String(THOUGHT_CHAIN_ID);
    thoughtDetailCurrency.textContent = THOUGHT_CURRENCY_LABEL;
    thoughtDetailMinted.textContent = detailTime(detail.mintedAt);
    thoughtDetailSpecRef.textContent = specLinkText(detail.thoughtSpec.ref);
    thoughtDetailColorFont.textContent = "Color Font v1 ↗";
    thoughtDetailColorFont.title = "Open local raw color-font mapping from ThoughtNFT color-font ABI";
    clearThoughtDetailSpecJsonLink("Loading local cached spec JSON...");
    if (detail.provenanceJson) {
      setThoughtDetailProvenanceJsonLink(detail, provenanceBytes);
    } else {
      clearThoughtDetailProvenanceJsonLink();
    }
    thoughtDetailProvenanceJson.textContent = formatProvenanceJson(detail.provenanceJson);
    thoughtDetailProvenanceViewerTitle.textContent = `source: ThoughtNFT.provenanceOf(${detail.tokenId})`;
    thoughtDetailViewTx.href = txUrl || "#";
    thoughtDetailViewTx.textContent = detail.txHash ? `${shortHex(detail.txHash, 22, 14)} ↗` : "-";
    thoughtDetailViewTx.title = detail.txHash;
    thoughtDetailBody.classList.remove("is-hidden");
    syncThoughtDetailEmbeddedHeights();
    void prepareThoughtDetailSpecJsonLink(detail);
  } catch {
    thoughtDetailStatus.textContent = "failed to load THOUGHT.";
  }
};

const prepareThoughtDetailSpecJsonLink = async (detail: ThoughtDetail) => {
  try {
    const spec = await loadThoughtSpecById(detail.thoughtSpec.id);
    if (currentThoughtDetail?.tokenId !== detail.tokenId) {
      return;
    }

    setThoughtDetailSpecJsonLink(spec);
  } catch {
    if (currentThoughtDetail?.tokenId === detail.tokenId) {
      clearThoughtDetailSpecJsonLink("Spec JSON unavailable.");
    }
  }
};

const openThoughtDetailSpecJson = async () => {
  if (!currentThoughtDetail) {
    return;
  }

  const pendingWindow = window.open("about:blank", "_blank");
  try {
    const spec = await loadThoughtSpecById(currentThoughtDetail.thoughtSpec.id);
    setThoughtDetailSpecJsonLink(spec);
    if (pendingWindow) {
      pendingWindow.opener = null;
      pendingWindow.location.href = thoughtDetailSpecJsonUrl;
    } else {
      window.location.href = thoughtDetailSpecJsonUrl;
    }
  } catch {
    if (pendingWindow) {
      pendingWindow.close();
    }
    showThoughtDetailStatus("spec json unavailable.");
  }
};

const getActionStatusKind = (status: string): "info" | "success" | "warn" | "error" => {
  if (status === "ready" || status === "minted") {
    return "success";
  }

  if (status === "model access needed" || status === "config needed") {
    return "warn";
  }

  if (status === "generation failed" || status === "mint unavailable") {
    return "error";
  }

  return "info";
};

const syncCtaState = () => {
  const action = getActionPresentation();

  primaryActionState = action.primaryAction;
  secondaryActionState = action.secondaryAction;
  runAgentButton.textContent = action.primaryLabel;
  runAgentButton.disabled = action.primaryDisabled;
  runAgentButton.classList.toggle("is-hidden", !!action.hidePrimary);
  actionStatusCopy.textContent = action.status;
  actionStatusCopy.classList.toggle("is-hidden", action.status.length === 0);
  actionStatusCopy.classList.remove("is-info", "is-success", "is-warn", "is-error");
  actionStatusCopy.classList.add(`is-${getActionStatusKind(action.status)}`);
  resetThoughtButton.textContent = action.secondaryLabel;
  resetThoughtButton.classList.toggle("is-hidden", action.secondaryAction === "none");
  resetThoughtButton.setAttribute("aria-label", action.secondaryLabel.replace(/[[\]]/g, "").trim() || "Secondary THOUGHT action");
};

const readPx = (value: string) => Number.parseFloat(value) || 0;

const visibleBlockOuterHeight = (element: HTMLElement | null) => {
  if (!element || element.hidden) {
    return 0;
  }
  const styles = window.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden") {
    return 0;
  }
  const rect = element.getBoundingClientRect();
  return rect.height + readPx(styles.marginTop) + readPx(styles.marginBottom);
};

const isThoughtPanelSideLayout = () =>
  window.matchMedia("(min-width: 1024px)").matches &&
  !IS_CLI_DEBUG &&
  !frontpageStage.classList.contains("is-hidden");

const getThoughtDockViewportReserve = () => {
  if (frontpageStage.classList.contains("is-hidden")) {
    return 0;
  }
  if (isThoughtPanelSideLayout()) {
    return 0;
  }
  const rootStyles = window.getComputedStyle(document.documentElement);
  const dockRowHeight = readPx(rootStyles.getPropertyValue("--thought-dock-row-height")) || 48;
  const railStyles = thoughtDockActionArea
    ? window.getComputedStyle(thoughtDockActionArea)
    : null;
  const railMargin =
    (railStyles ? readPx(railStyles.marginTop) + readPx(railStyles.marginBottom) : 0) || 8;
  const railHeight =
    thoughtDockActionArea && !thoughtDockActionArea.hidden
      ? thoughtDockActionArea.getBoundingClientRect().height || dockRowHeight
      : dockRowHeight;

  return (
    railMargin +
    railHeight +
    visibleBlockOuterHeight(thoughtDockDetails)
  );
};

const isStackedOperatorLayout = () =>
  window.matchMedia("(max-width: 900px)").matches &&
  !frontpageStage.classList.contains("is-hidden");

const getStackedOperatorAvailableHeight = () => {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const shellStyles = window.getComputedStyle(frontpageShell);
  const mainStyles = window.getComputedStyle(frontpageMain);
  const columnStyles = window.getComputedStyle(
    thoughtCanvasPanel.parentElement ?? frontpageMain,
  );
  const frameStyles = window.getComputedStyle(thoughtCanvasFrame);
  const footer = document.querySelector(".frontpage-side .color-font-footer") as HTMLElement | null;
  const shellInset = readPx(shellStyles.paddingTop) + readPx(shellStyles.paddingBottom);
  const titleHeight = frontpageTitle?.getBoundingClientRect().height ?? 0;
  const canvasColumnGap = readPx(columnStyles.rowGap);
  const frameInset = readPx(frameStyles.paddingTop) + readPx(frameStyles.paddingBottom);
  const mainGap = readPx(mainStyles.rowGap);
  const footerHeight = footer?.getBoundingClientRect().height ?? 0;

  return Math.floor(
    viewportHeight -
      shellInset -
      titleHeight -
      canvasColumnGap -
      frameInset -
      mainGap -
      footerHeight -
      getThoughtDockViewportReserve(),
  );
};

const getViewportWidthCap = () => {
  if (isStackedOperatorLayout()) {
    return Math.max(
      MIN_CANVAS_SIZE,
      getStackedOperatorAvailableHeight() - STACKED_MIN_CLI_HEIGHT,
    );
  }

  const frameStyles = window.getComputedStyle(thoughtCanvasFrame);
  const frameInset = readPx(frameStyles.paddingTop) + readPx(frameStyles.paddingBottom);
  const availableHeight = Math.floor(
    frontpageMain.getBoundingClientRect().height - frameInset,
  );

  return Math.max(MIN_CANVAS_SIZE, availableHeight);
};

const getDisplayWidth = () => {
  const panelRect = thoughtCanvasPanel.getBoundingClientRect();
  const frameStyles = window.getComputedStyle(thoughtCanvasFrame);
  const horizontalInset =
    readPx(frameStyles.paddingLeft) +
    readPx(frameStyles.paddingRight) +
    readPx(frameStyles.borderLeftWidth) +
    readPx(frameStyles.borderRightWidth);
  const availableWidth = Math.max(MIN_CANVAS_SIZE, Math.floor(panelRect.width - horizontalInset));

  return Math.max(
    MIN_CANVAS_SIZE,
    Math.min(availableWidth, getViewportWidthCap()),
  );
};

const getMinimumHeight = (displayWidth: number) => displayWidth;

const resizeCanvas = (displayWidth: number, height: number) => {
  const deviceScale = window.devicePixelRatio || 1;
  const frameStyles = window.getComputedStyle(thoughtCanvasFrame);
  const frameVerticalInset =
    readPx(frameStyles.paddingTop) +
    readPx(frameStyles.paddingBottom) +
    readPx(frameStyles.borderTopWidth) +
    readPx(frameStyles.borderBottomWidth);
  const frameHorizontalInset =
    readPx(frameStyles.paddingLeft) +
    readPx(frameStyles.paddingRight) +
    readPx(frameStyles.borderLeftWidth) +
    readPx(frameStyles.borderRightWidth);
  const cliHeight = isStackedOperatorLayout()
    ? Math.max(STACKED_MIN_CLI_HEIGHT, getStackedOperatorAvailableHeight() - displayWidth)
    : height + frameVerticalInset;

  canvas.width = Math.round(displayWidth * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${height}px`;
  thoughtDock.style.setProperty("--thought-dock-width", `${displayWidth + frameHorizontalInset}px`);
  thoughtCanvasPanel.style.setProperty("--thought-canvas-frame-width", `${displayWidth + frameHorizontalInset}px`);
  syncThoughtDockRailInset();
  document.documentElement.style.setProperty("--thought-canvas-outer-height", `${height}px`);
  document.documentElement.style.setProperty("--thought-cli-height", `${cliHeight}px`);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(deviceScale, deviceScale);
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
};

const colorForCharacter = (char: string): string => {
  if (char === " ") {
    return BACKGROUND_FILL;
  }

  const upper = char.toUpperCase();
  if (/^[A-Z]$/.test(upper)) {
    return COLOR_FONT[upper] ?? "#ffffff";
  }

  return "#778877";
};

const fitImagesToRow = (count: number, displayWidth: number) => {
  const availableWidth = displayWidth - 2 * CANVAS_PADDING;
  const itemCount = Math.max(1, count);
  const naturalWidth = itemCount * IMAGE_SIZE + Math.max(0, itemCount - 1) * IMAGE_GAP;
  const scale = Math.min(1, availableWidth / naturalWidth);
  const imageSize = IMAGE_SIZE * scale;
  const gap = itemCount > 1 ? IMAGE_GAP * scale : 0;
  const rowWidth = itemCount * imageSize + Math.max(0, itemCount - 1) * gap;

  return { imageSize, gap, rowWidth };
};

const resizeWorkSurface = () => {
  const displayWidth = getDisplayWidth();
  const height = getMinimumHeight(displayWidth);
  resizeCanvas(displayWidth, height);
  return { displayWidth, height };
};

const hideContractSvgPreview = () => {
  thoughtSvgPreview.removeAttribute("src");
  thoughtSvgPreview.classList.add("is-hidden");
  canvas.classList.remove("is-hidden");
};

const showContractSvgPreview = (svg: string) => {
  resizeWorkSurface();
  thoughtSvgPreview.src = svgToImageUri(svg);
  thoughtSvgPreview.classList.remove("is-hidden");
  canvas.classList.add("is-hidden");
};

const syncCurrentWorkVisual = (options?: { suppressWarning?: boolean }) => {
  if (currentWorkSvg) {
    const migratedSvg = migrateLegacyThoughtV2Svg(currentOutputText, currentWorkSvg);
    if (migratedSvg.migrated) {
      currentWorkSvg = migratedSvg.svg;
      writeCurrentOutputSession();
    }
    showContractSvgPreview(currentWorkSvg);
    return;
  }

  syncOutputToCanvas(currentOutputText, options);
};

const renderCanvas = (rawText: string) => {
  const { displayWidth, height } = resizeWorkSurface();

  context.clearRect(0, 0, displayWidth, height);
  context.fillStyle = BACKGROUND_FILL;
  context.fillRect(0, 0, displayWidth, height);
};

const syncOutputToCanvas = (raw: string, options?: { suppressWarning?: boolean }) => {
  const title = thoughtProtocolText(raw, IS_LOCAL_THOUGHT_V2);

  hideContractSvgPreview();

  if (!options?.suppressWarning && byteLength(title) > MAX_TEXT_BYTES) {
    setWarning(`work exceeds the ${MAX_TEXT_BYTES}-byte mint limit.`, {
      flashMs: NOTICE_FLASH_MS,
      level: "warn",
    });
  } else if (options?.suppressWarning) {
    setWarning("");
  }

  renderCanvas(raw);
};

const setAgentOutput = (text: string, _rawOutput: string, svg: string) => {
  if (blockPendingMintMutation() || blockPendingPathAcquisitionMutation()) {
    return false;
  }
  resetMintRuntimeState();
  mintDockRevealed = false;
  currentOutputText = text;
  currentWorkSvg = svg;
  showContractSvgPreview(svg);
  currentWorkId = null;
  writeCurrentOutputSession();
  return true;
};

const hasCurrentContractWorkSvg = () => currentWorkSvg.trim().startsWith("<svg");

const workRunContextToThoughtRunContext = (work: ThoughtWorkRecord) =>
  isThoughtRunContext(work.runContext)
    ? {
        ...work.runContext,
        returnedText: work.runContext.returnedText ?? work.returnedText,
      }
    : null;

const recordCurrentWork = (rawOutput: string) => {
  if (!currentOutputText || !currentRunContext) {
    return currentWorkId;
  }

  const existingWorks = readStoredThoughtWorks();
  const provenance = getProvenanceSummary();
  const result = appendThoughtWork(existingWorks, {
    prompt: currentRunContext.prompt,
    returnedText: rawOutput,
    text: currentOutputText,
    title: currentOutputText,
    rawOutput,
    image: currentWorkSvg ? svgToImageUri(currentWorkSvg) : galleryThumbnailUri(currentOutputText),
    svg: currentWorkSvg,
    route: currentRunContext.mode,
    provider: currentRunContext.provider,
    model: currentRunContext.model,
    thoughtSpec: currentRunContext.thoughtSpec,
    normalizer: {
      id: currentRunContext.previewProvider?.method === "frontendRender"
        ? "frontend-renderer"
        : "contract-preview",
      source: currentRunContext.previewProvider?.method === "frontendRender"
        ? "browser-renderer"
        : "ThoughtNFT.previewWork",
    },
    previewProvider: currentRunContext.previewProvider,
    provenanceJson: provenance?.json,
    provenanceBytes: provenance?.bytes,
    hashes: {
      promptHash: hashText(currentRunContext.prompt),
      returnedTextHash: hashText(rawOutput),
      textHash: hashText(currentOutputText),
    },
    runContext: currentRunContext,
  });
  writeStoredThoughtWorks(result.works);
  return result.work.id;
};

const saveCurrentWorkFromDock = () => {
  if (blockPendingMintMutation()) {
    return;
  }
  if (currentWorkId !== null && getWorkById(readStoredThoughtWorks(), currentWorkId)) {
    syncInterface();
    return;
  }
  const savedId = recordCurrentWork(currentRunContext?.returnedText ?? currentOutputText);
  if (savedId === null) {
    emitThoughtConsoleEvent({
      kind: "work_save_failed",
      title: "work not saved",
      detail: "current work is incomplete",
      tone: "warning",
    });
    syncInterface();
    return;
  }
  currentWorkId = savedId;
  writeCurrentOutputSession();
  emitThoughtConsoleEvent({
    kind: "work_saved",
    title: "work saved",
    detail: currentRunContext?.prompt ?? "",
    tone: "success",
    eventId: `work-saved:${savedId}`,
  });
  syncInterface();
};

const loadWorkRecord = (work: ThoughtWorkRecord) => {
  if (blockPendingMintMutation({ cli: true }) || blockPendingPathAcquisitionMutation()) {
    return false;
  }
  resetMintRuntimeState();
  mintDockRevealed = false;
  currentOutputText = thoughtProtocolText(work.text || work.title, IS_LOCAL_THOUGHT_V2);
  currentWorkSvg = work.svg ?? "";
  currentRunContext = workRunContextToThoughtRunContext(work);
  currentWorkId = work.id;
  sessionState.prompt = work.prompt || work.runContext.prompt;
  promptBox.value = sessionState.prompt;
  thoughtDockPrompt.value = sessionState.prompt;
  writeSessionState();
  runState = "output_ready";
  syncCurrentWorkVisual({ suppressWarning: true });
  writeCurrentOutputSession();
  syncInterface();
  void preflightCurrentThoughtExistence();
  return true;
};

const isThoughtRunContext = (value: unknown): value is ThoughtRunContext => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ThoughtRunContext>;
  return (
    isMode(candidate.mode) &&
    typeof candidate.provider === "string" &&
    isThoughtRunProvider(candidate.provider) &&
    typeof candidate.model === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.clientGeneratedAt === "string"
  );
};

const migrateLegacyThoughtV2Svg = (output: string, svg: string) => {
  if (
    svg.includes('width="960" height="960" viewBox="0 0 960 960"') &&
    svg.includes('id="binary-background"') &&
    svg.includes('data-grid-columns="32"') &&
    !svg.includes('id="agent-line-bg"') &&
    !svg.includes('id="prompt-line-bg"')
  ) {
    return { svg, migrated: false };
  }

  if (!svg.includes("prompt-line")) {
    return { svg, migrated: false };
  }

  try {
    return {
      svg: buildThoughtV2Svg({
        agentLine: deriveThoughtV2VisibleLine(output),
        promptLine: deriveThoughtV2VisibleLine(currentRunContext?.prompt ?? sessionState.prompt),
      }),
      migrated: true,
    };
  } catch {
    return { svg: "", migrated: true };
  }
};

const readCurrentOutputSession = () => {
  const raw = readSharedBrowserItem(THOUGHT_OUTPUT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as {
      output?: unknown;
      svg?: unknown;
      runContext?: unknown;
      workId?: unknown;
      mintDockRevealed?: unknown;
    };
    const output = typeof candidate.output === "string"
      ? thoughtProtocolText(candidate.output, IS_LOCAL_THOUGHT_V2)
      : "";
    if (!output) {
      return null;
    }
    const storedSvg = typeof candidate.svg === "string" ? candidate.svg : "";
    const migratedSvg = migrateLegacyThoughtV2Svg(output, storedSvg);

    return {
      output,
      svg: migratedSvg.svg,
      migrated: migratedSvg.migrated,
      runContext: isThoughtRunContext(candidate.runContext) ? candidate.runContext : null,
      workId: Number.isSafeInteger(candidate.workId) && Number(candidate.workId) > 0
        ? Number(candidate.workId)
        : null,
      mintDockRevealed: candidate.mintDockRevealed === true,
    };
  } catch {
    return null;
  }
};

const writeCurrentOutputSession = () => {
  if (!currentOutputText) {
    removeSharedBrowserItem(THOUGHT_OUTPUT_STORAGE_KEY);
    return;
  }

  writeSharedBrowserItem(
    THOUGHT_OUTPUT_STORAGE_KEY,
    JSON.stringify({
      output: currentOutputText,
      svg: currentWorkSvg,
      runContext: currentRunContext,
      workId: currentWorkId,
      mintDockRevealed,
    }),
  );
};

const restoreCurrentOutputSession = () => {
  const stored = readCurrentOutputSession();
  if (!stored) {
    return;
  }

  currentOutputText = stored.output;
  currentWorkSvg = stored.svg;
  currentRunContext = stored.runContext;
  currentWorkId = stored.workId;
  mintDockRevealed = stored.mintDockRevealed;
  runState = "output_ready";
  if (stored.migrated) {
    writeCurrentOutputSession();
  }
  syncCurrentWorkVisual({ suppressWarning: true });
  void preflightCurrentThoughtExistence();
};

const recordThoughtRun = (
  payload: ThoughtRunPayload,
  rawOutput: string,
  thoughtTitle: string,
  previewProvider?: ThoughtPreviewProviderTrace,
  agentEvidence?: ThoughtV2LocalAgentEvidence,
) => {
  const clientGeneratedAt = new Date().toISOString();
  const provenanceConfig = thoughtRunProvenanceConfig(payload);
  currentRunContext = {
    mode: payload.config.route,
    provider: payload.config.provider,
    model: payload.config.model,
    prompt: payload.input.promptLine,
    returnedText: rawOutput,
    clientGeneratedAt,
    previewProvider,
    request: provenanceConfig.request,
    web: provenanceConfig.web,
    thoughtSpec: provenanceConfig.thoughtSpec,
    ...(agentEvidence ? { agentEvidence } : {}),
  };

  const run = {
    route: payload.config.route,
    provider: payload.config.provider,
    model: payload.config.model,
    prompt: payload.input.promptLine,
    request: provenanceConfig.request,
    web: provenanceConfig.web,
    thoughtSpec: provenanceConfig.thoughtSpec,
    returnedText: rawOutput,
    thoughtTitle,
    previewProvider,
    clientGeneratedAt,
  };

  (
    window as Window & {
      __thoughtLastRun?: typeof run;
    }
  ).__thoughtLastRun = run;

  console.info("[thought] model return", run);
};

const resetThought = (options?: { preserveStoredOutput?: boolean }) => {
  if (blockPendingMintMutation() || blockPendingPathAcquisitionMutation()) {
    return false;
  }
  runState = "idle";
  walletConnectInFlight = false;
  pendingMyBrainRunPayload = null;
  currentOutputText = "";
  currentWorkSvg = "";
  currentRunContext = null;
  currentWorkId = null;
  mintDockRevealed = false;
  workLibraryRevealed = false;
  if (!options?.preserveStoredOutput) {
    clearCurrentCandidate();
  }
  if (!options?.preserveStoredOutput) {
    writeCurrentOutputSession();
  }
  resetMintRuntimeState();
  syncOutputToCanvas("", { suppressWarning: true });
  setWarning("");
  setStatus("");
  syncCtaState();
  syncPrimaryCtaAvailability();
  return true;
};

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const createCodeVerifier = () => {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const rotateRight = (value: number, shift: number) =>
  (value >>> shift) | (value << (32 - shift));

const sha256Fallback = (input: Uint8Array) => {
  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ]);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
  ]);
  const bitLength = input.length * 8;
  const paddingLength = ((56 - ((input.length + 1) % 64)) + 64) % 64;
  const padded = new Uint8Array(input.length + 1 + paddingLength + 8);
  const view = new DataView(padded.buffer);
  const words = new Uint32Array(64);

  padded.set(input);
  padded[input.length] = 0x80;
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }

    for (let index = 16; index < 64; index += 1) {
      const sigma0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const sigma1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  state.forEach((value, index) => {
    digestView.setUint32(index * 4, value, false);
  });
  return digest;
};

const createCodeChallenge = async (verifier: string) => {
  const encoded = new TextEncoder().encode(verifier);
  const subtle = globalThis.crypto?.subtle;

  if (subtle?.digest) {
    const digest = await subtle.digest("SHA-256", encoded);
    return base64UrlEncode(new Uint8Array(digest));
  }

  return base64UrlEncode(sha256Fallback(encoded));
};

const extractResponseText = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const response = payload as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts =
    response.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return parts.join(" ").trim();
};

const normalizeErrorMessage = (message: string) => message.trim().replace(/\s+/g, " ");

const readErrorString = (value: unknown) =>
  typeof value === "string" && value.trim() ? normalizeErrorMessage(value) : "";

const readNestedProviderErrorMessage = (value: unknown): string => {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) {
      return "";
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return readNestedProviderErrorMessage(parsed) || normalizeErrorMessage(raw);
    } catch {
      return normalizeErrorMessage(raw);
    }
  }

  if (typeof value !== "object" || value === null) {
    return "";
  }

  const payload = value as {
    error?: unknown;
    message?: unknown;
    detail?: unknown;
    details?: unknown;
    metadata?: { raw?: unknown };
  };
  if (typeof payload.error === "object" && payload.error !== null) {
    const nested = readNestedProviderErrorMessage(payload.error);
    if (nested) {
      return nested;
    }
  }

  return (
    readErrorString(payload.message) ||
    readErrorString(payload.detail) ||
    readErrorString(payload.details) ||
    readNestedProviderErrorMessage(payload.metadata?.raw)
  );
};

const readErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const error = (payload as { error?: { message?: unknown; metadata?: { raw?: unknown } } }).error;
  if (error && typeof error === "object") {
    const message = readErrorString(error.message);
    const providerMessage = readNestedProviderErrorMessage(error.metadata?.raw);
    if (providerMessage && (!message || message.toLowerCase() === "provider returned error")) {
      return providerMessage;
    }

    if (message) {
      return message;
    }
  }

  const errorString = readErrorString((payload as { error?: unknown }).error);
  if (errorString) {
    return errorString;
  }

  const message = readErrorString((payload as { message?: unknown }).message);
  if (message) {
    return message;
  }

  return fallback;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) => {
  let timeout = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      window.clearTimeout(timeout);
    }
  }
};

const fetchPreflightRequest = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, PREFLIGHT_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (pageUnloading) {
      throw new Error("refresh stopped the request.");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("preflight request timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

const fetchAgentRequest = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, AGENT_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (pageUnloading) {
      throw new Error("refresh stopped the request.");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Agent request timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

const fetchThoughtAgentJson = async <T>(url: string, init: RequestInit) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const requestOrigin = new URL(url, window.location.origin).origin;
  let response: Response;
  try {
    response = await fetchAgentRequest(url, {
      ...init,
      credentials: requestOrigin === window.location.origin ? "same-origin" : "omit",
      cache: "no-store",
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof TypeError ? /fetch/i.test(message) : /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(message)) {
      throw new Error(THOUGHT_BRIDGE_NOT_CONNECTED_MESSAGE);
    }
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, `THOUGHT Agent API failed (${response.status}).`));
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("THOUGHT Agent API returned an invalid response.");
  }
  return payload;
};

const launchThoughtAgentBridge = (launchUri: string) => {
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  const frame = document.createElement("iframe");
  frame.title = "THOUGHT Bridge launch";
  frame.src = launchUri;
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "absolute";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  document.body.append(frame);
  window.setTimeout(() => {
    frame.remove();
  }, 2000);
};

const readThoughtAgentReturn = async (
  payload: ThoughtAgentRunStatusResponse,
  fallbackRunId = "",
  fallbackAdapter = "",
) => {
  const agentLine = payload.result?.agentLine;
  if (typeof agentLine !== "string") {
    return { agentLine: "" };
  }
  assertThoughtLine(agentLine, "agent");
  if (!IS_LOCAL_THOUGHT_V2) {
    return { agentLine };
  }

  const payloadResult = payload.result;
  const raw = payloadResult?.raw;
  const rawSha256 = payloadResult?.rawSha256;
  if (typeof raw !== "string" || typeof rawSha256 !== "string") {
    throw new Error("Agent result evidence is incomplete.");
  }
  const result = parseThoughtV2LocalAgentResult(raw);
  const verifiedRawSha256 = await sha256Hex(raw);
  if (result.agentLine !== agentLine || verifiedRawSha256 !== rawSha256) {
    throw new Error("Agent result evidence hash mismatch.");
  }
  const runId = payload.runId || fallbackRunId;
  const adapter = payloadResult?.receipt?.adapterId || fallbackAdapter;
  if (!runId || !adapter) {
    throw new Error("Agent result transport evidence is incomplete.");
  }
  return {
    agentLine,
    agentEvidence: {
      result,
      runId,
      adapter,
      rawResponseSha256: rawSha256.replace(/^sha256:/, ""),
    } satisfies ThoughtV2LocalAgentEvidence,
  };
};

const readThoughtAgentModelReturn = async (payload: ThoughtAgentRunStatusResponse) =>
  (await readThoughtAgentReturn(payload)).agentLine;

const pollThoughtAgentRun = async (input: {
  statusUrl: string;
  browserToken: string;
  runId: string;
}) => {
  const startedAt = Date.now();
  const statusUrl = resolveThoughtAgentStatusUrl(input.statusUrl);

  while (Date.now() - startedAt < THOUGHT_AGENT_POLL_TIMEOUT_MS) {
    if (pageUnloading) {
      throw new Error("refresh stopped the request.");
    }

    const payload = await fetchThoughtAgentJson<ThoughtAgentRunStatusResponse>(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.browserToken}`,
      },
    });
    const state = payload.state ?? "";

    if (state === "returned") {
      const returned = await readThoughtAgentReturn(payload, input.runId, CODEX_PROVIDER);
      if (!returned.agentLine) {
        throw new Error("Codex returned an empty THOUGHT result.");
      }
      return returned;
    }

    if (state === "failed") {
      throw new Error(payload.error?.message || "Codex run failed.");
    }

    if (state === "cancelled") {
      throw new Error("Codex run cancelled.");
    }

    if (state === "expired") {
      throw new Error("Codex run expired.");
    }

    setStatus(
      state === "created"
        ? `waiting for THOUGHT Bridge ${input.runId}...`
        : `Codex running ${input.runId}...`,
    );
    await new Promise((resolve) => window.setTimeout(resolve, THOUGHT_AGENT_STATUS_POLL_MS));
  }

  throw new Error("Codex run timed out.");
};

const requestCodexAgent = async (payload: ThoughtRunPayload) => {
  const createPayload = await fetchThoughtAgentJson<ThoughtAgentRunCreateResponse>(
    thoughtAgentApiUrl("runs"),
    {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        promptLine: payload.input.promptLine,
        specId: THOUGHT_AGENT_REGISTERED_SPEC_ID,
        requestedAgent: {
          adapterId: CODEX_PROVIDER,
          model: payload.config.model === CODEX_MODEL ? null : payload.config.model,
        },
        client: {
          surface: "thought-web",
          appVersion: `${APP_VERSION}+${APP_BUILD}`,
        },
      }),
    },
  );

  if (
    !createPayload.runId ||
    !createPayload.browserToken ||
    !createPayload.statusUrl ||
    (!createPayload.devAutoRun && !createPayload.launchUri)
  ) {
    throw new Error("THOUGHT Agent API returned an incomplete run.");
  }

  const pendingRun: PendingThoughtAgentRun = {
    runId: createPayload.runId,
    statusUrl: createPayload.statusUrl,
    browserToken: createPayload.browserToken,
    payload,
    createdAt: createPayload.createdAt || new Date().toISOString(),
  };
  writePendingThoughtAgentRun(pendingRun);

  if (createPayload.devAutoRun) {
    setStatus(`Codex running ${createPayload.runId}...`);
  } else {
    const resolvedLaunchUri = resolveThoughtAgentLaunchUri(createPayload.launchUri ?? "");
    setStatus(`opening THOUGHT Bridge ${createPayload.runId}...`);
    launchThoughtAgentBridge(resolvedLaunchUri);
    appendThoughtAgentDevBridgeCommand(resolvedLaunchUri);
  }
  try {
    const modelReturn = await pollThoughtAgentRun({
      statusUrl: createPayload.statusUrl,
      browserToken: createPayload.browserToken,
      runId: createPayload.runId,
    });
    clearPendingThoughtAgentRun(createPayload.runId);
    return modelReturn;
  } catch (error) {
    if (!(pageUnloading && error instanceof Error && error.message === "refresh stopped the request.")) {
      clearPendingThoughtAgentRun(createPayload.runId);
    }
    throw error;
  }
};

const probeOllamaReachableWithoutCors = async () => {
  try {
    await fetchPreflightRequest(buildOllamaApiUrl("tags"), {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  }
};

const requestOllama = async (payload: ThoughtRunPayload) => {
  let response: Response;

  try {
    response = await fetchAgentRequest(buildOllamaApiUrl("generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toOllamaGeneratePayload(payload)),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "refresh stopped the request." ||
        error.message === "Agent request timed out.")
    ) {
      throw error;
    }
    if (await probeOllamaReachableWithoutCors()) {
      throw new Error(ollamaOriginBlockedMessage());
    }
    throw new Error("ollama not detected.");
  }

  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(ollamaOriginBlockedMessage());
    }
    throw new Error(readErrorMessage(responsePayload, "ollama request failed."));
  }

  if (
    typeof responsePayload === "object" &&
    responsePayload !== null &&
    "response" in responsePayload &&
    typeof (responsePayload as { response?: unknown }).response === "string"
  ) {
    return ((responsePayload as { response: string }).response).trim();
  }

  return "";
};

const requestOpenAIResponses = async (apiKey: string, payload: ThoughtRunPayload) => {
  let response: Response;

  try {
    response = await fetchAgentRequest("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(toOpenAIResponsesPayload(payload)),
    });
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("openai request could not be reached from this browser. try config direct provider openrouter, config connect, or config local.");
    }
    throw error;
  }

  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(responsePayload, "openai request failed."));
  }

  return extractResponseText(responsePayload);
};

const requestAnthropicMessages = async (apiKey: string, payload: ThoughtRunPayload) => {
  let response: Response;

  try {
    response = await fetchAgentRequest("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(toAnthropicMessagesPayload(payload)),
    });
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("anthropic request could not be reached from this browser. try config direct provider openrouter, config connect, or config local.");
    }
    throw error;
  }

  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(responsePayload, "anthropic request failed."));
  }

  if (typeof responsePayload !== "object" || responsePayload === null) {
    return "";
  }

  const content =
    (responsePayload as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
  return content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
};

const requestOpenRouterChat = async (apiKey: string, payload: ThoughtRunPayload) => {
  let response: Response;

  try {
    response = await fetchAgentRequest("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "THOUGHT",
      },
      body: JSON.stringify(toOpenRouterChatPayload(payload)),
    });
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("openrouter request could not be reached from this browser. retry, or use config local.");
    }
    throw error;
  }

  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = readErrorMessage(responsePayload, "openrouter request failed.");
    throw new Error(
      response.status >= 500
        ? `${message}. try: config connect model list, then config connect model <id>`
        : message,
    );
  }

  if (typeof responsePayload !== "object" || responsePayload === null) {
    return "";
  }

  const choices =
    (responsePayload as { choices?: Array<{ message?: { content?: unknown } }> }).choices ?? [];
  const content = choices[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (typeof part === "string") {
          return [part];
        }

        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return [(part as { text: string }).text];
        }

        return [];
      })
      .join(" ")
      .trim();
  }

  return "";
};

const extractOpenRouterKey = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const key = (payload as { key?: unknown }).key;
  return typeof key === "string" ? key.trim() : "";
};

const cleanOpenRouterCallbackUrl = () => {
  const url = new URL(window.location.href);
  let changed = false;

  ["code", "error", "error_description"].forEach((param) => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });

  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
};

const exchangeOpenRouterCode = async (code: string) => {
  const verifier = sessionStorage.getItem(OPENROUTER_PKCE_VERIFIER_KEY);

  if (!verifier) {
    throw new Error("openrouter verifier is missing. authorize again.");
  }

  const response = await fetchPreflightRequest(OPENROUTER_KEY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256",
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "openrouter connect failed."));
  }

  const key = extractOpenRouterKey(payload);
  if (!key) {
    throw new Error("openrouter returned no key.");
  }

  sessionStorage.removeItem(OPENROUTER_PKCE_VERIFIER_KEY);
  sessionState.mode = "connect";
  sessionState.routeConfigured = true;
  sessionState.connect.apiKey = key;
  sessionState.connect.model =
    sessionState.connect.model || DIRECT_PROVIDERS.openrouter.defaultModel;
  writeSessionState();
};

const handleOpenRouterCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const code = params.get("code");

  if (error) {
    cleanOpenRouterCallbackUrl();
    throw new Error(params.get("error_description") || error);
  }

  if (!code) {
    return false;
  }

  setStatus("authorizing openrouter...");
  connectOpenRouterButton.disabled = true;

  try {
    await exchangeOpenRouterCode(code);
    cleanOpenRouterCallbackUrl();
    syncInterface();
    setWarning("");
    setStatus("openrouter linked.", { flashMs: NOTICE_FLASH_MS });
    return true;
  } finally {
    connectOpenRouterButton.disabled = false;
  }
};

const startOpenRouterConnect = async () => {
  if (!isOpenRouterConnectSupported()) {
    throw new Error(getOpenRouterConnectConstraintMessage());
  }

  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const callbackUrl = `${window.location.origin}${window.location.pathname}`;
  const authUrl = new URL(OPENROUTER_AUTH_URL);

  authUrl.searchParams.set("callback_url", callbackUrl);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  sessionStorage.setItem(OPENROUTER_PKCE_VERIFIER_KEY, verifier);
  window.location.assign(authUrl.toString());
};

const disconnectOpenRouter = () => {
  sessionState.connect.apiKey = "";
  modelOptionsCache.delete("openrouter");
  sessionStorage.removeItem(OPENROUTER_PKCE_VERIFIER_KEY);
  writeSessionState();
  syncInterface();
  setWarning("");
  setStatus("openrouter disconnected.", { flashMs: NOTICE_FLASH_MS });
};

const dedupeModelOptions = (options: ModelOption[]) => {
  const seen = new Set<string>();

  return options.filter((option) => {
    const id = option.id.trim();
    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

const hasTextModality = (value: unknown) => Array.isArray(value) && value.includes("text");

const fetchOpenRouterModels = async (): Promise<ModelOption[]> => {
  const response = await fetchPreflightRequest(OPENROUTER_MODEL_URL);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "openrouter model list failed."));
  }

  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    return STATIC_MODEL_OPTIONS.openrouter;
  }

  const preferredRank = new Map(
    OPENROUTER_PREFERRED_MODELS.map((model, index) => [model, index]),
  );

  const options = data
    .flatMap((entry): ModelOption[] => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const model = entry as {
        id?: unknown;
        architecture?: {
          input_modalities?: unknown;
          output_modalities?: unknown;
        };
        pricing?: {
          prompt?: unknown;
          completion?: unknown;
        };
      };
      const id = typeof model.id === "string" ? model.id.trim() : "";

      if (!id) {
        return [];
      }

      if (!hasTextModality(model.architecture?.input_modalities)) {
        return [];
      }

      if (!hasTextModality(model.architecture?.output_modalities)) {
        return [];
      }

      if (
        Array.isArray(model.architecture?.output_modalities) &&
        model.architecture.output_modalities.includes("image")
      ) {
        return [];
      }

      if (String(model.pricing?.prompt) === "-1" || String(model.pricing?.completion) === "-1") {
        return [];
      }

      return [{ id, label: id }];
    })
    .sort((left, right) => {
      const leftRank = preferredRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = preferredRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftFreeRank = left.id.endsWith(":free") ? 0 : 1;
      const rightFreeRank = right.id.endsWith(":free") ? 0 : 1;

      if (leftFreeRank !== rightFreeRank) {
        return leftFreeRank - rightFreeRank;
      }

      return left.id.localeCompare(right.id);
    });

  return dedupeModelOptions(options);
};

const fetchOllamaModels = async (): Promise<ModelOption[]> => {
  let response: Response;

  try {
    response = await fetchPreflightRequest(buildOllamaApiUrl("tags"));
  } catch (error) {
    if (await probeOllamaReachableWithoutCors()) {
      throw new Error(ollamaOriginBlockedMessage());
    }
    throw new Error("ollama not detected.");
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(ollamaOriginBlockedMessage());
    }
    throw new Error(readErrorMessage(payload, "ollama model list failed."));
  }

  const data = (payload as { models?: unknown })?.models;
  if (!Array.isArray(data)) {
    return STATIC_MODEL_OPTIONS.ollama;
  }

  const options = data.flatMap((entry): ModelOption[] => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const model = entry as { model?: unknown; name?: unknown };
    const id =
      typeof model.model === "string"
        ? model.model.trim()
        : typeof model.name === "string"
          ? model.name.trim()
          : "";

    return id ? [{ id, label: id }] : [];
  });

  return dedupeModelOptions(options);
};

const getCurrentModelSourceId = (): ModelSourceId => {
  if (sessionState.mode === "connect") {
    return "openrouter";
  }

  if (sessionState.mode === "local") {
    return "ollama";
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    return MY_BRAIN_MODEL_SOURCE_ID;
  }

  if (sessionState.mode === CODEX_MODE) {
    return CODEX_MODEL_SOURCE_ID;
  }

  return sessionState.direct.provider;
};

const getCurrentModelValue = () => {
  if (sessionState.mode === "connect") {
    return sessionState.connect.model;
  }

  if (sessionState.mode === "local") {
    return sessionState.local.model;
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    return MY_BRAIN_MODEL;
  }

  if (sessionState.mode === CODEX_MODE) {
    return sessionState.codex.model;
  }

  return sessionState.direct.model;
};

const setCurrentModelValue = (value: string) => {
  if (sessionState.mode === "connect") {
    sessionState.connect.model = value;
  } else if (sessionState.mode === "local") {
    sessionState.local.model = value;
  } else if (sessionState.mode === MY_BRAIN_MODE) {
    return;
  } else if (sessionState.mode === CODEX_MODE) {
    sessionState.codex.model = value || CODEX_MODEL;
  } else {
    sessionState.direct.model = value;
  }
};

const getDirectApiKey = (provider = sessionState.direct.provider) =>
  sessionState.direct.apiKeys[provider].trim();

const setDirectApiKey = (value: string, provider = sessionState.direct.provider) => {
  sessionState.direct.apiKeys[provider] = value.trim();
};

const clearDirectApiKey = (provider = sessionState.direct.provider) => {
  sessionState.direct.apiKeys[provider] = "";
};

const getModelOptions = (sourceId: ModelSourceId) =>
  modelOptionsCache.get(sourceId) ?? STATIC_MODEL_OPTIONS[sourceId];

const formatModelLabel = (label: string, maxLength = 28) => {
  const trimmed = label.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
};

const syncManualModelField = () => {
  modelManualBox.classList.toggle("is-hidden", modelBox.value !== MANUAL_MODEL_VALUE);
};

const setModelOptions = (
  sourceId: ModelSourceId,
  options: ModelOption[],
  selectedModel: string,
) => {
  const allowManual =
    sourceId !== LOCAL_MODEL_SOURCE_ID &&
    sourceId !== MY_BRAIN_MODEL_SOURCE_ID &&
    sourceId !== CODEX_MODEL_SOURCE_ID;
  const modelOptions = dedupeModelOptions(options.length ? options : STATIC_MODEL_OPTIONS[sourceId]);
  const defaultModel = defaultModelForSource(sourceId);
  const optionIds = new Set(modelOptions.map((option) => option.id));
  const selected = selectedModel.trim();
  const resolvedModel =
    !selected || (selected === defaultModel && !optionIds.has(selected))
      ? (optionIds.has(defaultModel) ? defaultModel : modelOptions[0]?.id) || defaultModel
      : selected;
  const hasSelectedModel = optionIds.has(resolvedModel);

  modelBox.replaceChildren();
  modelOptions.forEach((option) => {
    const renderedOption = new Option(formatModelLabel(option.label), option.id);
    renderedOption.title = option.label;
    modelBox.append(renderedOption);
  });

  if (allowManual) {
    modelBox.append(new Option("custom model id", MANUAL_MODEL_VALUE));
  }

  if (allowManual && !hasSelectedModel) {
    modelBox.value = MANUAL_MODEL_VALUE;
    modelManualBox.value = resolvedModel;
  } else {
    modelBox.value = hasSelectedModel ? resolvedModel : modelOptions[0]?.id ?? "";
    modelManualBox.value = "";
  }

  syncManualModelField();
  modelBox.disabled = false;
  modelManualBox.disabled = !allowManual;
  modelBox.title = resolvedModel;
  modelManualBox.title = modelManualBox.value.trim();
  return allowManual && modelBox.value === MANUAL_MODEL_VALUE
    ? modelManualBox.value.trim()
    : modelBox.value.trim();
};

const disableModelControls = (message: string) => {
  modelBox.replaceChildren(new Option(message, ""));
  modelBox.disabled = true;
  modelBox.title = "";
  modelManualBox.value = "";
  modelManualBox.title = "";
  modelManualBox.disabled = true;
  modelManualBox.classList.add("is-hidden");
};

const getSelectedModelValue = () => {
  if (modelBox.disabled) {
    return "";
  }

  if (modelBox.value === MANUAL_MODEL_VALUE) {
    return modelManualBox.value.trim();
  }

  return modelBox.value.trim();
};

const syncConnectControls = () => {
  const isConnectMode = isRouteConfigured() && sessionState.mode === "connect";
  const hasCredential = sessionState.connect.apiKey.trim().length > 0;
  const connectSupported = isOpenRouterConnectSupported();

  connectPanel.classList.toggle("is-hidden", !isConnectMode);
  connectOpenRouterButton.classList.toggle("is-hidden", hasCredential);
  connectStatusRow.classList.toggle("is-hidden", !hasCredential);
  connectStatusCopy.textContent = "openrouter linked";
  connectOpenRouterButton.disabled = hasCredential ? false : !connectSupported;
  connectOpenRouterButton.title = connectSupported ? "" : getOpenRouterConnectConstraintMessage();

  if (!hasCredential) {
    connectOpenRouterButton.textContent = connectSupported
      ? "[ authorize openrouter ]"
      : "[ openrouter connect unavailable ]";
  }
};

const syncModeControls = () => {
  const isConnectMode = isRouteConfigured() && sessionState.mode === "connect";
  const isDirectMode = isRouteConfigured() && sessionState.mode === "direct";
  const isLocalMode = isRouteConfigured() && sessionState.mode === "local";
  const isCodexMode = isRouteConfigured() && sessionState.mode === CODEX_MODE;

  modeConnectButton.classList.toggle("is-active", isConnectMode);
  modeDirectButton.classList.toggle("is-active", isDirectMode);
  modeLocalButton.classList.toggle("is-active", isLocalMode);
  modeCodexButton.classList.toggle("is-active", isCodexMode);
  providerField.classList.toggle("is-hidden", !isDirectMode);
  apiKeyField.classList.toggle("is-hidden", !isDirectMode);
  localModelField.classList.toggle("is-hidden", !isLocalMode);
  localStatus.classList.toggle("is-hidden", !isLocalMode);
  localHelper.classList.add("is-hidden");
  syncConnectControls();
};

const syncDirectControls = () => {
  providerBox.value = sessionState.direct.provider;
  apiKeyLabel.textContent = "api key";
  apiKeyBox.placeholder = "memory only. never stored by THOUGHT.";
  apiKeyBox.value = getDirectApiKey();
};

const syncLocalControls = () => {
  if (sessionState.local.available === true) {
    localStatus.innerHTML = `ollama detected.<br />endpoint ${getOllamaEndpoint()}.<br />runs on this machine.`;
  } else if (sessionState.local.available === false) {
    localStatus.innerHTML = `${escapeHtml(localModelError || "ollama not detected.")}<br />allow origin or retry.<br />endpoint ${escapeHtml(getOllamaEndpoint())}.`;
  } else {
    localStatus.innerHTML = "checking ollama...";
  }
};

const syncPromptField = () => {
  if (promptBox.value !== sessionState.prompt) {
    promptBox.value = sessionState.prompt;
  }
};

const syncModelControls = () => {
  if (!isRouteConfigured()) {
    disableModelControls("select route");
    return;
  }

  const sourceId = getCurrentModelSourceId();

  if (sourceId === "ollama" && sessionState.local.available === false) {
    disableModelControls("ollama not detected");
    return;
  }

  const resolvedModel = setModelOptions(sourceId, getModelOptions(sourceId), getCurrentModelValue());

  if (resolvedModel && getCurrentModelValue() !== resolvedModel) {
    setCurrentModelValue(resolvedModel);
    writeSessionState();
  }
};

const syncRunAvailability = () => {
  syncPrimaryCtaAvailability();
};

const syncDebugPanel = () => {
  thoughtDebug.classList.toggle("is-hidden", !IS_DEV_MODE);

  if (!IS_DEV_MODE) {
    return;
  }

  thoughtDebugPanel.classList.toggle("is-hidden", !debugState.open);
  thoughtDebugToggle.setAttribute("aria-expanded", debugState.open ? "true" : "false");
  normalizeDebugHierarchy();
  syncDebugSelect(thoughtDebugCta, DEBUG_CTA_OPTIONS, DEBUG_CTA_LABELS, debugState.cta);
  syncDebugSelect(
    thoughtDebugCtaStatus,
    getDebugStatusOptions(),
    DEBUG_CTA_STATUS_LABELS,
    debugState.ctaStatus,
  );
  syncDebugSelect(
    thoughtDebugWarning,
    getDebugWarningOptions(),
    DEBUG_WARNING_LABELS,
    debugState.warning,
  );
  thoughtDebugEnabled.checked = debugState.enabled;
  thoughtDebugCta.disabled = !debugState.enabled;
  thoughtDebugCtaStatus.disabled = !debugState.enabled;
  thoughtDebugWarning.disabled = !debugState.enabled;
};

const syncInterface = () => {
  syncModeControls();
  syncDirectControls();
  syncLocalControls();
  syncPromptField();
  syncModelControls();
  syncThoughtInstructionsControls();
  syncCtaState();
  syncMintSheet();
  syncRunAvailability();
  syncDebugPanel();
  syncWarningBox();
  syncCliPanel();
  syncThoughtDock();
};

const loadModelOptionsForSource = async (
  sourceId: ModelSourceId,
  options?: { silent?: boolean },
) => {
  if (sourceId === "openrouter" && !sessionState.connect.apiKey.trim()) {
    modelOptionsCache.delete(sourceId);
    if (getCurrentModelSourceId() === sourceId) {
      syncInterface();
    }
    return;
  }

  if (modelOptionsLoading.has(sourceId)) {
    return;
  }

  modelOptionsLoading.add(sourceId);

  try {
    let modelOptions = STATIC_MODEL_OPTIONS[sourceId];

    if (sourceId === "openrouter") {
      modelOptions = await fetchOpenRouterModels();
    } else if (sourceId === LOCAL_MODEL_SOURCE_ID) {
      modelOptions = await fetchOllamaModels();
      sessionState.local.available = true;
      localModelError = "";
    }

    modelOptionsCache.set(sourceId, modelOptions.length ? modelOptions : STATIC_MODEL_OPTIONS[sourceId]);
    writeSessionState();

    if (getCurrentModelSourceId() === sourceId) {
      syncInterface();
    }
  } catch (error) {
    if (sourceId === LOCAL_MODEL_SOURCE_ID) {
      sessionState.local.available = false;
      localModelError = error instanceof Error ? error.message : "ollama not detected.";
      modelOptionsCache.delete(sourceId);
      writeSessionState();

      if (sessionState.mode === "local") {
        syncInterface();
      }
    } else {
      modelOptionsCache.set(sourceId, STATIC_MODEL_OPTIONS[sourceId]);

      if (!options?.silent && getCurrentModelSourceId() === sourceId) {
        const message = error instanceof Error ? error.message : "model list failed.";
        setWarning(message, { flashMs: NOTICE_FLASH_MS });
      }

      if (getCurrentModelSourceId() === sourceId) {
        syncInterface();
      }
    }
  } finally {
    modelOptionsLoading.delete(sourceId);
    syncRunAvailability();
  }
};

const refreshCurrentModels = (options?: { silent?: boolean }) =>
  isRouteConfigured()
    ? loadModelOptionsForSource(getCurrentModelSourceId(), options)
    : Promise.resolve();

const setMode = (mode: Mode) => {
  if (blockPendingMintMutation()) {
    return false;
  }
  sessionState.routeConfigured = true;
  sessionState.mode = mode;
  pendingMyBrainRunPayload = null;
  resetMintRuntimeState();
  writeSessionState();
  syncInterface();

  if (mode === "local") {
    void refreshCurrentModels({ silent: true });
  } else {
    void refreshCurrentModels({ silent: true });
  }

  if (mode === "connect" && !sessionState.connect.apiKey.trim() && !isOpenRouterConnectSupported()) {
    setWarning(getOpenRouterConnectConstraintMessage(), { level: "warn" });
  } else {
    setWarning("");
  }

  setStatus("");
  return true;
};

const setThoughtInstructionsOverride = (override: ThoughtInstructionsOverride | null) => {
  thoughtInstructionsOverride = ENABLE_THOUGHT_UPLOAD ? override : null;
  writeThoughtInstructionsOverride();
  syncThoughtInstructionsControls();
};

const handleThoughtFileSelection = async () => {
  const file = thoughtFileInput.files?.[0];
  thoughtFileInput.value = "";

  if (!file) {
    return;
  }

  try {
    const content = await file.text();

    if (!content.trim()) {
      throw new Error("THOUGHT.md is empty.");
    }

    setThoughtInstructionsOverride({
      name: file.name || "uploaded THOUGHT.md",
      content,
    });
    setWarning("");
    setStatus(`loaded ${file.name || "THOUGHT.md"}.`, { flashMs: NOTICE_FLASH_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "THOUGHT.md upload failed.";
    setWarning(message, { flashMs: NOTICE_FLASH_MS });
    setStatus("failed.");
  }
};

const promotePreviewedCandidateToWork = (
  candidate: ThoughtCandidate,
  preview: ContractWorkPreview,
  trace: ThoughtPreviewProviderTrace,
) => {
  if (blockPendingMintMutation()) {
    return false;
  }
  lastRejectedRun = null;
  lastPreviewRetryContext = null;
  recordThoughtRun(
    candidate.payload,
    candidate.rawModelReturn,
    preview.text,
    trace,
    candidate.agentEvidence,
  );
  if (!setAgentOutput(preview.text, candidate.rawModelReturn, preview.svg)) {
    return false;
  }
  clearCurrentCandidate();
  runState = "output_ready";
  walletState.txState = "idle";
  walletState.txError = "";
  walletState.txHash = "";
  walletState.mintedTokenId = null;
  syncCtaState();
  void preflightCurrentThoughtExistence();
  void refreshWalletState().then(() => {
    syncInterface();
  });
  setStatus("");
  setWarning("");
  return true;
};

const completeThoughtRunFromModelReturn = async (
  thoughtRunPayload: ThoughtRunPayload,
  modelReturn: string,
  agentEvidence?: ThoughtV2LocalAgentEvidence,
) => {
  if (blockPendingMintMutation()) {
    return { kind: "pending_mint" as const };
  }
  const candidate = createThoughtCandidate(thoughtRunPayload, modelReturn, agentEvidence);
  currentCandidate = candidate;
  writeCurrentCandidateSession();
  resetMintRuntimeState();
  lastPreviewRetryContext = {
    payload: thoughtRunPayload,
    modelReturn,
  };

  const attempt = await attemptContractPreviewForCandidate(candidate, { manual: false });

  if (attempt.kind === "unavailable") {
    runState = "candidate_ready";
    lastRunErrorCliLines = attempt.lines;
    setStatus("");
    setWarning("preview unavailable.", { level: "warn" });
    syncInterface();
    return attempt;
  }

  if (attempt.kind === "rejected") {
    lastPreviewRetryContext = null;
    throw attempt.error;
  }

  if (!promotePreviewedCandidateToWork(candidate, attempt.preview, attempt.trace)) {
    return { kind: "pending_mint" as const };
  }
  return attempt;
};

const runAgent = async (options?: { forceGenerate?: boolean; cli?: boolean }) => {
  if (!options?.forceGenerate) {
    if (isDebugCtaOverrideActive()) {
      setStatus("debug CTA only.", { flashMs: NOTICE_FLASH_MS });
      return;
    }

    if (primaryActionState === "connect_wallet") {
      await requestWalletConnect();
      return;
    }

    if (primaryActionState === "switch_wallet") {
      await switchWalletChain();
      return;
    }

    if (primaryActionState === "mint" || primaryActionState === "retry_mint") {
      await openMintFlow(THOUGHT_PANEL_MINT_UI_MODE);
      return;
    }

    if (primaryActionState === "none") {
      return;
    }
  }

  if (blockPendingMintMutation({ cli: options?.cli })) {
    return;
  }

  if (!isRouteConfigured()) {
    setWarning("config route is required.", { level: "warn" });
    setStatus("");
    return;
  }

  const prompt = protocolLineInput(sessionState.prompt);
  const model = getCurrentModelValue().trim();

  if (!prompt.trim()) {
    setWarning("prompt is required.", { level: "warn" });
    setStatus("");
    return;
  }

  if (!model) {
    setWarning("model is required.", { level: "warn" });
    setStatus("");
    return;
  }

  if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
    setWarning("authorize openrouter first.", { level: "warn" });
    setStatus("");
    return;
  }

  if (sessionState.mode === "direct" && !getDirectApiKey()) {
    setWarning("api key is required.", { level: "warn" });
    setStatus("");
    return;
  }

  if (sessionState.mode === "local" && sessionState.local.available === false) {
    setWarning("ollama not detected.");
    setStatus("");
    return;
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    setWarning("waiting for model return. use return <text>.", { level: "warn" });
    setStatus("");
    return;
  }

  const runId = startRunSession();
  let thoughtRunPayload: ThoughtRunPayload | null = null;
  lastRunErrorCliLines = [];
  lastPreviewRetryContext = null;

  try {
    await ensureActiveThoughtSpec({ force: true });
    if (!isCurrentRunSession(runId)) {
      return;
    }
    syncThoughtInstructionsControls();
    thoughtRunPayload = buildCurrentThoughtRunPayload(prompt, model);
  } catch (error) {
    if (!isCurrentRunSession(runId)) {
      return;
    }
    const message = formatThoughtSpecError(error);
    runState = "run_failed";
    lastRunErrorCliLines = ["run failed.", message, "", "use: THOUGHT.md"];
    setWarning(message);
    setStatus("");
    syncInterface();
    return;
  }

  if (!thoughtRunPayload) {
    return;
  }

  setWarning("");
  setStatus("");
  runState = "running";
  runInFlight = true;
  syncInterface();

  try {
    let text = "";
    let agentEvidence: ThoughtV2LocalAgentEvidence | undefined;

    if (sessionState.mode === "connect") {
      text = await requestOpenRouterChat(sessionState.connect.apiKey.trim(), thoughtRunPayload);
    } else if (sessionState.mode === "direct") {
      const directProvider = sessionState.direct.provider;
      const apiKey = getDirectApiKey(directProvider);

      if (directProvider === "openai") {
        text = await requestOpenAIResponses(apiKey, thoughtRunPayload);
      } else if (directProvider === "openrouter") {
        text = await requestOpenRouterChat(apiKey, thoughtRunPayload);
      } else {
        text = await requestAnthropicMessages(apiKey, thoughtRunPayload);
      }
    } else if (sessionState.mode === CODEX_MODE) {
      const returned = await requestCodexAgent(thoughtRunPayload);
      text = returned.agentLine;
      agentEvidence = returned.agentEvidence;
    } else {
      text = await requestOllama(thoughtRunPayload);
    }

    if (!isCurrentRunSession(runId)) {
      return;
    }

    if (options?.cli) {
      appendCliOutput([
        "model return received.",
        "model return saved as candidate.",
        "rendering preview...",
      ]);
    }

    await completeThoughtRunFromModelReturn(thoughtRunPayload, text, agentEvidence);
  } catch (error) {
    if (!isCurrentRunSession(runId)) {
      return;
    }
    runState = "run_failed";
    const message = error instanceof Error ? error.message : "Agent request failed.";
    lastRunErrorCliLines = message === THOUGHT_BRIDGE_NOT_CONNECTED_MESSAGE
      ? thoughtBridgeNotConnectedLines()
      : isContractWorkPreviewError(error)
        ? error.cliLines ?? ["run failed.", message, "use: retry run"]
        : ["run failed.", message, "", "use: retry run"];
    if (!isContractWorkPreviewError(error) || error.kind !== "model-return-rejected") {
      lastRejectedRun = null;
    }
    setWarning(lastRunErrorCliLines[0] ?? message);
    setStatus("");
  } finally {
    if (isCurrentRunSession(runId)) {
      runInFlight = false;
      syncInterface();
    }
  }
};

const trimCliEntries = () => {
  if (cliEntries.length > 80) {
    cliEntries.splice(0, cliEntries.length - 80);
  }
};

const isCliEntryKind = (value: unknown): value is CliEntryKind =>
  value === "intro" || value === "command" || value === "output" || value === "error";

const readStoredCliTranscript = () => {
  const raw = readSharedBrowserItem(THOUGHT_CLI_TRANSCRIPT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry): CliEntry[] => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const candidate = entry as { kind?: unknown; lines?: unknown };
      if (!isCliEntryKind(candidate.kind) || !Array.isArray(candidate.lines)) {
        return [];
      }

      const lines = candidate.lines
        .filter((line): line is string => typeof line === "string")
        .slice(0, 48);
      if (!lines.some((line) => line.length > 0)) {
        return [];
      }

      return [{ kind: candidate.kind, lines }];
    }).slice(-80);
  } catch {
    return [];
  }
};

const writeCliTranscript = () => {
  writeSharedBrowserItem(
    THOUGHT_CLI_TRANSCRIPT_STORAGE_KEY,
    JSON.stringify(cliEntries.slice(-80)),
  );
};

const loadCliTranscript = () => {
  cliEntries.splice(0, cliEntries.length, ...readStoredCliTranscript());
};

const isCliRunningEntry = (entry: CliEntry | undefined) =>
  entry?.kind === "output" && /^running/.test(entry.lines[0] ?? "");

const markInterruptedCliRun = () => {
  const lastEntry = cliEntries[cliEntries.length - 1];
  if (!isCliRunningEntry(lastEntry)) {
    return;
  }

  appendCliError(["run interrupted.", "refresh stopped the request.", "use: retry run"]);
};

const startRunSession = () => {
  activeRunId += 1;
  return activeRunId;
};

const invalidateRunSession = () => {
  activeRunId += 1;
};

const isCurrentRunSession = (runId: number) => runId === activeRunId;

type AppendCliEntryOptions = {
  preserveSpacing?: boolean;
};

const CLI_SECTION_LABELS = new Set([
  "use:",
  "routes:",
  "flow:",
  "more:",
  "need $PATH:",
  "alternatives:",
]);

const CLI_FOLLOW_UP_PREFIXES = ["use:", "next:", "clear:", "run:", "detect:"];

const isCliFollowUpLine = (line: string) => {
  const trimmed = line.trim();
  return CLI_FOLLOW_UP_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
};

const CLI_VERIFY_CONTRACTS_LINK_LABEL = "verify contracts ↗";

const isCliSectionLabel = (line: string) => CLI_SECTION_LABELS.has(line.trim());

const formatCliSectionLines = (lines: string[]) => {
  const formatted: string[] = [];

  for (const line of lines) {
    const previous = formatted[formatted.length - 1] ?? "";
    const needsBreak =
      previous.trim() &&
      (isCliSectionLabel(line) ||
        (isCliFollowUpLine(line) && !isCliFollowUpLine(previous) && !isCliSectionLabel(previous)));

    if (needsBreak) {
      formatted.push("");
    }

    formatted.push(line);
  }

  return formatted;
};

const normalizeCliEntryLines = (
  kind: CliEntryKind,
  lines: string | string[],
  options: AppendCliEntryOptions = {},
) => {
  const normalizedLines = Array.isArray(lines) ? lines : [lines];
  if (options.preserveSpacing || (kind !== "output" && kind !== "error")) {
    return normalizedLines;
  }

  return formatCliSectionLines(normalizedLines);
};

const appendCliEntry = (
  kind: CliEntryKind,
  lines: string | string[],
  options: AppendCliEntryOptions = {},
) => {
  const normalizedLines = normalizeCliEntryLines(kind, lines, options);
  if (!normalizedLines.some((line) => line.length > 0)) {
    return null;
  }

  const entry = { kind, lines: normalizedLines };
  cliEntries.push(entry);
  trimCliEntries();
  writeCliTranscript();
  syncCliPanel();
  return entry;
};

const displayCliCommand = (command: string) => {
  return redactThoughtShellInput(command);
};

const isMyBrainShellActive = () =>
  sessionState.mode === MY_BRAIN_MODE && runState === "running" && pendingMyBrainRunPayload !== null;

const currentCliShellPrompt = () => (isMyBrainShellActive() ? "my-brain>" : "thought>");

const getThoughtSurfaceShellState = (): ThoughtShellState => ({
  prompt: sessionState.prompt,
  route: sessionState.mode,
  routeConfigured: sessionState.routeConfigured,
  provider: sessionState.mode === "direct" ? sessionState.direct.provider : ROUTE_COPY[sessionState.mode].provider,
  model: getCurrentModelValue(),
  apiKeyConfigured: sessionState.mode === "direct"
    ? Boolean(getDirectApiKey())
    : Boolean(sessionState.connect.apiKey.trim()),
  localEndpoint: sessionState.local.endpoint,
  localAvailable: sessionState.local.available,
  openRouterLinked: Boolean(sessionState.connect.apiKey.trim()),
  previewMode: readPreviewMode(),
  previewProvider: cliPreviewProviderState(),
  walletConnected: Boolean(walletState.address),
  walletChainReady: walletState.chainId === THOUGHT_CHAIN_ID,
  pathSelected: mintFlowData.pathId !== null,
  pathAuthorized: mintFlowState === "authorized" || mintFlowState === "minting" || mintFlowState === "minted",
  candidateReady: runState === "candidate_ready",
  workReady: runState === "output_ready" || Boolean(currentOutputText),
  myBrainWaiting: isMyBrainShellActive(),
});

const thoughtSurfaceShell = createThoughtSurfaceShellAdapter(getThoughtSurfaceShellState);

const shouldRecordCliCommand = (command: string) => {
  return shouldRecordThoughtShellInput(command);
};

const readStoredCliCommandHistory = () => {
  const raw = readSharedBrowserItem(THOUGHT_CLI_HISTORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && shouldRecordCliCommand(entry))
      .slice(-CLI_COMMAND_HISTORY_LIMIT);
  } catch {
    return [];
  }
};

const writeCliCommandHistory = () => {
  writeSharedBrowserItem(
    THOUGHT_CLI_HISTORY_STORAGE_KEY,
    JSON.stringify(cliCommandHistory.slice(-CLI_COMMAND_HISTORY_LIMIT)),
  );
};

const loadCliCommandHistory = () => {
  cliCommandHistory.splice(0, cliCommandHistory.length, ...readStoredCliCommandHistory());
};

const resetCliHistoryCursor = () => {
  cliHistoryIndex = null;
  cliHistoryDraft = "";
};

const resetCliCompletionCursor = () => {
  cliCompletionPrefix = "";
  cliCompletionMatches = [];
  cliCompletionIndex = null;
};

const resetCliInputNavigation = () => {
  resetCliHistoryCursor();
  resetCliCompletionCursor();
};

const recordCliCommandHistory = (command: string) => {
  if (!shouldRecordCliCommand(command)) {
    resetCliInputNavigation();
    return;
  }

  const previous = cliCommandHistory[cliCommandHistory.length - 1];
  if (previous !== command) {
    cliCommandHistory.push(command);
  }

  if (cliCommandHistory.length > CLI_COMMAND_HISTORY_LIMIT) {
    cliCommandHistory.splice(0, cliCommandHistory.length - CLI_COMMAND_HISTORY_LIMIT);
  }
  writeCliCommandHistory();
  resetCliInputNavigation();
};

const setCliInputCommand = (command: string) => {
  thoughtCliInput.value = command;
  requestAnimationFrame(() => {
    thoughtCliInput.setSelectionRange(command.length, command.length);
  });
};

const normalizeCliCompletionPrefix = (value: string) =>
  value.trimStart().replace(/\s+/g, " ").toLowerCase();

const cliCompletionCommandCatalog = () => {
  const commands = [
    "config",
    "config route local",
    "config route connect",
    "config route direct",
    "config route my-brain",
    "config route codex",
    "config local",
    "config local detect",
    "config local endpoint ",
    "config local model list",
    "config local model ",
    "config connect",
    "config connect authorize",
    "config connect disconnect",
    "config connect model list",
    "config connect model ",
    "config direct",
    "config direct provider list",
    "config direct provider ",
    ...directProviderIds().map((providerId) => `config direct provider ${providerId}`),
    "config direct key ",
    "config direct key clear",
    "config direct model list",
    "config direct model ",
    "config preview auto",
    "config preview wallet",
    "config preview off",
    "config my-brain",
    "config codex",
    "prompt ",
    "prompt clear",
    "spec",
    "spec text",
    "THOUGHT.md",
    "THOUGHT.md text",
    "color-font",
    "color-font raw",
    "run",
    "rerun",
    "retry run",
    "preview",
    "preview retry",
    "work",
    "work current",
    "work list",
    "work clear",
    "work previous",
    "work next",
    "work latest",
    "works clear",
    "thought",
    "thought list",
    "mint",
    "path",
    "path list",
    "path ",
    "authorize",
    "confirm",
    "wallet",
    "wallet connect",
    "wallet disconnect",
    "mint-path",
    "current",
    "provenance",
    "provenance --json",
    "gallery",
    "view tx",
    "view THOUGHT ",
    "clear",
    "reset",
    "help",
    "commands",
  ];

  if (isMyBrainShellActive()) {
    commands.push("return ", "cancel");
  }

  return Array.from(new Set(commands));
};

const cliCompletionMatchesFor = (prefix: string) =>
  cliCompletionCommandCatalog().filter((command) =>
    normalizeCliCompletionPrefix(command).startsWith(prefix),
  );

const showCliCompletion = (direction: "previous" | "next") => {
  const inputPrefix = normalizeCliCompletionPrefix(thoughtCliInput.value);
  const selectedCompletion =
    cliCompletionIndex === null ? "" : cliCompletionMatches[cliCompletionIndex] ?? "";
  const isCyclingCompletion =
    !!selectedCompletion &&
    normalizeCliCompletionPrefix(selectedCompletion) === inputPrefix;
  const prefix = isCyclingCompletion ? cliCompletionPrefix : inputPrefix;
  if (!prefix) {
    return false;
  }

  if (!isCyclingCompletion && (prefix !== cliCompletionPrefix || cliCompletionIndex === null)) {
    cliCompletionPrefix = prefix;
    cliCompletionMatches = cliCompletionMatchesFor(prefix);
    cliCompletionIndex = null;
  }

  if (!cliCompletionMatches.length) {
    return true;
  }

  if (cliCompletionIndex === null) {
    cliCompletionIndex = direction === "next" ? 0 : cliCompletionMatches.length - 1;
  } else if (direction === "next") {
    cliCompletionIndex = (cliCompletionIndex + 1) % cliCompletionMatches.length;
  } else {
    cliCompletionIndex =
      (cliCompletionIndex - 1 + cliCompletionMatches.length) % cliCompletionMatches.length;
  }

  setCliInputCommand(cliCompletionMatches[cliCompletionIndex]);
  resetCliHistoryCursor();
  return true;
};

const showPreviousCliCommand = () => {
  if (!cliCommandHistory.length) {
    return;
  }

  if (cliHistoryIndex === null) {
    cliHistoryDraft = thoughtCliInput.value;
    cliHistoryIndex = cliCommandHistory.length - 1;
  } else {
    cliHistoryIndex = Math.max(0, cliHistoryIndex - 1);
  }

  setCliInputCommand(cliCommandHistory[cliHistoryIndex]);
};

const showNextCliCommand = () => {
  if (cliHistoryIndex === null) {
    return;
  }

  if (cliHistoryIndex < cliCommandHistory.length - 1) {
    cliHistoryIndex += 1;
    setCliInputCommand(cliCommandHistory[cliHistoryIndex]);
    return;
  }

  setCliInputCommand(cliHistoryDraft);
  resetCliHistoryCursor();
};

const navigateCliInput = (direction: "previous" | "next") => {
  if (cliHistoryIndex !== null) {
    resetCliCompletionCursor();
    if (direction === "previous") {
      showPreviousCliCommand();
    } else {
      showNextCliCommand();
    }
    return;
  }

  if (thoughtCliInput.value.trim()) {
    showCliCompletion(direction);
    return;
  }

  resetCliCompletionCursor();
  if (direction === "previous") {
    showPreviousCliCommand();
  } else {
    showNextCliCommand();
  }
};

const appendCliCommand = (command: string) => {
  const displayCommand = displayCliCommand(command);
  const shellPrompt = currentCliShellPrompt();
  return appendCliEntry(
    "command",
    shellPrompt === "my-brain>" ? `${shellPrompt} ${displayCommand}` : displayCommand,
  );
};

const appendCliOutput = (lines: string | string[], options?: AppendCliEntryOptions) => {
  return appendCliEntry("output", lines, options);
};

const appendCliError = (lines: string | string[], options?: AppendCliEntryOptions) => {
  return appendCliEntry("error", lines, options);
};

let cliScrollHideTimer = 0;
let cliScrollFrame = 0;

const hasRunningProgressLine = (lines: string[]) =>
  /^(?:running|loading)\.{1,3}$/.test(lines[0] ?? "");

const animateRunningProgressLine = (line: string, index: number) => {
  if (index !== 0 || !/^(?:running|loading)\.{1,3}$/.test(line)) {
    return line;
  }

  const dots = ".".repeat((cliProgressTick % 3) + 1);
  return line.replace(/\.{1,3}$/, dots);
};

const stopCliProgress = () => {
  if (cliProgressTimer) {
    window.clearInterval(cliProgressTimer);
    cliProgressTimer = 0;
  }
  cliProgressEntry = null;
  cliProgressBaseLines = [];
  cliProgressDetailLines = [];
};

const updateCliProgress = () => {
  if (!cliProgressEntry) {
    return;
  }

  cliProgressTick += 1;
  const lines = cliProgressBaseLines.map(animateRunningProgressLine);
  if (cliProgressDetailLines.length > 0 && lines.length > 1) {
    const detailIndex =
      Math.floor(cliProgressTick / CLI_PROGRESS_DETAIL_ROTATE_TICKS) %
      cliProgressDetailLines.length;
    lines[1] = cliProgressDetailLines[detailIndex];
  }
  cliProgressEntry.lines = lines;
  writeCliTranscript();
  syncCliPanel();
};

const startCliProgress = (entry: CliEntry | null, detailLines: readonly string[] = []) => {
  stopCliProgress();
  if (!entry || !hasRunningProgressLine(entry.lines)) {
    return;
  }

  cliProgressEntry = entry;
  cliProgressBaseLines = [...entry.lines];
  cliProgressDetailLines = [...detailLines];
  cliProgressTick = 0;
  cliProgressTimer = window.setInterval(updateCliProgress, 600);
};

const appendCliProgressOutput = (
  lines: string | string[],
  detailLines: readonly string[] = [],
) => {
  const progressLines = Array.isArray(lines) ? [...lines] : [lines];
  if (detailLines.length > 0) {
    if (progressLines.length === 1) {
      progressLines.push(detailLines[0]);
    } else {
      progressLines[1] = detailLines[0];
    }
  }
  const entry = appendCliOutput(progressLines);
  startCliProgress(entry, detailLines);
  return entry;
};

const withCliLoading = async <T>(
  lines: string | string[],
  action: () => Promise<T>,
  detailLines: readonly string[] = [],
): Promise<T> => {
  appendCliProgressOutput(lines, detailLines);
  try {
    return await action();
  } finally {
    stopCliProgress();
  }
};

const startCliRunProgress = () => {
  appendCliProgressOutput([
    "running...",
    "one model round.",
    "prompt + THOUGHT.md in.",
    "waiting for model return.",
  ]);
};

const revealCliScrollbar = () => {
  window.clearTimeout(cliScrollHideTimer);
  thoughtCliTranscript.classList.add("is-scrolling");
  cliScrollHideTimer = window.setTimeout(() => {
    thoughtCliTranscript.classList.remove("is-scrolling");
  }, 800);
};

const scrollCliTranscriptToBottom = () => {
  thoughtCliTranscript.scrollTop = thoughtCliTranscript.scrollHeight;
};

const scheduleCliTranscriptScrollToBottom = () => {
  window.cancelAnimationFrame(cliScrollFrame);
  revealCliScrollbar();
  scrollCliTranscriptToBottom();
  cliScrollFrame = window.requestAnimationFrame(() => {
    scrollCliTranscriptToBottom();
    cliScrollFrame = window.requestAnimationFrame(() => {
      scrollCliTranscriptToBottom();
      cliScrollFrame = 0;
    });
  });
};

const renderCliTranscript = () => {
  const nodes = cliEntries.map((entry) => {
    const block = document.createElement("div");
    block.className = `thought-cli-entry thought-cli-entry--${entry.kind}`;
    entry.lines.forEach((line, index) => {
      const row = document.createElement("div");
      const hasShellPrefix = line.startsWith("> ") || line.startsWith("my-brain> ");
      const displayLine = entry.kind === "command" && index === 0 && !hasShellPrefix ? `> ${line}` : line;
      if (displayLine === CLI_VERIFY_CONTRACTS_LINK_LABEL) {
        const link = document.createElement("a");
        link.className = "thought-cli-link";
        link.href = PATH_VERIFY_CONTRACTS_URL;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = CLI_VERIFY_CONTRACTS_LINK_LABEL;
        row.append(link);
      } else {
        row.textContent = displayLine || " ";
      }
      block.append(row);
    });
    return block;
  });

  thoughtCliTranscript.replaceChildren(...nodes);
};

const getProvenanceSummary = () => {
  if (!currentOutputText) {
    return null;
  }

  try {
    const provenanceJson = buildProvenanceJson(hashText(currentOutputText));
    return {
      bytes: byteLength(provenanceJson),
      json: provenanceJson,
    };
  } catch {
    return null;
  }
};

const getCliSuggestions = (): CliSuggestion[] => {
  if (isMyBrainShellActive()) {
    return [
      { label: "return <text>", command: "return " },
      { label: "cancel", command: "cancel" },
      { label: "current", command: "current" },
      { label: "help", command: "help" },
    ];
  }

  if (cliCommandInFlight) {
    return [
      { label: "current", command: "current" },
      { label: "help", command: "help" },
    ];
  }

  if (cliSuggestionContext === "help") {
    return [
      { label: "config", command: "config" },
      { label: "prompt <text>", command: "prompt " },
      { label: "run", command: "run" },
      { label: "current", command: "current" },
      { label: "verify", command: "verify" },
    ];
  }

  if (cliSuggestionContext === "config") {
    if (!isRouteConfigured()) {
      return [
        { label: "config route local", command: "config route local" },
        { label: "config route connect", command: "config route connect" },
        { label: "config route direct", command: "config route direct" },
        { label: "config route my-brain", command: "config route my-brain" },
        { label: "config route codex", command: "config route codex" },
      ];
    }

    if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
      return [
        { label: "config connect authorize", command: "config connect authorize" },
        { label: "config connect model list", command: "config connect model list" },
        { label: "current", command: "current" },
      ];
    }

    if (sessionState.mode === "connect" && sessionState.connect.apiKey.trim()) {
      return [
        { label: "run", command: "run" },
        { label: "config connect disconnect", command: "config connect disconnect" },
        { label: "config connect model list", command: "config connect model list" },
      ];
    }

    if (sessionState.mode === "direct" && !getDirectApiKey()) {
      return [
        { label: "config direct provider list", command: "config direct provider list" },
        { label: `config direct provider ${sessionState.direct.provider}`, command: `config direct provider ${sessionState.direct.provider}` },
        { label: "config direct key <api-key>", command: "config direct key " },
        { label: "current", command: "current" },
      ];
    }

    if (sessionState.mode === "local") {
      return sessionState.local.available === true
        ? [
            { label: "config local model list", command: "config local model list" },
            { label: "prompt <text>", command: "prompt " },
            { label: "run", command: "run" },
          ]
        : [
            { label: "config local detect", command: "config local detect" },
            { label: "config local endpoint", command: "config local endpoint " },
            { label: "config connect", command: "config connect" },
          ];
    }

    if (sessionState.mode === MY_BRAIN_MODE) {
      return [
        { label: "prompt <text>", command: "prompt " },
        { label: "run", command: "run" },
      ];
    }

    if (sessionState.mode === CODEX_MODE) {
      return [
        { label: "prompt <text>", command: "prompt " },
        { label: "run", command: "run" },
        { label: "current", command: "current" },
      ];
    }

    return [
      { label: "prompt <text>", command: "prompt " },
      { label: "run", command: "run" },
      { label: `config ${sessionState.mode} model list`, command: `config ${sessionState.mode} model list` },
    ];
  }

  if (mintFlowState === "wallet_required") {
    return [
      { label: "wallet connect", command: "wallet connect" },
      { label: "mint-path", command: "mint-path" },
      { label: "help mint", command: "help mint" },
    ];
  }

  if (mintFlowState === "path_required" || isPathRecoveryError()) {
    return [
      { label: "path list", command: "path list" },
      { label: "path <id>", command: "path " },
      { label: "mint-path", command: "mint-path" },
      { label: "current", command: "current" },
    ];
  }

  if (mintFlowState === "path_ready" || mintFlowState === "authorizing") {
    return [
      { label: "authorize", command: "authorize" },
      { label: "path list", command: "path list" },
      { label: "path <id>", command: "path " },
      { label: "current", command: "current" },
    ];
  }

  if (mintFlowState === "authorized" || mintFlowState === "minting") {
    return [
      { label: "confirm", command: "confirm" },
      { label: "current", command: "current" },
    ];
  }

  if (mintFlowState === "minted") {
    const tokenId = walletState.mintedTokenId ?? mintFlowData.existingTokenId;
    return [
      { label: "view tx", command: "view tx" },
      {
        label: tokenId ? `view THOUGHT #${tokenId}` : "view THOUGHT <id>",
        command: tokenId ? `view THOUGHT ${tokenId}` : "view THOUGHT ",
      },
      { label: "gallery", command: "gallery" },
    ];
  }

  if (runState === "output_ready") {
    return [
      { label: "mint", command: "mint" },
      { label: "rerun", command: "rerun" },
      { label: "provenance", command: "provenance" },
      { label: "work list", command: "work list" },
    ];
  }

  if (runState === "candidate_ready") {
    return [
      { label: "preview retry", command: "preview retry" },
      { label: "wallet connect", command: "wallet connect" },
      { label: "rerun", command: "rerun" },
    ];
  }

  if (runState === "run_failed") {
    if (lastRejectedRun) {
      return [
        { label: "prompt <text>", command: "prompt " },
        { label: "config", command: "config" },
        { label: "config my-brain", command: "config my-brain" },
        { label: "current", command: "current" },
      ];
    }

    return [
      lastPreviewRetryContext
        ? { label: "preview retry", command: "preview retry" }
        : { label: "retry run", command: "retry run" },
      { label: "current", command: "current" },
      { label: "help", command: "help" },
    ];
  }

  if (!sessionState.prompt.trim()) {
    return [
      { label: "config", command: "config" },
      { label: "prompt <text>", command: "prompt " },
      { label: "run", command: "run" },
      { label: "mint", command: "mint" },
    ];
  }

  if (!isRouteConfigured()) {
    return [
      { label: "config route local", command: "config route local" },
      { label: "config route connect", command: "config route connect" },
      { label: "config route direct", command: "config route direct" },
      { label: "config route codex", command: "config route codex" },
      { label: "current", command: "current" },
    ];
  }

  if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
    return [
      { label: "config connect authorize", command: "config connect authorize" },
      { label: "config connect model list", command: "config connect model list" },
      { label: "current", command: "current" },
    ];
  }

  if (sessionState.mode === "direct" && !getDirectApiKey()) {
    return [
      { label: "config direct provider list", command: "config direct provider list" },
      { label: `config direct provider ${sessionState.direct.provider}`, command: `config direct provider ${sessionState.direct.provider}` },
      { label: "config direct key <api-key>", command: "config direct key " },
      { label: "current", command: "current" },
    ];
  }

  if (sessionState.mode === "local" && sessionState.local.available !== true) {
    return [
      { label: "config local detect", command: "config local detect" },
      { label: "config local endpoint", command: "config local endpoint " },
      { label: "config connect", command: "config connect" },
    ];
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    return [
      { label: "run", command: "run" },
      { label: "current", command: "current" },
      { label: "help", command: "help" },
    ];
  }

  if (sessionState.mode === CODEX_MODE) {
    return [
      { label: "run", command: "run" },
      { label: "current", command: "current" },
      { label: "help codex", command: "help codex" },
    ];
  }

  return [
    { label: "run", command: "run" },
    { label: `config ${sessionState.mode} model list`, command: `config ${sessionState.mode} model list` },
    { label: "current", command: "current" },
    { label: "verify", command: "verify" },
    { label: "help", command: "help" },
  ];
};

const renderCliSuggestions = () => {
  const label = document.createElement("span");
  label.className = "thought-cli__suggestion-label";
  label.textContent = "next:";

  const buttons = getCliSuggestions().map((suggestion) => {
    const button = document.createElement("button");
    button.className = "thought-cli__suggestion";
    button.type = "button";
    button.textContent = `[ ${suggestion.label} ]`;
    button.title = suggestion.command;
    button.addEventListener("click", () => {
      if (suggestion.command.endsWith(" ")) {
        thoughtCliInput.value = suggestion.command;
        thoughtCliInput.focus();
        return;
      }
      void executeCliCommand(suggestion.command);
    });
    return button;
  });

  thoughtCliSuggestions.replaceChildren(label, ...buttons);
};

const renderPluginPage = () => {
  const agentLabel =
    ROUTE_PLUGIN_AGENT === "codex"
      ? "Codex"
      : ROUTE_PLUGIN_AGENT === "claude"
        ? "Claude"
        : "";
  pluginTitle.textContent = agentLabel
    ? `THOUGHT Plugin for ${agentLabel}`
    : "Start from your Agent app";
  pluginSummary.textContent = agentLabel
    ? `${agentLabel} makes the candidate. THOUGHT is where you review and mint it.`
    : "The Agent makes the candidate. THOUGHT is where you review and mint it.";
  pluginCodexCard.classList.toggle("is-selected", ROUTE_PLUGIN_AGENT === "codex");
  pluginClaudeCard.classList.toggle("is-selected", ROUTE_PLUGIN_AGENT === "claude");
};

function syncCliPanel() {
  renderCliTranscript();
  renderCliSuggestions();
  if (thoughtCliInput) {
    thoughtCliInput.disabled = cliCommandInFlight;
  }
  thoughtCliPrompt!.textContent = currentCliShellPrompt();
  scheduleCliTranscriptScrollToBottom();
}

const initializeCliTranscript = () => {
  if (cliEntries.length) {
    return;
  }

  const intro = [
    "THOUGHT operator.",
    "",
    "one model round.",
    "prompt + THOUGHT.md in.",
    "candidate out.",
    "preview makes work mintable.",
    "",
    "quick start:",
    "config",
    "prompt <text>",
    "run",
    "mint",
  ];

  appendCliEntry("intro", intro);
};

const focusCliInput = () => {
  if (document.activeElement === thoughtCliInput || thoughtCliInput.disabled) {
    return;
  }

  requestAnimationFrame(() => {
    thoughtCliInput.focus();
  });
};

const shouldRefocusCliFromClick = (target: EventTarget | null) => {
  if (frontpageStage.classList.contains("is-hidden") || !(target instanceof HTMLElement)) {
    return false;
  }

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }

  if (target.closest(".thought-cli__transcript")) {
    return false;
  }

  const editableTarget = target.closest("input, textarea, select, [contenteditable='true']");
  return !editableTarget || editableTarget === thoughtCliInput;
};

const shouldRefocusCliFromKeyboard = (event: KeyboardEvent) => {
  if (
    frontpageStage.classList.contains("is-hidden") ||
    thoughtCliInput.disabled ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }

  if (document.activeElement === thoughtCliInput) {
    return false;
  }

  const target = event.target;
  if (target instanceof HTMLElement) {
    const editableTarget = target.closest("input, textarea, select, [contenteditable='true']");
    if (editableTarget && editableTarget !== thoughtCliInput) {
      return false;
    }
  }

  if (mintFlowUiMode === "sheet" && mintFlowState !== "closed") {
    return false;
  }

  return event.key.length === 1 || event.key === "Backspace" || event.key === "ArrowUp" || event.key === "ArrowDown";
};

const focusCliInputFromKeyboard = (event: KeyboardEvent) => {
  thoughtCliInput.focus();

  if (event.key.length === 1) {
    event.preventDefault();
    setCliInputCommand(`${thoughtCliInput.value}${event.key}`);
    resetCliInputNavigation();
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    setCliInputCommand(thoughtCliInput.value.slice(0, -1));
    resetCliInputNavigation();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    navigateCliInput("previous");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    navigateCliInput("next");
  }
};

const currentSpecLabel = () => activeThoughtSpec?.ref || getActiveThoughtInstructionsLabel();

const cliRouteLabel = (mode: Mode) => mode;

const currentRouteLabel = () => isRouteConfigured() ? cliRouteLabel(sessionState.mode) : "empty";

const configModelCommandPrefix = (mode?: Mode) =>
  mode || isRouteConfigured() ? `config ${mode ?? sessionState.mode} model` : "config <route> model";

const routeProviderLabel = (mode: Mode = sessionState.mode) => {
  if (!isRouteConfigured() && mode === sessionState.mode) {
    return "empty";
  }

  if (mode === "direct") {
    return sessionState.direct.provider;
  }

  return ROUTE_COPY[mode].provider;
};

const routeModelLabel = (mode: Mode = sessionState.mode) =>
  !isRouteConfigured() && mode === sessionState.mode
    ? "empty"
    : mode === MY_BRAIN_MODE || mode === CODEX_MODE ? ROUTE_COPY[mode].defaultModelLabel : getCurrentModelValue().trim() || "empty";

const routeTableLines = () =>
  (["local", "connect", "direct", MY_BRAIN_MODE, CODEX_MODE] as Mode[]).map(
    (route) => `${route.padEnd(9)} ${ROUTE_COPY[route].brief}`,
  );

const routeUseLines = (mode: Mode = sessionState.mode) =>
  !isRouteConfigured() && mode === sessionState.mode
    ? ["config route <local|connect|direct|my-brain|codex>"]
    : ROUTE_COPY[mode].useLines;

const routeStateLabel = (mode: Mode = sessionState.mode) => {
  if (!isRouteConfigured() && mode === sessionState.mode) {
    return "route not selected";
  }

  if (mode === "local") {
    return `ollama ${cliLocalStatus()}`;
  }

  if (mode === "connect") {
    return `openrouter ${cliAuthorizationState()}`;
  }

  if (mode === "direct") {
    return `api key ${cliApiKeyState()}`;
  }

  if (mode === CODEX_MODE) {
    return "ready";
  }

  return runState === "running" && pendingMyBrainRunPayload ? "waiting for return" : "ready";
};

const routeCommonLines = (mode: Mode = sessionState.mode) => [
  `route: ${mode}`,
  `provider: ${routeProviderLabel(mode)}`,
  `model: ${routeModelLabel(mode)}`,
  ROUTE_COPY[mode].brief,
  `state: ${routeStateLabel(mode)}`,
];

const directProviderIds = () => Object.keys(DIRECT_PROVIDERS) as DirectProviderId[];

const directProviderListLines = () => [
  "providers:",
  ...directProviderIds(),
  "",
  "use: config direct provider <id>",
];

const cliAuthorizationState = () =>
  sessionState.connect.apiKey.trim() ? "linked" : "not linked";

const cliApiKeyState = () =>
  getDirectApiKey() ? "set" : "not set";

const cliLocalStatus = () => {
  if (sessionState.local.available === true) {
    return "detected";
  }
  if (sessionState.local.available === false) {
    return "not detected";
  }
  return "checking";
};

const localSetupUsageLines = () => [
  `endpoint: ${getOllamaEndpoint()}`,
  localModelError || "first: start ollama on this machine.",
  "if already running: allow this browser origin.",
  `allow: ${ollamaCorsSetupCommand()}`,
  "use:",
  "config local detect",
  "config local endpoint <url>",
  "config local model list",
  "config local model <id>",
  "",
  "or use another route:",
  "config connect",
  "config direct",
  "config my-brain",
  "config codex",
];

const formatCliAddress = (address: string) => shortHex(address, 6, 4);

const cliSpecStatus = () => {
  if (!activeThoughtSpec) {
    return {
      state: "missing",
      hint: "run blocked",
      ref: "n/a",
      hash: "n/a",
      shortHash: "n/a",
    };
  }

  return {
    state: "ready",
    hint: `spec ${activeThoughtSpec.ref}`,
    ref: activeThoughtSpec.ref,
    hash: activeThoughtSpec.specHash,
    shortHash: shortHex(activeThoughtSpec.specHash, 10, 8),
  };
};

const cliOutputStatus = () => {
  if (mintFlowState === "minted") {
    return {
      state: "minted",
      hint: viewThoughtUseLine(walletState.mintedTokenId ?? mintFlowData.existingTokenId),
    };
  }

  if (runState === "output_ready") {
    return {
      state: "ready",
      hint: "use: mint",
    };
  }

  if (runState === "running") {
    return {
      state: "running",
      hint: "",
    };
  }

  if (runState === "run_failed") {
    return {
      state: "failed",
      hint: "",
    };
  }

  if (runState === "candidate_ready" || currentCandidate) {
    return {
      state: "candidate",
      hint: "use: preview retry",
    };
  }

  return {
    state: "empty",
    hint: "",
  };
};

const cliCurrentMintState = () => {
  if (mintFlowState === "closed") {
    return runState === "output_ready" ? "ready" : "idle";
  }
  if (mintFlowState === "wallet_required") {
    return "needs wallet";
  }
  if (mintFlowState === "path_required" || mintFlowState === "path_checking") {
    return "needs $PATH";
  }
  if (mintFlowState === "path_ready" || mintFlowState === "authorizing") {
    return "needs authorization";
  }
  if (mintFlowState === "authorized") {
    return "authorized";
  }
  if (mintFlowState === "minting") {
    return "confirming";
  }
  if (mintFlowState === "minted") {
    return "minted";
  }
  if (mintFlowState === "text_taken") {
    return "already minted";
  }
  if (mintFlowState === "error") {
    return "failed";
  }
  return "idle";
};

const cliPromptValue = () => {
  const prompt = protocolLineInput(sessionState.prompt);
  return prompt ? quoteCliText(prompt) : "empty";
};

const cliPathState = () => {
  const path = mintFlowData.pathId?.toString() ?? mintFlowData.pathIdInput.trim();
  if (!path) {
    return "not picked";
  }

  if (mintFlowState === "minted" || mintFlowData.errorKind === "path_consumed") {
    return `#${path} consumed`;
  }
  if (mintFlowState === "authorized" || mintFlowState === "minting") {
    return `#${path} authorized`;
  }
  if (mintFlowState === "path_ready" || mintFlowState === "authorizing") {
    return `#${path} picked`;
  }

  return `#${path}`;
};

const cliCurrentWorkState = () => {
  if (currentWorkId === null) {
    return "empty";
  }

  const work = getWorkById(readStoredThoughtWorks(), currentWorkId);
  if (!work) {
    return `#${currentWorkId}`;
  }

  return `#${work.id} "${formatModelLabel(work.text || work.title, 48)}"`;
};

const cliPreviewEndpointState = () =>
  THOUGHT_PREVIEW_ENDPOINT_ENABLED
    ? `enabled ${THOUGHT_PREVIEW_ENDPOINT_URL}`
    : "disabled";

const cliPreviewProviderState = () => {
  const activeTrace = currentRunContext?.previewProvider ?? currentCandidate?.previewProvider;
  if (activeTrace) {
    return activeTrace.kind === "preview-endpoint"
      ? `${activeTrace.kind} ${activeTrace.endpointLabel ?? ""}`.trim()
      : activeTrace.kind;
  }

  if (readPreviewMode() === "off") {
    return "off";
  }

  if (readPreviewMode() === "wallet") {
    return createWalletPreviewProvider() ? "wallet" : "wallet unavailable";
  }

  return "frontend-renderer";
};

const cliCurrentCandidateState = () => {
  if (!currentCandidate) {
    return "empty";
  }

  const label = currentCandidate.normalizedCandidate || currentCandidate.rawModelReturn;
  return `${currentCandidate.previewStatus} "${formatModelLabel(label, 48)}"`;
};

const myBrainWaitingLines = () => [
  "my-brain is waiting for return.",
  "use: return <text>",
  "use: cancel",
];

const buildCliCurrentLines = () => {
  const provenance = getProvenanceSummary();
  const output = cliOutputStatus();
  const spec = cliSpecStatus();
  const tokenId = walletState.mintedTokenId ?? mintFlowData.existingTokenId;

  const lines = [`route: ${currentRouteLabel()}`];

  if (!isRouteConfigured()) {
    lines.push("provider: empty");
  }
  if (isRouteConfigured() && sessionState.mode === "connect") {
    lines.push("provider: openrouter");
    lines.push(`openrouter ${cliAuthorizationState()}`);
  }
  if (isRouteConfigured() && sessionState.mode === "direct") {
    lines.push(`provider: ${sessionState.direct.provider}`);
    lines.push(`api key: ${cliApiKeyState()}`);
  }
  if (isRouteConfigured() && sessionState.mode === "local") {
    lines.push("provider: ollama", `ollama: ${cliLocalStatus()}`, `endpoint: ${getOllamaEndpoint()}`);
  }
  if (isRouteConfigured() && sessionState.mode === MY_BRAIN_MODE) {
    lines.push(`provider: ${MY_BRAIN_PROVIDER}`);
  }
  if (isRouteConfigured() && sessionState.mode === CODEX_MODE) {
    lines.push(`provider: ${CODEX_PROVIDER}`);
    lines.push(`bridge: ${THOUGHT_AGENT_API_BASE}`);
  }

  lines.push(`model: ${isRouteConfigured() ? getCurrentModelValue().trim() || "empty" : "empty"}`, `prompt: ${cliPromptValue()}`, `THOUGHT.md: ${spec.state}`);

  if (isMyBrainShellActive()) {
    lines.push("work: waiting for model return", "mint: idle", "", "use: return <text>", "use: cancel");
    return lines;
  }

  lines.push(
    `wallet: ${walletState.address ? `connected ${formatCliAddress(walletState.address)}` : "not connected"}`,
    `preview mode: ${readPreviewMode()}`,
    `preview provider: ${cliPreviewProviderState()}`,
    `preview endpoint: ${cliPreviewEndpointState()}`,
    `work: ${cliCurrentWorkState()}`,
    `candidate: ${cliCurrentCandidateState()}`,
    `preview: ${
      currentCandidate && runState === "candidate_ready"
        ? currentCandidate.previewStatus
        : hasCurrentContractWorkSvg()
          ? "accepted contract SVG"
          : currentCandidate
            ? currentCandidate.previewStatus
            : "missing"
    }`,
    `mintable: ${
      currentCandidate && runState === "candidate_ready"
        ? "no"
        : hasCurrentContractWorkSvg()
          ? "yes, after picking a $PATH and wallet confirmation"
          : "no"
    }`,
    `provenance: ${provenance ? `${provenance.bytes} bytes` : "empty"}`,
  );

  if (output.state !== "empty" || mintFlowState !== "closed") {
    lines.push(`$PATH: ${cliPathState()}`, `mint: ${cliCurrentMintState()}`);
  }
  lines.push(`THOUGHT: ${tokenId !== null ? `#${tokenId}` : "empty"}`);
  lines.push(`tx: ${walletState.txHash ? shortHex(walletState.txHash, 10, 8) : "empty"}`);

  if (lastRejectedRun) {
    lines.push(
      "",
      "last run: rejected",
      `reason: ${lastRejectedRun.reasonLabel}`,
    );
    if (lastRejectedRun.reasonCode === 3) {
      lines.push(
        `agent line: ${byteLength(lastRejectedRun.normalizedCandidate ?? lastRejectedRun.modelReturn)} / ${THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes} UTF-8 bytes`,
      );
    }
    lines.push(currentWorkId ? "current work unchanged." : "work: none");
  }

  return lines;
};

const listModelsForCli = () => {
  if (!isRouteConfigured()) {
    return [
      "model list unavailable.",
      ...routeRequiredLines(),
    ];
  }

  if (sessionState.mode === MY_BRAIN_MODE || sessionState.mode === CODEX_MODE) {
    return [
      "model fixed.",
      `model: ${getCurrentModelValue().trim()}`,
      `use: config ${sessionState.mode}`,
    ];
  }

  if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
    return [
      "model list unavailable.",
      "openrouter not linked",
      "use: config connect authorize",
    ];
  }

  const options = getModelOptions(getCurrentModelSourceId());
  if (!options.length) {
    return ["model list unavailable."];
  }

  return [
    "models:",
    ...options.map((option) => option.id),
    "",
    `use: ${configModelCommandPrefix()} <id>`,
  ];
};

const setCliModel = (modelId: string) => {
  if (!isRouteConfigured()) {
    appendCliError(["model unavailable.", ...routeRequiredLines()]);
    return;
  }

  if (sessionState.mode === MY_BRAIN_MODE || sessionState.mode === CODEX_MODE) {
    appendCliOutput(listModelsForCli());
    return;
  }

  if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
    appendCliError(["model unavailable.", "openrouter not linked", "use: config connect authorize"]);
    return;
  }

  const options = getModelOptions(getCurrentModelSourceId());
  if (!modelId || modelId.toLowerCase() === "help") {
    appendCliOutput([
      `model: ${getCurrentModelValue().trim() || "empty"}`,
      `route: ${sessionState.mode}`,
      `use: ${configModelCommandPrefix()} list`,
      `use: ${configModelCommandPrefix()} <id>`,
    ]);
    return;
  }

  if (!options.some((option) => option.id === modelId)) {
    appendCliError(["model not found.", `use: ${configModelCommandPrefix()} list`]);
    return;
  }

  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  setCurrentModelValue(modelId);
  writeSessionState();
  syncInterface();
  appendCliOutput(["model set.", `model: ${modelId}`, "next: run"]);
};

const setCliProvider = (providerId: string) => {
  const normalizedProviderId = providerId.trim().toLowerCase();

  if (normalizedProviderId === "list") {
    appendCliOutput(directProviderListLines());
    return;
  }

  if (!normalizedProviderId || normalizedProviderId === "help") {
    const lines = [
      "provider selects the direct API provider.",
      "",
      `provider: ${sessionState.direct.provider}`,
      "route: direct",
      "",
      ...directProviderListLines(),
    ];
    if (sessionState.mode !== "direct") {
      lines.push("note: provider is used by config direct.");
    }
    appendCliOutput(lines);
    return;
  }

  if (!isDirectProviderId(normalizedProviderId)) {
    appendCliError(["provider not found.", "use: config direct provider list"]);
    return;
  }

  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.mode = "direct";
  sessionState.routeConfigured = true;
  sessionState.direct.provider = normalizedProviderId;
  sessionState.direct.model = DIRECT_PROVIDERS[normalizedProviderId].defaultModel;
  writeSessionState();
  syncInterface();
  void refreshCurrentModels({ silent: true });
  appendCliOutput([
    "provider set.",
    `provider: ${normalizedProviderId}`,
    `api key: ${cliApiKeyState()}`,
    "route: direct",
    getDirectApiKey() ? "use: run" : "use: config direct key <api-key>",
    "use: config direct model list",
  ]);
};

const setCliApiKey = (keyInput: string) => {
  const key = keyInput.trim();
  if (!key || key.toLowerCase() === "help") {
    const lines = [
      `api key: ${cliApiKeyState()}`,
      "policy: memory only. per provider.",
      "use: config direct key <api-key>",
    ];
    if (getDirectApiKey()) {
      lines.push("clear: config direct key clear");
    }
    appendCliOutput(lines);
    return;
  }

  if (key.toLowerCase() === "clear") {
    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    resetMintRuntimeState();
    pendingMyBrainRunPayload = null;
    clearDirectApiKey();
    writeSessionState();
    syncInterface();
    appendCliOutput(["api key cleared.", "use: config direct key <api-key>"]);
    return;
  }

  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.mode = "direct";
  sessionState.routeConfigured = true;
  setDirectApiKey(key);
  writeSessionState();
  syncInterface();
  appendCliOutput(["api key set.", `provider: ${sessionState.direct.provider}`, "policy: memory only. per provider.", "use: run"]);
};

const setCliPrompt = (promptInput: string) => {
  const commandValue = promptInput.trim();
  if (!commandValue || commandValue.toLowerCase() === "help") {
    appendCliOutput([
      `prompt: ${cliPromptValue()}`,
      "use: prompt <text>",
      "clear: prompt clear",
    ]);
    return;
  }

  if (commandValue.toLowerCase() === "clear") {
    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    resetMintRuntimeState();
    pendingMyBrainRunPayload = null;
    sessionState.prompt = "";
    writeSessionState();
    syncInterface();
    appendCliOutput(["prompt: empty", "next: prompt <text>"]);
    return;
  }

  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.prompt = protocolLineInput(promptInput);
  writeSessionState();
  syncInterface();
  appendCliOutput([`prompt: ${cliPromptValue()}`, "next: run"]);
};

const outputCliMode = async (mode: Mode | "") => {
  if (!mode) {
    appendCliOutput(["use: config route <local|connect|direct|my-brain|codex>"]);
    return;
  }

  if (blockPendingMintMutation({ cli: true }) || !setMode(mode)) {
    return;
  }
  await refreshCurrentModels({ silent: true });
  const lines = mode === MY_BRAIN_MODE
    ? [
        "route: my-brain",
        "provider: me",
        "model: my-brain",
        MY_BRAIN_DESCRIPTION,
      ]
    : [...routeCommonLines(mode)];

  if (mode === "local") {
    if (sessionState.local.available === true) {
      lines.push(`endpoint: ${getOllamaEndpoint()}`, "", "use:", ...routeUseLines(mode));
    } else {
      lines.push("");
      lines.push(...localSetupUsageLines());
    }
  } else if (mode === "connect") {
    lines.push("", "use:", ...routeUseLines(mode));
  } else if (mode === "direct") {
    lines.push("policy: memory only. per provider.", "", "use:", ...routeUseLines(mode));
  } else {
    lines.push("", "use:", ...routeUseLines(mode));
  }

  appendCliOutput(lines);
};

const outputCliConfigSummary = () => {
  const lines = [
    "config sets route, provider, and model for one round.",
    "",
    `route: ${currentRouteLabel()}`,
    `provider: ${routeProviderLabel()}`,
    `model: ${routeModelLabel()}`,
    `state: ${routeStateLabel()}`,
    "",
    "routes:",
    ...routeTableLines(),
    "",
    "use:",
    "config route <local|connect|direct|my-brain|codex>",
    "config local",
    "config connect",
    "config direct",
    "config my-brain",
    "config codex",
    "config preview auto|wallet|off",
  ];

  appendCliOutput(lines);
};

const outputCliPreviewConfig = (previewInput: string) => {
  const mode = previewInput.trim().toLowerCase();
  if (!mode || mode === "help" || !isPreviewMode(mode)) {
    appendCliOutput([
      "preview controls validation and rendering after run.",
      `mode: ${readPreviewMode()}`,
      `provider: ${cliPreviewProviderState()}`,
      `endpoint: ${cliPreviewEndpointState()}`,
      "",
      "use:",
      "config preview auto",
      "config preview wallet",
      "config preview off",
    ]);
    return;
  }

  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  writePreviewMode(mode);
  appendCliOutput([
    `preview mode: ${mode}`,
    `provider: ${cliPreviewProviderState()}`,
    `endpoint: ${cliPreviewEndpointState()}`,
    "use: run",
  ]);
};

const startOpenRouterConnectFromCli = async () => {
  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  if (!isRouteConfigured() || sessionState.mode !== "connect") {
    if (!setMode("connect")) return;
  }
  if (sessionState.connect.apiKey.trim()) {
    appendCliOutput(["openrouter linked.", "route: connect", "use: run"]);
    return;
  }
  if (!isOpenRouterConnectSupported()) {
    appendCliError([getOpenRouterConnectConstraintMessage(), "use: config direct"]);
    return;
  }

  appendCliOutput("opening openrouter...");
  await startOpenRouterConnect();
};

const outputCliLocalDetectionResult = () => {
  if (sessionState.local.available === true) {
    appendCliOutput([
      "ollama detected.",
      `endpoint: ${getOllamaEndpoint()}`,
      "use: config local model list",
      "use: run",
    ]);
    return;
  }

  appendCliOutput([
    "ollama not detected.",
    ...localSetupUsageLines(),
  ]);
};

const outputCliRouteModel = async (mode: Mode, modelInput: string) => {
  if (!isRouteConfigured() || sessionState.mode !== mode) {
    if (blockPendingMintMutation({ cli: true }) || !setMode(mode)) {
      return;
    }
  }

  const normalizedInput = modelInput.trim().toLowerCase();
  if (!normalizedInput || normalizedInput === "help") {
    setCliModel("");
    return;
  }

  if (normalizedInput === "list") {
    await refreshCurrentModels({ silent: true });
    appendCliOutput(listModelsForCli());
    return;
  }

  setCliModel(modelInput.trim());
};

const outputCliLocalConfig = async (localInput: string) => {
  const [head = ""] = localInput.trim().split(/\s+/, 1);
  const rest = localInput.trim().slice(head.length).trim();
  const lowerHead = head.toLowerCase();

  if (!lowerHead || lowerHead === "help") {
    await outputCliMode("local");
    return;
  }

  if (lowerHead === "model" || lowerHead === "engine") {
    await outputCliRouteModel("local", rest);
    return;
  }

  if (lowerHead === "detect" || lowerHead === "retry") {
    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    pendingMyBrainRunPayload = null;
    sessionState.routeConfigured = true;
    sessionState.mode = "local";
    sessionState.local.available = null;
    writeSessionState();
    syncInterface();
    appendCliOutput(["detecting ollama...", `endpoint: ${getOllamaEndpoint()}`]);
    await refreshCurrentModels({ silent: true });
    stopCliProgress();
    outputCliLocalDetectionResult();
    return;
  }

  if (lowerHead === "endpoint") {
    if (!rest || rest.toLowerCase() === "help") {
      appendCliOutput([
        `endpoint: ${getOllamaEndpoint()}`,
        "use: config local endpoint <url>",
        `default: ${DEFAULT_OLLAMA_ENDPOINT}`,
        "detect: config local detect",
      ]);
      return;
    }

    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    try {
      sessionState.mode = "local";
      sessionState.routeConfigured = true;
      pendingMyBrainRunPayload = null;
      sessionState.local.endpoint = normalizeOllamaEndpoint(rest);
      sessionState.local.available = null;
      modelOptionsCache.delete(LOCAL_MODEL_SOURCE_ID);
      writeSessionState();
      syncInterface();
      appendCliOutput(["endpoint set.", `endpoint: ${getOllamaEndpoint()}`, "detecting ollama..."]);
      await refreshCurrentModels({ silent: true });
      stopCliProgress();
      outputCliLocalDetectionResult();
    } catch (error) {
      stopCliProgress();
      appendCliError([
        "endpoint invalid.",
        error instanceof Error ? error.message : "use an http(s) endpoint.",
        "use: config local endpoint <url>",
      ]);
    }
    return;
  }

  appendCliError(["local config option not found.", "use: config local"]);
};

const outputCliDirectConfig = async (directInput: string) => {
  const [head = ""] = directInput.trim().split(/\s+/, 1);
  const rest = directInput.trim().slice(head.length).trim();
  const lowerHead = head.toLowerCase();

  if (!lowerHead || lowerHead === "help") {
    await outputCliMode("direct");
    return;
  }

  if (lowerHead === "provider") {
    setCliProvider(rest);
    return;
  }

  if (lowerHead === "key") {
    setCliApiKey(rest);
    return;
  }

  if (lowerHead === "model" || lowerHead === "engine") {
    await outputCliRouteModel("direct", rest);
    return;
  }

  appendCliError(["direct config option not found.", "use: config direct"]);
};

const outputCliConnectConfig = async (connectInput: string) => {
  const [head = ""] = connectInput.trim().split(/\s+/, 1);
  const rest = connectInput.trim().slice(head.length).trim();
  const lowerHead = head.toLowerCase();

  if (!lowerHead || lowerHead === "help") {
    await outputCliMode("connect");
    return;
  }

  if (lowerHead === "authorize" || lowerHead === "openrouter") {
    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    await startOpenRouterConnectFromCli();
    return;
  }

  if (lowerHead === "disconnect") {
    if (blockPendingMintMutation({ cli: true })) {
      return;
    }
    pendingMyBrainRunPayload = null;
    disconnectOpenRouter();
    appendCliOutput(["openrouter unlinked.", "use: config connect authorize"]);
    return;
  }

  if (lowerHead === "model" || lowerHead === "engine") {
    await outputCliRouteModel("connect", rest);
    return;
  }

  appendCliError(["connect config option not found.", "use: config connect"]);
};

const outputCliMyBrainConfig = async (myBrainInput: string) => {
  if (!isRouteConfigured() || sessionState.mode !== MY_BRAIN_MODE) {
    if (blockPendingMintMutation({ cli: true }) || !setMode(MY_BRAIN_MODE)) {
      return;
    }
  }

  const [head = ""] = myBrainInput.trim().split(/\s+/, 1);
  const lowerHead = head.toLowerCase();
  if (!lowerHead || lowerHead === "help") {
    await outputCliMode(MY_BRAIN_MODE);
    return;
  }

  appendCliError(["my-brain config option not found.", "use: config my-brain"]);
};

const outputCliCodexConfig = async (codexInput: string) => {
  if (!isRouteConfigured() || sessionState.mode !== CODEX_MODE) {
    if (blockPendingMintMutation({ cli: true }) || !setMode(CODEX_MODE)) {
      return;
    }
  }

  const [head = ""] = codexInput.trim().split(/\s+/, 1);
  const lowerHead = head.toLowerCase();
  if (!lowerHead || lowerHead === "help") {
    await outputCliMode(CODEX_MODE);
    return;
  }

  if (lowerHead === "model" || lowerHead === "engine") {
    appendCliOutput(listModelsForCli());
    return;
  }

  appendCliError(["codex config option not found.", "use: config codex"]);
};

const outputCliConfig = async (configInput: string) => {
  const [head = ""] = configInput.trim().split(/\s+/, 1);
  const rest = configInput.trim().slice(head.length).trim();
  const lowerHead = head.toLowerCase();
  const lowerRest = rest.toLowerCase();
  const normalizedHead = normalizeModeInput(head);

  if (!lowerHead || lowerHead === "help") {
    outputCliConfigSummary();
    return;
  }

  if (normalizedHead === "local") {
    await outputCliLocalConfig(rest);
    return;
  }

  if (normalizedHead === "direct") {
    await outputCliDirectConfig(rest);
    return;
  }

  if (normalizedHead === "connect") {
    await outputCliConnectConfig(rest);
    return;
  }

  if (normalizedHead === MY_BRAIN_MODE) {
    await outputCliMyBrainConfig(rest);
    return;
  }

  if (normalizedHead === CODEX_MODE) {
    await outputCliCodexConfig(rest);
    return;
  }

  if (lowerHead === "route") {
    if (!lowerRest || lowerRest === "help") {
      appendCliOutput([
        "route selects how THOUGHT reaches a model.",
        "",
        `route: ${currentRouteLabel()}`,
        "",
        "routes:",
        ...routeTableLines(),
        "",
        "use:",
        "config route local",
        "config route connect",
        "config route direct",
        "config route my-brain",
        "config route codex",
      ]);
      return;
    }

    const route = parseModeInput(rest);
    if (route) {
      await outputCliMode(route);
      return;
    }

    appendCliError(["route not found.", "use: config route <local|connect|direct|my-brain|codex>"]);
    return;
  }

  if (lowerHead === "preview") {
    outputCliPreviewConfig(rest);
    return;
  }

  if (lowerHead === "disconnect" && lowerRest === "openrouter") {
    pendingMyBrainRunPayload = null;
    disconnectOpenRouter();
    appendCliOutput(["openrouter unlinked.", "use: config connect authorize"]);
    return;
  }

  if (lowerHead === "model" || lowerHead === "engine") {
    if (!lowerRest || lowerRest === "help") {
      setCliModel("");
      return;
    }
    if (lowerRest === "list") {
      await refreshCurrentModels({ silent: true });
      appendCliOutput(listModelsForCli());
      return;
    }
    setCliModel(rest);
    return;
  }

  if (lowerHead === "provider") {
    setCliProvider(lowerRest);
    return;
  }

  if (lowerHead === "key") {
    setCliApiKey(rest);
    return;
  }

  appendCliError(["config option not found.", "use: config"]);
};

const outputCliProvenance = async (json = false) => {
  if (currentCandidate && (runState === "candidate_ready" || !currentOutputText)) {
    const candidateProvenance = {
      schema: "thought.provenance.v1",
      status: "candidate",
      contractPreviewed: false,
      route: currentCandidate.route,
      provider: currentCandidate.provider,
      model: currentCandidate.model,
      prompt: currentCandidate.prompt,
      returnedTextHash: currentCandidate.rawReturnHash,
      thoughtSpec: currentCandidate.specAnchor,
      preview: {
        status: currentCandidate.previewStatus,
        error: currentCandidate.previewError ?? null,
      },
    };
    appendCliOutput(
      json
        ? formatProvenanceJson(stableStringify(candidateProvenance))
        : [
            "candidate provenance only.",
            "contractPreviewed: false",
            `preview: ${currentCandidate.previewStatus}`,
            "use: preview retry",
          ],
    );
    return;
  }

  if (!currentOutputText) {
    appendCliError(["no work ready.", "next: run"]);
    return;
  }

  try {
    await ensureActiveThoughtSpec();
    const provenance = getProvenanceSummary();
    if (!provenance) {
      throw new Error("provenance unavailable.");
    }

    if (json) {
      appendCliOutput(formatProvenanceJson(provenance.json));
      return;
    }

    if (provenance.bytes > MAX_PROVENANCE_BYTES) {
      appendCliError(provenanceTooLargeLines(provenance.bytes));
      return;
    }

    appendCliOutput([
      "provenance records run context for mint.",
      "schema: thought.provenance.v1",
      `spec: ${currentSpecLabel()}`,
      `prompt: ${currentRunContext?.prompt ? "included" : "unavailable"}`,
      `model return: ${currentRunContext?.returnedText ? "included" : "unavailable"}`,
      `bytes: ${provenance.bytes}`,
      "use: provenance --json",
    ]);
  } catch (error) {
    appendCliError([formatThoughtSpecError(error), "next: current"]);
  }
};

const isThoughtInstructionsCommand = (commandHead: string) =>
  commandHead === "spec" || commandHead === "thought.md";

const thoughtInstructionsUsageLines = (
  state: "available" | "unavailable",
  errorMessage = "",
) => [
  `THOUGHT.md ${state === "available" ? "ready." : "unavailable."}`,
  ...(state === "available" && activeThoughtSpec ? [`spec: ${activeThoughtSpec.ref}`] : []),
  ...(errorMessage ? [`error: ${errorMessage}`] : []),
  "use: THOUGHT.md text",
];

const outputCliThoughtInstructions = async (topic: string) => {
  try {
    await ensureActiveThoughtSpec({ force: true });
    syncThoughtInstructionsControls();
  } catch (error) {
    appendCliOutput(
      thoughtInstructionsUsageLines(
        "unavailable",
        formatThoughtSpecError(error),
      ),
    );
    return;
  }

  const normalizedTopic = topic.trim().toLowerCase();
  const text = getActiveThoughtInstructions().trim();
  const label = getActiveThoughtInstructionsLabel();

  if (normalizedTopic === "text" || normalizedTopic === "show" || normalizedTopic === "cat") {
    appendCliOutput([`THOUGHT.md: ${label}`, ...text.split(/\r?\n/)], { preserveSpacing: true });
    return;
  }

  appendCliOutput([
    "THOUGHT.md spec.",
    "generation spec for a run.",
    `state: ready`,
    `ref: ${activeThoughtSpec?.ref ?? label}`,
    ...(activeThoughtSpec ? [
      `id: ${shortHex(activeThoughtSpec.specId, 10, 8)}`,
      `hash: ${shortHex(activeThoughtSpec.specHash, 10, 8)}`,
      `bytes: ${activeThoughtSpec.byteLength}`,
      `source: ${activeThoughtSpec.pointer}`,
    ] : []),
    "use: spec text",
    "use: THOUGHT.md text",
  ]);
};

const outputCliColorFont = async (topic: string) => {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!normalizedTopic) {
    const opened = window.open(COLOR_FONT_CANONICAL_URL, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
    appendCliOutput([
      "opening Color Font v1.",
      "source: inshell.art/color-font.",
      opened ? "" : `open: ${COLOR_FONT_CANONICAL_URL}`,
    ].filter(Boolean));
    return;
  }

  await openColorFontDocument({
    appendCliResult: true,
    raw: normalizedTopic === "raw" || normalizedTopic === "text" || normalizedTopic === "show",
  });
};

const formatMintedThoughtLine = (thought: GalleryThought) => {
  const title = thoughtProtocolText(thought.rawText, IS_LOCAL_THOUGHT_V2) || "UNTITLED";
  return `#${thought.tokenId} ${quoteCliText(title, 40)} $PATH #${thought.pathId}`;
};

const outputCliThoughtWorks = async (topic: string) => {
  const normalizedTopic = topic.trim().toLowerCase();
  if (normalizedTopic && normalizedTopic !== "list") {
    appendCliError(["thought option not found.", "use: thought", "use: thought list"]);
    return;
  }

  try {
    const thoughts = await readGalleryThoughts();
    if (!thoughts) {
      appendCliError(["THOUGHT works unavailable.", "use: gallery"]);
      return;
    }

    if (!thoughts.length) {
      appendCliOutput([
        "minted THOUGHTs.",
        "kept on-chain.",
        "empty.",
        "use: mint",
        "use: gallery",
      ]);
      return;
    }

    appendCliOutput([
      "minted THOUGHTs.",
      "kept on-chain.",
      ...thoughts.map(formatMintedThoughtLine),
      "",
      "use: gallery",
      "use: view THOUGHT <id>",
    ]);
  } catch {
    appendCliError(["failed to read THOUGHT works.", "use: gallery"]);
  }
};

const formatWorkLine = (work: ThoughtWorkRecord) =>
  `#${work.id} "${formatModelLabel(work.text || work.title, 48)}"`;

const workText = (work: ThoughtWorkRecord) =>
  thoughtProtocolText(work.text || work.title, IS_LOCAL_THOUGHT_V2);

const workPrompt = (work: ThoughtWorkRecord) => work.prompt || work.runContext.prompt;

const workReturnedText = (work: ThoughtWorkRecord) =>
  work.returnedText || work.runContext.returnedText || work.rawOutput;

const workSpecRef = (work: ThoughtWorkRecord) =>
  work.thoughtSpec?.ref || work.runContext.thoughtSpec?.ref || currentSpecLabel();

const workProvenanceBytes = (work: ThoughtWorkRecord) => {
  if (typeof work.provenanceBytes === "number") {
    return work.provenanceBytes;
  }
  if (work.provenanceJson) {
    return byteLength(work.provenanceJson);
  }
  const current = work.id === currentWorkId ? getProvenanceSummary() : null;
  return current?.bytes ?? null;
};

const workDetailLines = (work: ThoughtWorkRecord) => {
  const text = workText(work);
  const returnedText = workReturnedText(work);
  const prompt = workPrompt(work);
  const provenanceBytes = workProvenanceBytes(work);
  return [
    `work #${work.id} loaded.`,
    "",
    "prompt:",
    prompt ? quoteCliFullText(prompt) : "unavailable",
    "",
    "model return:",
    formatCliModelReturnValue(returnedText, text),
    "",
    "text:",
    quoteCliFullText(text),
    "",
    `route: ${work.route || work.runContext.mode}`,
    `model: ${work.model || work.runContext.model}`,
    `spec: ${workSpecRef(work)}`,
    `normalizer: ${work.normalizer?.id ?? "thought.normalize.v1"}`,
    provenanceBytes === null ? "provenance: unavailable" : formatProvenanceBytes(provenanceBytes),
    "",
    "use: mint",
    "use: provenance",
  ];
};

const currentWorkRecord = (): ThoughtWorkRecord | null => {
  if (currentWorkId !== null) {
    const stored = getWorkById(readStoredThoughtWorks(), currentWorkId);
    if (stored) {
      return stored;
    }
  }
  if (!currentOutputText || !currentRunContext) {
    return null;
  }

  const provenance = getProvenanceSummary();
  return {
    id: currentWorkId ?? 0,
    prompt: currentRunContext.prompt,
    returnedText: currentRunContext.returnedText ?? "",
    text: currentOutputText,
    title: currentOutputText,
    rawOutput: currentRunContext.returnedText ?? "",
    image: currentWorkSvg ? svgToImageUri(currentWorkSvg) : galleryThumbnailUri(currentOutputText),
    svg: currentWorkSvg,
    route: currentRunContext.mode,
    provider: currentRunContext.provider,
    model: currentRunContext.model,
    thoughtSpec: currentRunContext.thoughtSpec,
    normalizer: {
      id: "contract-preview",
      source: "ThoughtNFT.previewWork",
    },
    previewProvider: currentRunContext.previewProvider,
    provenanceJson: provenance?.json,
    provenanceBytes: provenance?.bytes,
    hashes: {
      promptHash: hashText(currentRunContext.prompt),
      returnedTextHash: hashText(currentRunContext.returnedText ?? ""),
      textHash: hashText(currentOutputText),
    },
    runContext: currentRunContext,
    createdAt: currentRunContext.clientGeneratedAt,
  };
};

const outputCliWorkList = () => {
  const works = readStoredThoughtWorks();
  if (!works.length) {
    appendCliOutput(["generated works from run.", "empty.", "next: run"]);
    return;
  }

  appendCliOutput([
    "generated works from run.",
    ...works.map(formatWorkLine),
    "",
    "use: work <id>",
    "use: work current",
    "use: work clear",
    "use: work previous",
    "use: work next",
    "use: work latest",
  ]);
};

const outputCliWorkUsage = () => {
  const currentWork = currentWorkRecord();
  appendCliOutput([
    "work is generated by the selected model.",
    currentWork ? `current: #${currentWork.id} "${formatModelLabel(workText(currentWork), 48)}"` : "current: empty",
    "",
    "use: work current",
    "use: work list",
    "use: work clear",
    "use: work <id>",
    "use: work previous",
    "use: work next",
    "use: work latest",
  ]);
};

const clearWorkHistoryFromCli = () => {
  const count = readStoredThoughtWorks().length;
  writeStoredThoughtWorks([]);
  currentWorkId = null;
  writeCurrentOutputSession();
  appendCliOutput([
    count ? `cleared ${count} stored work${count === 1 ? "" : "s"}.` : "stored works already empty.",
    "current work unchanged.",
    "use: reset",
    "use: run",
  ]);
};

const loadWorkFromCli = (input: string) => {
  const normalized = input.trim();
  if (!normalized || normalized.toLowerCase() === "help") {
    outputCliWorkUsage();
    return;
  }

  if (normalized.toLowerCase() === "clear") {
    clearWorkHistoryFromCli();
    return;
  }

  if (normalized.toLowerCase() === "current") {
    const work = currentWorkRecord();
    if (!work) {
      appendCliError(["no current work.", "use: work list", "use: run"]);
      return;
    }
    appendCliOutput(workDetailLines(work));
    return;
  }

  if (normalized.toLowerCase() === "previous" || normalized.toLowerCase() === "prev") {
    loadPreviousWorkFromCli();
    return;
  }

  if (normalized.toLowerCase() === "next") {
    loadNextWorkFromCli();
    return;
  }

  if (normalized.toLowerCase() === "latest" || normalized.toLowerCase() === "last") {
    loadLatestWorkFromCli();
    return;
  }

  const id = parseWorkId(normalized);
  if (id === null) {
    appendCliError(["work id invalid.", "use: work <id>", "use: work list"]);
    return;
  }

  const work = getWorkById(readStoredThoughtWorks(), id);
  if (!work) {
    appendCliError([`work #${id} not found.`, "use: work list"]);
    return;
  }

  if (loadWorkRecord(work)) {
    appendCliOutput(workDetailLines(work));
  }
};

const loadPreviousWorkFromCli = () => {
  const work = getPreviousWork(readStoredThoughtWorks(), currentWorkId);
  if (!work) {
    appendCliError(currentWorkId ? ["no previous work.", "use: work list"] : ["no work found.", "next: run"]);
    return;
  }

  if (loadWorkRecord(work)) {
    appendCliOutput(workDetailLines(work));
  }
};

const loadNextWorkFromCli = () => {
  const work = getNextWork(readStoredThoughtWorks(), currentWorkId);
  if (!work) {
    appendCliError(currentWorkId ? ["no next work.", "use: work list"] : ["no work found.", "next: run"]);
    return;
  }

  if (loadWorkRecord(work)) {
    appendCliOutput(workDetailLines(work));
  }
};

const loadLatestWorkFromCli = () => {
  const work = getLatestWork(readStoredThoughtWorks());
  if (!work) {
    appendCliError(["no work found.", "next: run"]);
    return;
  }

  if (loadWorkRecord(work)) {
    appendCliOutput(workDetailLines(work));
  }
};

const myBrainRunPendingLines = () => [
  "running...",
  "one model round.",
  "prompt + THOUGHT.md in.",
  "waiting for model return...",
  "entering my-brain...",
  "",
  "my-brain.",
  "you are the model for this round.",
  "return one text artifact only.",
  "",
  "use: return <text>",
  "use: cancel",
];

const buildMyBrainRunPayload = async (): Promise<PendingMyBrainRound> => {
  const prompt = protocolLineInput(sessionState.prompt);
  if (!prompt.trim()) {
    throw new Error("prompt empty.");
  }

  await ensureActiveThoughtSpec({ force: true });
  syncThoughtInstructionsControls();
  const payload = buildCurrentThoughtRunPayload(prompt, MY_BRAIN_MODEL);
  return {
    route: MY_BRAIN_MODE,
    provider: MY_BRAIN_PROVIDER,
    model: MY_BRAIN_MODEL,
    prompt,
    thoughtSpecId: payload.input.thoughtSpec.id,
    thoughtSpecRef: payload.input.thoughtSpec.ref,
    thoughtSpecHash: payload.input.thoughtSpec.hash,
    startedAt: new Date().toISOString(),
    payload,
  };
};

const startMyBrainRunFromCli = async () => {
  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  try {
    pendingMyBrainRunPayload = await buildMyBrainRunPayload();
    runState = "running";
    runInFlight = false;
    syncInterface();
    appendCliOutput(myBrainRunPendingLines());
  } catch (error) {
    runState = "run_failed";
    const message = formatThoughtSpecError(error);
    appendCliError([
      "run failed.",
      message,
      message === "prompt empty." ? "next: prompt <text>" : "use: THOUGHT.md",
    ]);
  }
};

const cliWorkReadyLines = () => {
  const provenance = getProvenanceSummary();
  const text = currentOutputText || "";
  const returnedText = currentRunContext?.returnedText ?? "";
  if (provenance && provenance.bytes > MAX_PROVENANCE_BYTES) {
    return provenanceTooLargeLines(provenance.bytes, "work");
  }
  return [
    currentWorkId ? `work #${currentWorkId} is done.` : "work is done.",
    `text: ${quoteCliFullText(text)}`,
    `model return: ${formatCliModelReturnValue(returnedText, text)}`,
    provenance ? `provenance: ${provenance.bytes} bytes.` : "provenance ready.",
    "use: mint",
    "use: provenance",
    currentWorkId ? `use: work ${currentWorkId}` : "use: work current",
  ];
};

const returnMyBrainModelTextFromCli = async (returnInput: string) => {
  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  if (sessionState.mode !== MY_BRAIN_MODE) {
    appendCliError(["return unavailable.", `route: ${sessionState.mode}`, "use: config my-brain", "use: run"]);
    return;
  }

  const modelReturn = protocolLineInput(returnInput);
  if (!modelReturn.trim()) {
    appendCliError(["model return empty.", "use: return <text>", "use: cancel"]);
    return;
  }

  if (!pendingMyBrainRunPayload || runState !== "running") {
    appendCliError(["return unavailable.", "route: my-brain", "use: run"]);
    return;
  }

  if (mintFlowState !== "closed") {
    resetMintRuntimeState();
    syncInterface();
  }

  try {
    const payload = pendingMyBrainRunPayload.payload;
    appendCliOutput([
      "model return received.",
      "leaving my-brain...",
      "model return saved as candidate.",
      "rendering preview...",
    ]);
    const result = await completeThoughtRunFromModelReturn(payload, modelReturn);
    if (result.kind === "unavailable") {
      pendingMyBrainRunPayload = null;
      appendCliOutput(result.lines);
      return;
    }
    if (result.kind === "pending_mint") {
      pendingMyBrainRunPayload = null;
      blockPendingMintMutation({ cli: true });
      return;
    }
    pendingMyBrainRunPayload = null;
    appendCliOutput(["preview accepted.", "current work set.", "", ...cliWorkReadyLines()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "model return failed.";
    if (/provenance too large/i.test(message)) {
      appendCliError(["work blocked.", "provenance too large.", "use: return <text>", "use: cancel"]);
    } else if (isContractWorkPreviewError(error)) {
      appendCliError(error.cliLines ?? ["model return rejected.", message, "use: return <text>", "use: cancel"]);
    } else {
      appendCliError(["model return rejected.", message, "use: return <text>", "use: cancel"]);
    }
  } finally {
    runInFlight = false;
    syncInterface();
  }
};

const cancelMyBrainRunFromCli = () => {
  if (!isMyBrainShellActive()) {
    appendCliError(["cancel unavailable.", "use: run"]);
    return;
  }

  pendingMyBrainRunPayload = null;
  runState = "idle";
  runInFlight = false;
  syncInterface();
  appendCliOutput(["my-brain canceled.", "no work created.", "", "use: run"]);
};

const retryContractPreviewFromCli = async () => {
  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  let candidate = currentCandidate;
  if (!candidate && lastPreviewRetryContext) {
    candidate = createThoughtCandidate(
      lastPreviewRetryContext.payload,
      lastPreviewRetryContext.modelReturn,
    );
    currentCandidate = candidate;
    writeCurrentCandidateSession();
  }

  if (!candidate) {
    appendCliError(["preview retry unavailable.", "no saved model return.", "use: run"]);
    return;
  }

  appendCliOutput(["rendering preview..."]);

  try {
    const attempt = await attemptContractPreviewForCandidate(candidate, { manual: true });
    if (attempt.kind === "unavailable") {
      runState = "candidate_ready";
      lastRunErrorCliLines = attempt.lines;
      appendCliOutput(attempt.lines);
      return;
    }
    if (attempt.kind === "rejected") {
      throw attempt.error;
    }
    if (!promotePreviewedCandidateToWork(candidate, attempt.preview, attempt.trace)) {
      return;
    }
    const lines = cliWorkReadyLines();
    if (lines[0] === "work blocked.") {
      appendCliError(lines);
      return;
    }
    appendCliOutput(["preview accepted.", "current work set.", "", ...lines]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "preview unavailable.";
    if (isContractWorkPreviewError(error)) {
      appendCliError(error.cliLines ?? ["preview unavailable.", "use: preview retry"]);
    } else {
      appendCliError(["preview unavailable.", message, "use: preview retry"]);
    }
  }
};

const appendCliRunCompletionLines = () => {
  if (runState === "output_ready") {
    const lines = cliWorkReadyLines();
    if (lines[0] === "work blocked.") {
      appendCliError(lines);
      return;
    }
    appendCliOutput(lines);
    return;
  }

  if (runState === "candidate_ready") {
    appendCliOutput(
      lastRunErrorCliLines.length
        ? lastRunErrorCliLines
        : previewUnavailableLines(),
    );
    return;
  }

  appendCliError(
    lastRunErrorCliLines.length
      ? lastRunErrorCliLines
      : panelWarningMessage
        ? ["run failed.", panelWarningMessage, "use: retry run"]
        : ["run failed."],
  );
};

const startPendingThoughtAgentCliProgress = () => {
  const lastEntry = cliEntries[cliEntries.length - 1];
  if (isCliRunningEntry(lastEntry)) {
    startCliProgress(lastEntry, [
      "resuming THOUGHT Bridge run.",
      "waiting for model return.",
    ]);
    return;
  }

  startCliRunProgress();
};

const resumePendingThoughtAgentRun = () => {
  const pendingRun = readPendingThoughtAgentRun();
  if (!pendingRun) {
    return false;
  }

  const runSessionId = startRunSession();
  lastRunErrorCliLines = [];
  lastPreviewRetryContext = null;
  runState = "running";
  runInFlight = true;
  setWarning("");
  setStatus(`resuming THOUGHT Bridge ${pendingRun.runId}...`);
  startPendingThoughtAgentCliProgress();
  syncInterface();

  void (async () => {
    try {
      const returned = await pollThoughtAgentRun({
        statusUrl: pendingRun.statusUrl,
        browserToken: pendingRun.browserToken,
        runId: pendingRun.runId,
      });
      if (!isCurrentRunSession(runSessionId)) {
        return;
      }

      clearPendingThoughtAgentRun(pendingRun.runId);
      appendCliOutput([
        "model return received.",
        "model return saved as candidate.",
        "rendering preview...",
      ]);
      await completeThoughtRunFromModelReturn(
        pendingRun.payload,
        returned.agentLine,
        returned.agentEvidence,
      );
      if (!isCurrentRunSession(runSessionId)) {
        return;
      }
      appendCliRunCompletionLines();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent request failed.";
      const shouldKeepPendingRun = pageUnloading && message === "refresh stopped the request.";
      if (!shouldKeepPendingRun) {
        clearPendingThoughtAgentRun(pendingRun.runId);
      }
      if (!isCurrentRunSession(runSessionId) || shouldKeepPendingRun) {
        return;
      }

      runState = "run_failed";
      lastRunErrorCliLines = isContractWorkPreviewError(error)
        ? error.cliLines ?? ["run failed.", message, "use: retry run"]
        : ["run failed.", message, "", "use: retry run"];
      setWarning(lastRunErrorCliLines[0] ?? message);
      setStatus("");
      appendCliError(lastRunErrorCliLines);
    } finally {
      if (isCurrentRunSession(runSessionId)) {
        stopCliProgress();
        runInFlight = false;
        syncInterface();
      }
    }
  })();

  return true;
};

const runFromCli = async () => {
  if (blockPendingMintMutation({ cli: true })) {
    return;
  }
  if (!isRouteConfigured()) {
    appendCliError(["run failed.", ...routeRequiredLines()]);
    return;
  }

  if (!sessionState.prompt.trim()) {
    appendCliError(["run failed.", "prompt empty.", "next: prompt <text>"]);
    return;
  }

  if (!getCurrentModelValue().trim()) {
    appendCliError(["run failed.", "model empty.", `use: ${configModelCommandPrefix()} list`]);
    return;
  }

  if (sessionState.mode === "connect" && !sessionState.connect.apiKey.trim()) {
    appendCliError(["run failed.", "openrouter not linked.", "use: config connect authorize"]);
    return;
  }

  if (sessionState.mode === "direct" && !getDirectApiKey()) {
    appendCliError(["run failed.", "api key not set.", "use: config direct key <api-key>"]);
    return;
  }

  if (sessionState.mode === "local") {
    await refreshCurrentModels({ silent: true });
    if (sessionState.local.available === false) {
      appendCliError(["run failed.", "ollama not detected."]);
      appendCliOutput(localSetupUsageLines());
      return;
    }
  }

  if (sessionState.mode === MY_BRAIN_MODE) {
    await startMyBrainRunFromCli();
    return;
  }

  if (mintFlowState !== "closed") {
    resetMintRuntimeState();
    syncInterface();
  }

  startCliRunProgress();
  try {
    await runAgent({ forceGenerate: true, cli: true });
  } finally {
    stopCliProgress();
  }

  if (pageUnloading) {
    return;
  }

  appendCliRunCompletionLines();
};

const switchMintFlowToCli = () => {
  if (mintFlowUiMode === "cli") {
    return;
  }

  mintFlowUiMode = "cli";
  syncInterface();
};

const selectedCliPathId = () =>
  mintFlowData.pathId?.toString() ?? mintFlowData.pathIdInput.trim();

const hasPendingMintTransaction = () =>
  mintFlowState === "minting" ||
  walletState.txState === "awaiting_signature" ||
  walletState.txState === "submitted";

const cliWrongNetworkLines = () => [
  "wrong network.",
  PUBLIC_NETWORK_CONFIG.switchNetworkNotice,
  "",
  ...cliNetworkReviewRows(),
  "",
  "use: wallet switch",
  "use: path <id>",
];

const cliReviewRow = (label: string, value: string) => `${label.padEnd(14)}${value}`;

const cliReviewContract = (name: string, address: string) =>
  address ? `${name} ${shortHex(address, 6, 4)}` : `${name} unavailable`;

const formatCliLocalDateTime = (epochSeconds: bigint | null) => {
  if (epochSeconds === null) return "";
  const ms = Number(epochSeconds) * 1000;
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const cliAuthorizationExpiryLine = () => {
  const expiresAt = formatCliLocalDateTime(mintFlowData.deadline);
  return expiresAt ? cliReviewRow("expires at", expiresAt) : "";
};

const cliAuthorizedLines = (pathId: string) => [
  `$PATH #${pathId || "?"} authorized for this THOUGHT.`,
  cliAuthorizationExpiryLine(),
  "use: confirm",
].filter(Boolean);

const cliVerifyLines = () => [
  `verify ${SURFACE_TERMINOLOGY.ecosystem}.`,
  "",
  "official dapps:",
  `${SURFACE_TERMINOLOGY.pathDapp.padEnd(8)}${contractStatusValue("domains", "path-domain")}`,
  `${SURFACE_TERMINOLOGY.thoughtDapp.padEnd(8)}${contractStatusValue("domains", "thought-domain")}`,
  "",
  "deployment manifest:",
  cliReviewRow("network", THOUGHT_ENVIRONMENT_LABEL),
  cliReviewRow("chain", THOUGHT_CHAIN_NAME),
  cliReviewRow("chain id", String(THOUGHT_CHAIN_ID)),
  cliReviewRow("currency", THOUGHT_CURRENCY_LABEL),
  "",
  "contracts:",
  `PathNFT       ${contractStatusValue("contracts", "path-nft")}`,
  `ThoughtNFT    ${contractStatusValue("contracts", "thought-nft")}`,
  `PulseAuction  ${contractStatusValue("contracts", "pulse-auction")}`,
  "",
  "THOUGHT spec:",
  `name  ${contractStatusValue("thought-spec", "thought-spec-name")}`,
  `id    ${contractStatusValue("thought-spec", "thought-spec-id")}`,
  `hash  ${contractStatusValue("thought-spec", "thought-spec-hash")}`,
  "",
  "color font:",
  `authority    ${contractStatusValue("color-font", "color-font-authority")}`,
  `loaded from  ${contractStatusValue("color-font", "color-font-loaded-from")}`,
  `hash         ${contractStatusValue("color-font", "color-font-hash")}`,
  "",
  "wallet actions:",
  "connect wallet reads selected address and public ownership state.",
  `mint ${SURFACE_TERMINOLOGY.thoughtToken} submits a wallet-confirmed transaction using picked ${SURFACE_TERMINOLOGY.pathToken}.`,
  "funds or tokens move only after wallet transaction confirmation.",
  "",
  `open: ${PATH_VERIFY_CONTRACTS_URL}`,
];

const cliWalletConnectVerifyLines = () => [
  "connect wallet.",
  "",
  cliReviewRow("domain", contractStatusValue("domains", "thought-domain")),
  ...cliNetworkReviewRows(),
  cliReviewRow("action", "connect wallet"),
  "",
  "address read only.",
  "no signature.",
  "no tx or approval.",
  "",
  CLI_VERIFY_CONTRACTS_LINK_LABEL,
];

const cliPathRecoveryErrorLines = (fallbackPathId = "") => {
  const pathId = selectedCliPathId() || fallbackPathId.trim();
  const useLines = ["use: path <id>", "need $PATH: mint-path"];

  if (mintFlowData.errorKind === "wrong_network") {
    return cliWrongNetworkLines();
  }
  if (mintFlowData.errorKind === "path_not_found") {
    return [pathId ? `wallet does not hold $PATH #${pathId}.` : "wallet does not hold this $PATH.", ...useLines];
  }
  if (mintFlowData.errorKind === "path_consumed") {
    return [
      pathId ? `$PATH #${pathId} has no THOUGHT mint available.` : "$PATH has no THOUGHT mint available.",
      ...useLines,
    ];
  }
  if (mintFlowData.errorKind === "path_not_ready") {
    return [pathId ? `$PATH #${pathId} not ready for THOUGHT.` : "$PATH not ready for THOUGHT.", ...useLines];
  }
  if (mintFlowData.errorKind === "path_unknown") {
    return [
      pathId ? `$PATH #${pathId} status unknown.` : "$PATH status unknown.",
      "contract read failed.",
      ...useLines,
    ];
  }

  return [
    mintFlowData.error || (pathId ? `$PATH #${pathId} not available for THOUGHT.` : "$PATH not available for THOUGHT."),
    ...useLines,
  ];
};

const buildCliMintStateLines = () => {
  const pathId = selectedCliPathId();

  if (mintFlowState === "thought_checking") {
    return ["checking THOUGHT..."];
  }
  if (mintFlowState === "wallet_required") {
    return ["wallet not connected.", "use: wallet connect"];
  }
  if (mintFlowState === "path_required") {
    return [
      walletState.address ? `wallet: connected ${formatCliAddress(walletState.address)}` : "wallet: not connected",
      "pick $PATH.",
      "use: path <id>",
      "use: path list",
      "need $PATH: mint-path",
    ];
  }
  if (mintFlowState === "path_checking") {
    return [`checking $PATH #${pathId || "?"}...`];
  }
  if (mintFlowState === "path_ready") {
    return [`$PATH #${pathId || "?"} picked.`, "THOUGHT mint available.", "use: authorize"];
  }
  if (mintFlowState === "authorizing") {
    return ["wallet authorization pending..."];
  }
  if (mintFlowState === "authorized") {
    return cliAuthorizedLines(pathId);
  }
  if (mintFlowState === "minting") {
    return ["confirming mint..."];
  }
  if (mintFlowState === "minted") {
    return [
      "minted.",
      pathId ? `$PATH #${pathId} THOUGHT mint used.` : "",
      "use: view tx",
      viewThoughtUseLine(walletState.mintedTokenId),
    ].filter(Boolean);
  }
  if (mintFlowState === "text_taken") {
    const token = mintFlowData.existingTokenId;
    const identity = IS_LOCAL_THOUGHT_V2 ? "Agent line" : "text";
    return [
      "already minted.",
      token ? `this exact ${identity} is already THOUGHT #${token}.` : `this exact ${identity} is already a THOUGHT.`,
      `the same ${identity} cannot be minted twice.`,
      "$PATH permission is only requested for a new THOUGHT.",
      "",
      viewThoughtUseLine(token),
      "",
      "to mint another:",
      "change the input or choose another work.",
      "use: prompt <text>",
      "use: config",
      "use: work list",
    ];
  }
  if (mintFlowState === "error") {
    if (mintFlowData.error.includes("provenance too large")) {
      return provenanceTooLargeLinesFromMessage(mintFlowData.error);
    }
    if (isPathRecoveryError()) {
      return cliPathRecoveryErrorLines(pathId);
    }
    return [mintFlowData.error || "mint unavailable.", "use: current"];
  }

  return [];
};

const appendCliMintState = () => {
  const lines = buildCliMintStateLines();
  if (!lines.length) {
    return;
  }

  if (mintFlowState === "error") {
    appendCliError(lines);
    return;
  }

  appendCliOutput(lines, mintFlowState === "text_taken" ? { preserveSpacing: true } : undefined);
};

const startCliMint = async () => {
  if (currentCandidate && runState === "candidate_ready") {
    appendCliError([
      "current candidate is not previewed.",
      "use: preview retry",
    ]);
    return;
  }

  if (!currentOutputText) {
    if (currentCandidate) {
      appendCliError([
        "current candidate is not previewed.",
        "use: preview retry",
      ]);
      return;
    }
    appendCliError(["no work to mint.", "use: run"]);
    return;
  }

  if (!hasCurrentContractWorkSvg()) {
    appendCliError([
      "current candidate is not previewed.",
      "use: preview retry",
    ]);
    return;
  }

  appendCliOutput([
    "mint THOUGHT.",
    "keeps current work on-chain.",
    "one THOUGHT needs one usable $PATH.",
    "pick $PATH / authorize / confirm.",
  ]);
  await withCliLoading("loading...", () => openMintFlow("cli"), MINT_PREP_LOADING_DETAILS);
  appendCliMintState();
};

const ensureCliMintFlow = async () => {
  if (mintFlowState !== "closed") {
    switchMintFlowToCli();
    return true;
  }

  if (currentCandidate && runState === "candidate_ready") {
    appendCliError([
      "current candidate is not previewed.",
      "use: preview retry",
    ]);
    return false;
  }

  if (!currentOutputText) {
    if (currentCandidate) {
      appendCliError([
        "current candidate is not previewed.",
        "use: preview retry",
      ]);
      return false;
    }
    appendCliError(["no work to mint.", "use: run"]);
    return false;
  }

  if (!hasCurrentContractWorkSvg()) {
    appendCliError([
      "current candidate is not previewed.",
      "use: preview retry",
    ]);
    return false;
  }

  await openMintFlow("cli");
  return mintFlowState !== "closed";
};

const cliPathHelpLines = () => {
  const currentPath = selectedCliPathId();
  return [
    "$PATH is mint permission.",
    "",
    "one THOUGHT needs one usable $PATH.",
    "pick $PATH / authorize / confirm.",
    "",
    `current: ${currentPath ? `#${currentPath}` : "not picked"}`,
    "",
    "use:",
    "path list",
    "path <id>",
    "need $PATH: mint-path",
  ];
};

const cliPathAvailability = async (
  pathNft: Contract,
  pathId: bigint,
  authorizedMinter: string,
  movementQuota: bigint,
) => {
  if (authorizedMinter.toLowerCase() !== THOUGHT_NFT_ADDRESS.toLowerCase() || movementQuota === 0n) {
    return "not ready";
  }

  try {
    const [stage, stageMinted] = await Promise.all([
      pathNft.getStage(pathId) as Promise<bigint>,
      pathNft.getStageMinted(pathId) as Promise<bigint>,
    ]);
    return stage !== 0n || stageMinted >= movementQuota ? "consumed" : "available";
  } catch {
    return "unknown";
  }
};

const fetchPathTransferLogsForWallet = async (provider: JsonRpcProvider, walletTopic: string) => {
  const latestBlock = await provider.getBlockNumber();
  const fromStart = Math.min(Math.max(0, PATH_NFT_DEPLOY_BLOCK), latestBlock);
  const logsByKey = new Map<string, Log>();

  for (let fromBlock = fromStart; fromBlock <= latestBlock; fromBlock += PATH_LOG_CHUNK_SIZE) {
    const toBlock = Math.min(latestBlock, fromBlock + PATH_LOG_CHUNK_SIZE - 1);
    const [incomingLogs, outgoingLogs] = await Promise.all([
      provider.getLogs({
        address: PATH_NFT_ADDRESS,
        fromBlock,
        toBlock,
        topics: [ERC721_TRANSFER_TOPIC, null, walletTopic],
      }),
      provider.getLogs({
        address: PATH_NFT_ADDRESS,
        fromBlock,
        toBlock,
        topics: [ERC721_TRANSFER_TOPIC, walletTopic],
      }),
    ]);

    for (const log of [...incomingLogs, ...outgoingLogs]) {
      logsByKey.set(`${log.transactionHash}:${log.index}`, log);
    }
  }

  return [...logsByKey.values()];
};

const pathTokenIdFromApiItem = (item: unknown) => {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  const rawTokenId = typeof record.tokenId === "string" ? record.tokenId : record.tokenIdLabel;
  if (typeof rawTokenId !== "string" || !/^\d+$/.test(rawTokenId)) {
    return null;
  }
  return BigInt(rawTokenId);
};

const fetchPathTokenIdsForWalletFromApi = async (walletAddress: string) => {
  const response = await fetch(new URL(PATH_TOKENS_API_URL, window.location.origin).toString(), {
    headers: { accept: "application/json" },
    cache: "default",
  });
  if (!response.ok) {
    throw new Error(`$PATH token API unavailable: ${response.status}`);
  }

  const payload = (await response.json()) as { items?: unknown };
  if (!Array.isArray(payload.items)) {
    throw new Error("$PATH token API returned invalid payload.");
  }

  const wallet = walletAddress.toLowerCase();
  const tokenIds = new Set<bigint>();
  for (const item of payload.items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const owner = (item as Record<string, unknown>).owner;
    if (typeof owner !== "string" || owner.toLowerCase() !== wallet) {
      continue;
    }
    const tokenId = pathTokenIdFromApiItem(item);
    if (tokenId !== null) {
      tokenIds.add(tokenId);
    }
  }
  return tokenIds;
};

const sortPathIds = (pathIds: Iterable<bigint>) =>
  [...pathIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const readWalletPathInventory = async (walletAddress: string): Promise<PathInventoryReadResult> => {
  if (IS_LOCAL_THOUGHT_V2) {
    try {
      await verifyLocalThoughtV2Deployment();
    } catch (error) {
      return {
        kind: "unavailable",
        message: error instanceof Error
          ? error.message
          : THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,
      };
    }
  }

  let candidateIds: Set<bigint> | null = null;
  if (THOUGHT_CHAIN_ID !== 31337) {
    try {
      candidateIds = await fetchPathTokenIdsForWalletFromApi(walletAddress);
    } catch {
      // Fall through to direct log reads when the chain-cache API is unavailable.
    }
  }

  const provider = getPathReadProvider();
  const pathNft = getReadPathNft();
  if ((!provider || !pathNft || !PATH_NFT_ADDRESS || !THOUGHT_NFT_ADDRESS) && candidateIds) {
    return {
      kind: "ok",
      items: sortPathIds(candidateIds).map((pathId) => ({ pathId, status: "unknown" })),
    };
  }

  if (!provider || !pathNft || !PATH_NFT_ADDRESS || !THOUGHT_NFT_ADDRESS) {
    return { kind: "unavailable", message: "path list unavailable." };
  }

  if (!candidateIds) {
    const walletTopic = indexedAddressTopic(walletAddress);
    const transferLogs = await fetchPathTransferLogsForWallet(provider, walletTopic);
    candidateIds = new Set<bigint>();
    for (const log of transferLogs) {
      const tokenId = transferLogTokenId(log.topics);
      if (tokenId !== null) {
        candidateIds.add(tokenId);
      }
    }
  }

  let authorizedMinter = "";
  let movementQuota = 0n;
  try {
    [authorizedMinter, movementQuota] = await Promise.all([
      pathNft.getAuthorizedMinter(PATH_MOVEMENT_THOUGHT) as Promise<string>,
      pathNft.getMovementQuota(PATH_MOVEMENT_THOUGHT) as Promise<bigint>,
    ]);
  } catch {
    if (IS_LOCAL_THOUGHT_V2) {
      return {
        kind: "unavailable",
        message: THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,
      };
    }
    // Keep listing owned IDs even when availability metadata cannot be read.
  }

  const wallet = walletAddress.toLowerCase();
  const items = (
    await Promise.all(
      sortPathIds(candidateIds).map(async (pathId) => {
        try {
          const owner = (await pathNft.ownerOf(pathId)) as string;
          if (owner.toLowerCase() !== wallet) {
            return null;
          }
          const status = authorizedMinter && movementQuota > 0n
            ? await cliPathAvailability(pathNft, pathId, authorizedMinter, movementQuota)
            : "unknown";
          return { pathId, status };
        } catch {
          return { pathId, status: "unknown" };
        }
      }),
    )
  ).filter((path): path is PathInventoryItem => path !== null);

  return { kind: "ok", items };
};

const appendCliPathInventory = (ownedPaths: Array<{ pathId: bigint; status: string }>) => {
  appendCliOutput([
    "wallet $PATH tokens for THOUGHT mint.",
    `wallet: ${formatCliAddress(walletState.address ?? "")}`,
    "",
    ...(ownedPaths.length
      ? ownedPaths.map(({ pathId, status }) => `#${pathId.toString()} ${status}`)
      : ["none found."]),
    "",
    "use: path <id>",
    "need $PATH: mint-path",
  ]);
};

const listCliPaths = async () => {
  await withCliLoading("loading...", async () => {
    await refreshWalletState();

    if (!walletState.address) {
      appendCliOutput([
        "wallet $PATH tokens for THOUGHT mint.",
        "",
        "wallet not connected.",
        "use: wallet connect",
      ]);
      return;
    }

    if (walletState.chainId !== THOUGHT_CHAIN_ID) {
      appendCliError(["wallet $PATH tokens for THOUGHT mint.", "", ...cliWrongNetworkLines()]);
      return;
    }

    try {
      const inventory = await readWalletPathInventory(walletState.address);
      if (inventory.kind === "unavailable") {
        appendCliOutput([
          "wallet $PATH tokens for THOUGHT mint.",
          "",
          inventory.message,
          "need $PATH: mint-path",
        ]);
        return;
      }

      appendCliPathInventory(inventory.items);
    } catch {
      appendCliOutput([
        "wallet $PATH tokens for THOUGHT mint.",
        "",
        "path list unavailable.",
        "use: path <id>",
        "need $PATH: mint-path",
      ]);
    }
  }, PATH_LIST_LOADING_DETAILS);
};

const checkCliPath = async (pathInput: string) => {
  const trimmed = pathInput.trim();
  if (!trimmed) {
    appendCliOutput(cliPathHelpLines());
    return;
  }

  if (trimmed.toLowerCase() === "list") {
    await listCliPaths();
    return;
  }

  if (hasPendingMintTransaction()) {
    appendCliError(["mint already pending.", "use: view tx", "use: current"]);
    return;
  }

  let mintFlowReady = false;
  await withCliLoading("loading...", async () => {
    mintFlowReady = await ensureCliMintFlow();
    if (!mintFlowReady) {
      return;
    }

    mintFlowData.pathIdInput = trimmed;
    mintFlowData.pathId = parsePathTokenId(pathInput);
    await checkPathEligibility();
  }, [
    `reading from chain: checking $PATH #${trimmed} for THOUGHT mint`,
    ...PATH_CHECK_LOADING_DETAILS,
  ]);

  if (!mintFlowReady) {
    return;
  }

  if (mintFlowState === "path_ready") {
    appendCliOutput([
      `$PATH #${mintFlowData.pathId?.toString() ?? trimmed} picked.`,
      "THOUGHT mint available.",
      "use: authorize",
    ]);
  } else if (mintFlowState === "wallet_required") {
    appendCliError(["wallet not connected.", "use: wallet connect"]);
  } else if (mintFlowState === "error") {
    if (mintFlowData.error.includes("provenance too large")) {
      appendCliError(provenanceTooLargeLinesFromMessage(mintFlowData.error));
      return;
    }
    appendCliError(cliPathRecoveryErrorLines(trimmed));
  }
};

const authorizeFromCli = async () => {
  if (!await ensureCliMintFlow()) {
    return;
  }

  if (mintFlowState !== "path_ready") {
    const pathId = selectedCliPathId();
    appendCliError(
      mintFlowState === "authorized"
        ? cliAuthorizedLines(pathId)
        : ["not ready.", "use: path <id>"],
    );
    return;
  }

  const pathId = selectedCliPathId() || "?";
  appendCliOutput([
    "authorize $PATH for THOUGHT.",
    "review before opening your wallet.",
    "",
    ...cliNetworkReviewRows(),
    cliReviewRow("$PATH", `#${pathId}`),
    cliReviewRow("contract", cliReviewContract("PathNFT", PATH_NFT_ADDRESS)),
    cliReviewRow("signature", "$PATH consume authorization"),
    cliReviewRow("executor", cliReviewContract("ThoughtNFT", THOUGHT_NFT_ADDRESS)),
    cliReviewRow("ETH sent", "0 ETH"),
    cliReviewRow("network gas", "none"),
    cliReviewRow("expires", `${Math.floor(Number(PATH_CONSUME_AUTH_TTL_SECONDS) / 3600)} hour`),
    "",
    "wallet signs next. does not mint.",
    CLI_VERIFY_CONTRACTS_LINK_LABEL,
  ], { preserveSpacing: true });
  await authorizeMint();
  stopCliProgress();
  const state = mintFlowState as MintFlowState;
  if (state === "authorized") {
    appendCliOutput(cliAuthorizedLines(pathId));
  } else if (state === "error") {
    if (mintFlowData.error.includes("provenance too large")) {
      appendCliError(provenanceTooLargeLinesFromMessage(mintFlowData.error));
      return;
    }
    appendCliError(isPathRecoveryError() ? cliPathRecoveryErrorLines(pathId) : [mintFlowData.error || "authorization failed.", "use: path <id>"]);
  }
};

const formatCliSpecLabel = (ref: string) => {
  const match = ref.match(/^THOUGHT\.v(.+)\.md$/i);
  return match ? `THOUGHT.md@v${match[1]}` : ref;
};

const cliConfirmPreviewLines = async () => {
  await rebuildFinalMintProvenance();
  const pathId = selectedCliPathId() || "?";
  const text = mintFlowData.rawText || currentOutputText;
  const prompt = currentRunContext?.prompt || sessionState.prompt;
  const returnedText = currentRunContext?.returnedText ?? "";
  const provenanceBytes = mintFlowData.provenanceJson ? byteLength(mintFlowData.provenanceJson) : null;
  const specLabel = activeThoughtSpec?.ref
    ? formatCliSpecLabel(activeThoughtSpec.ref)
    : shortHex(mintFlowData.thoughtSpecId || "", 10, 8) || "unknown";

  return [
    "confirm THOUGHT mint.",
    "review before opening your wallet.",
    "",
    ...cliNetworkReviewRows(),
    cliReviewRow("contract", cliReviewContract("ThoughtNFT", THOUGHT_NFT_ADDRESS)),
    cliReviewRow("function", "mint(string,uint256,bytes32,bytes32,bytes32,string,uint256,bytes)"),
    cliReviewRow("$PATH", `#${pathId}`),
    cliReviewRow("uses", "1 THOUGHT mint"),
    cliReviewRow("ETH sent", "0 ETH"),
    cliReviewRow("authorization", "$PATH signature attached"),
    cliReviewRow("network gas", "shown in wallet"),
    "",
    `work: ${quoteCliFullText(text)}`,
    `prompt: ${quoteCliFullText(prompt)}`,
    `model return: ${formatCliModelReturnValue(returnedText, text)}`,
    provenanceBytes === null ? "provenance: unknown" : formatProvenanceBytes(provenanceBytes),
    `spec: ${specLabel}`,
    "",
    "publishes prompt + model return + provenance.",
    "wallet opens next.",
    CLI_VERIFY_CONTRACTS_LINK_LABEL,
  ];
};

const confirmFromCli = async () => {
  if (!await ensureCliMintFlow()) {
    return;
  }

  if (mintFlowState !== "authorized") {
    appendCliError(["not authorized.", "use: authorize"]);
    return;
  }

  try {
    appendCliOutput(await cliConfirmPreviewLines(), { preserveSpacing: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "mint unavailable.";
    if (message.includes("provenance too large")) {
      appendCliError(provenanceTooLargeLinesFromMessage(message));
      return;
    }
    appendCliError([message, "use: current"]);
    return;
  }
  const txHash = await confirmMint({ appendCliResult: true });
  stopCliProgress();
  const state = mintFlowState as MintFlowState;
  if (!txHash && state === "error") {
    if (mintFlowData.error.includes("provenance too large")) {
      appendCliError(provenanceTooLargeLinesFromMessage(mintFlowData.error));
      return;
    }
    appendCliError([mintFlowData.error || "mint failed.", "use: current"]);
  }
};

const outputCliVerify = () => {
  appendCliOutput(cliVerifyLines(), { preserveSpacing: true });
};

const connectWalletFromCli = async () => {
  const mintFlowWasActive = mintFlowState !== "closed";
  if (mintFlowWasActive) {
    switchMintFlowToCli();
  }

  appendCliOutput(cliWalletConnectVerifyLines(), { preserveSpacing: true });
  appendCliOutput("connecting wallet...");
  await requestWalletConnect();
  stopCliProgress();

  if (mintFlowWasActive && mintFlowState === "wallet_required") {
    moveMintFlowToWalletOrPathSelection();
  }

  if (mintFlowState !== "closed") {
    switchMintFlowToCli();
    syncInterface();
    appendCliMintState();
    return;
  }

  appendCliOutput(walletState.address ? ["wallet connected.", "use: mint"] : ["wallet not connected.", "use: wallet connect"]);
};

const switchWalletFromCli = async () => {
  appendCliOutput([`switch wallet to ${THOUGHT_CHAIN_NAME}.`]);
  await switchWalletChain();
  stopCliProgress();
  appendCliOutput(
    walletState.chainId === THOUGHT_CHAIN_ID
      ? ["chain ready.", "use: path list"]
      : ["wrong network.", PUBLIC_NETWORK_CONFIG.switchNetworkNotice, "use: wallet switch"],
  );
};

const outputCliWalletUsage = () => {
  appendCliOutput([
    "wallet handles $PATH and mint.",
    `wallet: ${walletState.address ? `connected ${formatCliAddress(walletState.address)}` : "not connected"}`,
    `network: ${getWalletNetworkLabel()}${walletState.chainId === THOUGHT_CHAIN_ID ? "" : `, expected ${THOUGHT_CHAIN_NAME}`}`,
    "use: wallet connect",
    "use: wallet switch",
    "clear: wallet disconnect",
  ]);
};

const disconnectWalletFromCli = () => {
  disconnectThoughtDockWallet({ appendCli: true });
};

const cliCommandsHelpLines = () => [
  "commands:",
  "config",
  "config route <local|connect|direct|my-brain|codex>",
  "config local",
  "config connect",
  "config direct",
  "config my-brain",
  "config codex",
  "config local detect",
  "config local endpoint <url>",
  "config local model list",
  "config local model <id>",
  "config connect authorize",
  "config connect disconnect",
  "config connect model list",
  "config connect model <id>",
  "config direct provider list",
  "config direct provider <id>",
  "config direct key <api-key>",
  "config direct key clear",
  "config direct model list",
  "config direct model <id>",
  "config preview auto|wallet|off",
  "open bridge",
  "install bridge",
  "",
  "prompt <text>",
  "prompt clear",
  "spec",
  "spec text",
  "THOUGHT.md",
  "THOUGHT.md text",
  "color-font",
  "color-font raw",
  "",
  "run",
  "rerun",
  "retry run",
  "preview",
  "preview retry",
  "work",
  "work current",
  "work list",
  "work clear",
  "work <id>",
  "work previous",
  "work next",
  "work latest",
  "works clear",
  "thought",
  "thought list",
  "",
  "mint",
  "wallet",
  "wallet connect",
  "wallet switch",
  "wallet disconnect",
  "path",
  "path list",
  "path <id>",
  "authorize",
  "confirm",
  "mint-path",
  "",
  "current",
  "verify",
  "provenance",
  "provenance --json",
  "gallery",
  "view tx",
  "view THOUGHT <id>",
  "clear",
  "reset",
  "help",
  "commands",
];

const cliHelpLines = (topic = "") => {
  const normalizedTopic = topic.trim().toLowerCase();

  if (!normalizedTopic) {
    return [
      "THOUGHT takes a prompt and THOUGHT.md,",
      "runs one model round,",
      "then renders the returned text to canvas.",
      "",
      "flow:",
      "config   choose route, provider, model",
      "prompt   write intention",
      "run      one model round",
      "preview  validate candidate through contract",
      "mint     keep the work on-chain",
      "",
      "my-brain:",
      "return   enter the model return",
      "",
      "codex:",
      "run      opens THOUGHT Bridge",
      "open     shows how to open the bridge",
      "",
      "more:",
      "help flow",
      "commands",
      "current",
      "config",
      "prompt",
      "THOUGHT.md",
      "color-font",
      "work",
      "preview",
      "mint",
      "wallet",
      "verify",
      "$PATH",
      "provenance",
      "gallery",
      "my-brain",
      "codex",
      "clear",
      "reset",
    ];
  }

  if (normalizedTopic === "commands") {
    return cliCommandsHelpLines();
  }

  if (normalizedTopic === "verify") {
    return [
      "verify prints public launch facts.",
      "",
      "checks:",
      "official domains",
      "chain",
      "contracts",
      "THOUGHT spec",
      "color font",
      "wallet actions",
      "",
      "use: verify",
      `open: ${PATH_VERIFY_CONTRACTS_URL}`,
    ];
  }

  if (normalizedTopic === "flow") {
    return [
      "flow:",
      "",
      "1 config",
      "  choose how THOUGHT reaches a model.",
      "",
      "2 prompt",
      "  set the human intention.",
      "",
      "3 run",
      "  one model round.",
      "  prompt + THOUGHT.md in.",
      "  candidate out.",
      "",
      "4 preview",
      "  preview makes a mintable work.",
      "",
      "5 mint",
      "  one THOUGHT needs one $PATH.",
      "  pick $PATH / authorize / confirm.",
      "",
      "my-brain route:",
      "  return enters the model return.",
      "codex route:",
      "  THOUGHT Bridge runs Codex.",
    ];
  }

  if (normalizedTopic === "config") {
    return [
      "config sets route, provider, and model for one round.",
      "",
      "route is how THOUGHT reaches the model.",
      "model is the selected AI model.",
      "",
      "routes:",
      ...routeTableLines(),
      "",
      "use:",
      "config",
      "config route <local|connect|direct|my-brain|codex>",
      "config local",
      "config connect",
      "config direct",
      "config my-brain",
      "config codex",
      "config preview auto|wallet|off",
      "config local model list",
      "config connect model list",
      "config direct model list",
      "current",
    ];
  }

  if (normalizedTopic === "mode") {
    return ["use: config route <local|connect|direct|my-brain|codex>"];
  }

  if (normalizedTopic === "preview") {
    return [
      "preview validates and renders a candidate.",
      "auto uses the browser renderer.",
      "wallet uses ThoughtNFT.previewWork.",
      "",
      `mode: ${readPreviewMode()}`,
      `provider: ${cliPreviewProviderState()}`,
      `endpoint: ${cliPreviewEndpointState()}`,
      "",
      "use:",
      "preview retry",
      "config preview auto|wallet|off",
    ];
  }

  if (normalizedTopic === "model") {
    return [
      `model: ${getCurrentModelValue().trim() || "empty"}`,
      `use: ${configModelCommandPrefix()} list`,
      `use: ${configModelCommandPrefix()} <id>`,
    ];
  }

  if (normalizedTopic === "provider") {
    return [
      "provider selects the direct API provider.",
      "",
      `provider: ${sessionState.direct.provider}`,
      "route: direct",
      "",
      ...directProviderListLines(),
    ];
  }

  if (normalizedTopic === "prompt") {
    return [
      "prompt sets the user intention for one round.",
      "",
      "use:",
      "prompt <text>",
      "prompt clear",
      "",
      "flow:",
      "config",
      "prompt <text>",
      "run",
      "mint",
    ];
  }

  if (normalizedTopic === "thought") {
    return [
      "thought lists minted THOUGHTs.",
      "",
      "THOUGHT is a minted generated work.",
      "work is generated by the selected model.",
      "",
      "use:",
      "thought",
      "thought list",
      "gallery",
      "view THOUGHT <id>",
    ];
  }

  if (normalizedTopic === "thought.md" || normalizedTopic === "spec") {
    return [
      "THOUGHT.md is the generation spec.",
      "",
      "prompt + THOUGHT.md in.",
      "candidate out.",
      "",
      "use:",
      "spec",
      "spec text",
      "THOUGHT.md",
      "THOUGHT.md text",
    ];
  }

  if (normalizedTopic === "color-font" || normalizedTopic === "font") {
    return [
      "color-font opens the Color Font source of truth.",
      "",
      "source: inshell.art/color-font.",
      "format: LETTER:INDEX:ALIAS_TERM:HEX",
      "",
      "use:",
      "color-font",
      "color-font raw",
    ];
  }

  if (normalizedTopic === "run") {
    return [
      "run sends prompt + THOUGHT.md to the selected model.",
      "",
      "one model round.",
      "candidate out; preview makes work mintable.",
      "",
      "use:",
      "run",
      "rerun",
      "retry run",
      "preview retry",
    ];
  }

  if (normalizedTopic === "return" || normalizedTopic === "my-brain" || normalizedTopic === "mybrain") {
    return [
      "my-brain route.",
      MY_BRAIN_DESCRIPTION,
      "",
      "the prompt and THOUGHT.md enter the round.",
      "you become the model for that round.",
      "",
      "flow:",
      "config my-brain",
      "prompt <text>",
      "run",
      "return <text>",
      "mint",
    ];
  }

  if (normalizedTopic === "codex" || normalizedTopic === "agent" || normalizedTopic === "bridge") {
    return [
      "codex route.",
      CODEX_DESCRIPTION,
      "",
      "the prompt and THOUGHT.md enter the round.",
      "THOUGHT Bridge claims the run and returns one candidate.",
      "",
      "flow:",
      "config codex",
      "prompt <text>",
      "run",
      "open bridge",
      "retry run",
      "mint",
      "",
      "first time:",
      "open bridge",
      "install bridge",
      "",
      `api: ${THOUGHT_AGENT_API_BASE}`,
    ];
  }

  if (normalizedTopic === "works" || normalizedTopic === "work" || normalizedTopic === "output") {
    return [
      "work is generated by the selected model.",
      "",
      "each work stores the canvas text,",
      "contract SVG, and run context.",
      "",
      "use:",
      "work",
      "work current",
      "work list",
      "work clear",
      "work <id>",
      "work previous",
      "work next",
      "work latest",
    ];
  }

  if (normalizedTopic === "reset") {
    return [
      "reset clears the current work.",
      "",
      "clears canvas, prompt, mint state,",
      "and current output session.",
      "",
      "does not clear stored work history.",
      "",
      "use:",
      "reset",
      "work clear",
    ];
  }

  if (normalizedTopic === "clear") {
    return [
      "clear empties the console transcript.",
      "",
      "does not clear current work,",
      "stored work history, or wallet state.",
      "",
      "use:",
      "clear",
      "reset",
      "work clear",
    ];
  }

  if (normalizedTopic === "provenance") {
    return [
      "provenance records the run and mint context.",
      "",
      "prompt, model, THOUGHT.md,",
      "route, hashes, and mint context.",
      "",
      "it is a record, not proof.",
      "",
      "use:",
      "provenance",
      "provenance --json",
    ];
  }

  if (normalizedTopic === "mint") {
    return [
      "mint THOUGHT.",
      "keeps current work on-chain.",
      "one THOUGHT needs one $PATH.",
      "pick $PATH / authorize / confirm.",
      "",
      "use:",
      "mint",
      "path",
      "path list",
      "path <id>",
      "authorize",
      "confirm",
      "",
      "need $PATH:",
      "mint-path",
    ];
  }

  if (normalizedTopic === "path" || normalizedTopic === "$path") {
    return cliPathHelpLines();
  }

  if (normalizedTopic === "wallet") {
    return [
      "wallet signs $PATH and mint actions.",
      "",
      "connect it when you keep a THOUGHT.",
      "",
      "use:",
      "wallet connect",
      "wallet disconnect",
      "mint",
    ];
  }

  if (normalizedTopic === "gallery") {
    return [
      "gallery opens minted THOUGHTs.",
      "",
      "use:",
      "gallery",
      "view THOUGHT <id>",
      "thought",
    ];
  }

  if (normalizedTopic === "direct") {
    return [
      ROUTE_COPY.direct.brief,
      "",
      "never printed.",
      "not stored by THOUGHT.",
      "",
      "use:",
      "config direct",
      "config direct provider list",
      "config direct provider <id>",
      "config direct key <api-key>",
      "config direct key clear",
      "config direct model list",
      "config direct model <id>",
    ];
  }

  if (normalizedTopic === "connect") {
    return [
      ROUTE_COPY.connect.brief,
      "",
      "no raw key paste.",
      "revocable.",
      "",
      "use:",
      "config connect",
      "config connect authorize",
      "config connect disconnect",
      "config connect model list",
      "config connect model <id>",
    ];
  }

  if (normalizedTopic === "local") {
    return [
      ROUTE_COPY.local.brief,
      "",
      "detected from this browser.",
      `endpoint: ${getOllamaEndpoint()}`,
      "",
      "use:",
      "config local",
      "config local detect",
      "config local endpoint <url>",
      "config local model list",
      "config local model <id>",
      "run",
      "",
      "alternatives:",
      "config connect",
      "config direct",
      "config my-brain",
      "config codex",
    ];
  }

  return ["unknown help topic.", "use: help", "use: commands"];
};

const executeCliCommand = async (rawCommand: string) => {
  const command = rawCommand.trim();
  if (!command || cliCommandInFlight) {
    return;
  }

  recordCliCommandHistory(command);
  appendCliCommand(command);
  cliCommandInFlight = true;
  syncCliPanel();

  try {
    const parsedCommand = thoughtSurfaceShell.resolve(rawCommand);
    const rest = parsedCommand.rest;
    const protocolRest = IS_LOCAL_THOUGHT_V2 ? parsedCommand.rawRest : rest;
    const [second = ""] = parsedCommand.args;
    const lowerHead = parsedCommand.legacyHead;
    const lowerRest = rest.toLowerCase();
    cliSuggestionContext = "auto";

    if (lowerHead === "help") {
      appendCliOutput(cliHelpLines(lowerRest));
      cliSuggestionContext = "help";
    } else if (lowerHead === "commands") {
      if (isMyBrainShellActive()) {
        appendCliError(myBrainWaitingLines());
      } else {
        appendCliOutput(cliCommandsHelpLines());
        cliSuggestionContext = "help";
      }
    } else if (lowerHead === "current" || lowerHead === "status") {
      appendCliOutput(buildCliCurrentLines());
      cliSuggestionContext = "current";
    } else if (isMyBrainShellActive() && lowerHead !== "return" && lowerHead !== "cancel") {
      appendCliError(myBrainWaitingLines());
    } else if (lowerHead === "clear") {
      cliEntries.length = 0;
      writeCliTranscript();
      initializeCliTranscript();
    } else if (lowerHead === "reset") {
      if (resetThought()) {
        appendCliOutput(["reset current work, canvas, and mint state.", "next: prompt <text>"]);
      } else {
        blockPendingMintMutation({ cli: true });
      }
    } else if (lowerHead === "gallery") {
      if (hasPendingMintTransaction()) {
        appendCliOutput([
          "mint pending.",
          walletState.txState === "awaiting_signature" ? "confirm in wallet." : "waiting for chain confirmation...",
          walletState.txHash ? "use: view tx" : "wait for wallet.",
        ]);
        return;
      }

      appendCliOutput("opening gallery...");
      window.location.href = galleryUrl();
    } else if (lowerHead === "config") {
      await outputCliConfig(rest);
      cliSuggestionContext = "config";
    } else if (lowerHead === "mode") {
      if (!lowerRest || lowerRest === "help") {
        await outputCliMode("");
      } else {
        const mode = parseModeInput(rest);
        if (!mode) {
          appendCliError(["route not found.", "use: config route <local|connect|direct|my-brain|codex>"]);
        } else {
          await outputCliMode(mode);
        }
      }
    } else if (lowerHead === "my-brain" || lowerHead === "mybrain") {
      await outputCliMode(MY_BRAIN_MODE);
    } else if (lowerHead === CODEX_MODE || lowerHead === "agent" || lowerHead === "bridge") {
      await outputCliMode(CODEX_MODE);
    } else if (lowerHead === "open" && lowerRest === "bridge") {
      appendCliOutput(thoughtBridgeOpenLines());
    } else if (lowerHead === "install" && lowerRest === "bridge") {
      appendCliOutput(thoughtBridgeInstallLines());
    } else if (lowerHead === "return") {
      await returnMyBrainModelTextFromCli(protocolRest);
    } else if (lowerHead === "cancel") {
      cancelMyBrainRunFromCli();
    } else if (lowerHead === "connect" && (!rest || lowerRest === "openrouter")) {
      await startOpenRouterConnectFromCli();
    } else if (lowerHead === "disconnect" && (!rest || lowerRest === "openrouter")) {
      disconnectOpenRouter();
      appendCliOutput(["openrouter unlinked.", "use: config connect authorize"]);
    } else if (lowerHead === "provider") {
      setCliProvider(lowerRest);
    } else if (lowerHead === "key") {
      setCliApiKey(rest);
    } else if (lowerHead === "models") {
      await refreshCurrentModels({ silent: true });
      appendCliOutput(listModelsForCli());
    } else if (lowerHead === "model") {
      if (lowerRest === "list") {
        await refreshCurrentModels({ silent: true });
        appendCliOutput(listModelsForCli());
      } else {
        setCliModel(rest);
      }
    } else if (lowerHead === "prompt") {
      setCliPrompt(protocolRest);
    } else if (isThoughtInstructionsCommand(lowerHead)) {
      await outputCliThoughtInstructions(lowerRest);
    } else if (lowerHead === "color-font" || lowerHead === "font") {
      await outputCliColorFont(lowerRest);
    } else if (lowerHead === "verify") {
      outputCliVerify();
    } else if (lowerHead === "thought") {
      await outputCliThoughtWorks(lowerRest);
    } else if (lowerHead === "works") {
      if (lowerRest === "clear") {
        clearWorkHistoryFromCli();
      } else {
        outputCliWorkList();
      }
    } else if (lowerHead === "work" || lowerHead === "output") {
      if (lowerRest === "list") {
        outputCliWorkList();
      } else {
        loadWorkFromCli(rest);
      }
    } else if (lowerHead === "preview") {
      if (!lowerRest || lowerRest === "retry") {
        await retryContractPreviewFromCli();
      } else {
        appendCliOutput([
          "preview validates and renders the current candidate.",
          "auto uses the browser renderer.",
          "wallet uses ThoughtNFT.previewWork.",
          `mode: ${readPreviewMode()}`,
          `provider: ${cliPreviewProviderState()}`,
          `endpoint: ${cliPreviewEndpointState()}`,
          "",
          "use: preview retry",
          "use: config preview auto|wallet|off",
        ]);
      }
    } else if (lowerHead === "run" || lowerHead === "rerun" || command.toLowerCase() === "retry run") {
      if (command.toLowerCase() === "retry run" && lastRejectedRun) {
        appendCliOutput([
          "last run was rejected by the THOUGHT rules.",
          "retry may repeat the same failure unless prompt or config changes.",
        ]);
      }
      await runFromCli();
    } else if (lowerHead === "provenance") {
      await outputCliProvenance(lowerRest === "--json");
    } else if (lowerHead === "wallet") {
      if (lowerRest === "connect") {
        await connectWalletFromCli();
      } else if (lowerRest === "switch") {
        await switchWalletFromCli();
      } else if (lowerRest === "disconnect") {
        disconnectWalletFromCli();
      } else {
        outputCliWalletUsage();
      }
    } else if (lowerHead === "mint") {
      await startCliMint();
    } else if (lowerHead === "mint-path") {
      appendCliOutput("opening $PATH...");
      await handleMintPath({ submit: true });
    } else if (lowerHead === "path") {
      await checkCliPath(rest);
    } else if (lowerHead === "authorize") {
      await authorizeFromCli();
    } else if (lowerHead === "confirm") {
      await confirmFromCli();
    } else if (lowerHead === "view" && second.toLowerCase() === "tx") {
      appendCliOutput("opening tx...");
      const opened = await handleViewTx();
      if (!opened) {
        appendCliError(
          walletState.txHash || mintFlowData.txHash
            ? ["tx explorer unavailable. hash copied if clipboard allowed."]
            : ["tx unavailable.", "mint first."],
        );
      }
    } else if (lowerHead === "view" && second.toLowerCase() === "thought") {
      const tokenIdInput = command.split(/\s+/).slice(2).join(" ");
      const tokenId = tokenIdInput
        ? parseThoughtNFTIdInput(tokenIdInput)
        : (walletState.mintedTokenId ?? mintFlowData.existingTokenId);
      if (tokenIdInput && tokenId === null) {
        appendCliError(["THOUGHT id invalid.", "use: view THOUGHT <id>"]);
      } else if (tokenId === null || tokenId === undefined) {
        appendCliError(["THOUGHT id required.", "use: view THOUGHT <id>"]);
      } else {
        appendCliOutput(`opening THOUGHT #${tokenId}...`);
        await handleViewThought(tokenId);
      }
    } else {
      appendCliError(["unknown command.", "use: help"]);
    }
  } finally {
    stopCliProgress();
    cliCommandInFlight = false;
    syncInterface();
    focusCliInput();
  }
};

thoughtCliForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = thoughtCliInput.value;
  thoughtCliInput.value = "";
  resetCliInputNavigation();
  void executeCliCommand(command);
  focusCliInput();
});

thoughtCliInput.addEventListener("keydown", (event) => {
  if (
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "c" &&
    thoughtCliInput.value
  ) {
    event.preventDefault();
    thoughtCliInput.value = "";
    resetCliInputNavigation();
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    navigateCliInput("previous");
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    navigateCliInput("next");
  }
});

thoughtCliInput.addEventListener("input", () => {
  if (cliHistoryIndex !== null || cliCompletionIndex !== null) {
    resetCliInputNavigation();
  }
});

thoughtCliTranscript.addEventListener("scroll", () => {
  revealCliScrollbar();
});

frontpageShell.addEventListener("click", (event) => {
  if (IS_CLI_DEBUG && shouldRefocusCliFromClick(event.target)) {
    focusCliInput();
  }
});

document.addEventListener("click", (event) => {
  if (shouldRefocusThoughtDockFromClick(event.target)) {
    focusThoughtDockPrompt({ preventScroll: true });
  }
});

document.addEventListener("keydown", (event) => {
  if (IS_CLI_DEBUG && shouldRefocusCliFromKeyboard(event)) {
    focusCliInputFromKeyboard(event);
  }
});

modeConnectButton.addEventListener("click", () => {
  setMode("connect");
});

modeDirectButton.addEventListener("click", () => {
  setMode("direct");
});

modeLocalButton.addEventListener("click", () => {
  setMode("local");
});

modeCodexButton.addEventListener("click", () => {
  setMode(CODEX_MODE);
});

providerBox.addEventListener("change", () => {
  if (!isDirectProviderId(providerBox.value)) {
    return;
  }

  if (blockPendingMintMutation()) {
    providerBox.value = sessionState.direct.provider;
    return;
  }

  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.direct.provider = providerBox.value;
  sessionState.direct.model = DIRECT_PROVIDERS[providerBox.value].defaultModel;
  writeSessionState();
  syncInterface();
  void refreshCurrentModels({ silent: true });
  setWarning("");
  setStatus("");
});

apiKeyBox.addEventListener("input", () => {
  if (blockPendingMintMutation()) {
    apiKeyBox.value = getDirectApiKey();
    return;
  }
  pendingMyBrainRunPayload = null;
  setDirectApiKey(apiKeyBox.value);
  writeSessionState();
  setWarning("");
});

modelBox.addEventListener("change", () => {
  if (blockPendingMintMutation()) {
    syncModelControls();
    return;
  }
  syncManualModelField();
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;

  if (modelBox.value === MANUAL_MODEL_VALUE) {
    modelManualBox.focus();
  }

  setCurrentModelValue(getSelectedModelValue());
  modelBox.title = getSelectedModelValue();
  writeSessionState();
  setWarning("");
});

modelManualBox.addEventListener("input", () => {
  if (blockPendingMintMutation()) {
    modelManualBox.value = getCurrentModelValue();
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  setCurrentModelValue(modelManualBox.value.trim());
  modelManualBox.title = modelManualBox.value.trim();
  writeSessionState();
  setWarning("");
});

promptBox.addEventListener("input", () => {
  if (blockPendingMintMutation()) {
    promptBox.value = sessionState.prompt;
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.prompt = promptBox.value;
  writeSessionState();
  setWarning("");
});

thoughtDockPrompt.addEventListener("input", () => {
  if (blockPendingMintMutation()) {
    thoughtDockPrompt.value = sessionState.prompt;
    return;
  }
  resetMintRuntimeState();
  pendingMyBrainRunPayload = null;
  sessionState.prompt = thoughtDockPrompt.value;
  promptBox.value = thoughtDockPrompt.value;
  writeSessionState();
  setWarning("");
  if (!isThoughtDockRunningState(thoughtDockState)) {
    const prompt = thoughtDockPrompt.value;
    setThoughtDockState(prompt ? { kind: "ready", prompt } : { kind: "empty" });
  } else {
    syncThoughtDock();
  }
});

thoughtDockPrompt.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    openThoughtDockAgentSelect();
  }
});

thoughtDockWorksSelect.addEventListener("change", () => {
  const id = parseWorkId(thoughtDockWorksSelect.value);
  const work = id === null ? null : getWorkById(readStoredThoughtWorks(), id);
  if (!work || !loadWorkRecord(work)) {
    return;
  }
  emitThoughtConsoleEvent({
    kind: "work_loaded",
    title: "work loaded",
    detail: work.prompt || work.runContext.prompt,
    tone: "success",
    eventId: `work-loaded:${work.id}:${Date.now()}`,
  });
  syncInterface();
});

thoughtDockPathInventorySelect.addEventListener("change", () => {
  handlePathInventorySelectChange(thoughtDockPathInventorySelect);
});

promptBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    void runAgent();
  }
});

uploadThoughtFileButton.addEventListener("click", () => {
  thoughtFileInput.click();
});

thoughtFileInput.addEventListener("change", () => {
  void handleThoughtFileSelection();
});

clearThoughtFileButton.addEventListener("click", () => {
  setThoughtInstructionsOverride(null);
  setWarning("");
  setStatus(`using ${getActiveThoughtInstructionsLabel()}.`, { flashMs: NOTICE_FLASH_MS });
});

mintSheetClose.addEventListener("click", () => {
  closeMintSheet();
});

mintSheetBackdrop.addEventListener("click", () => {
  closeMintSheet();
});

mintSheetPathBox.addEventListener("input", () => {
  applyMintPathInputValue(mintSheetPathBox.value);
  syncInterface();
});

mintSheetPathSelect.addEventListener("change", () => {
  handlePathInventorySelectChange(mintSheetPathSelect);
});

mintSheetPathBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    void handleMintSheetAction(mintSheetPrimaryAction);
  }
});

mintSheetPrimary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetPrimaryAction);
});

mintSheetSecondary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetSecondaryAction);
});

mintSheetTertiary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetTertiaryAction);
});

thoughtDockPathPrimary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetPrimaryAction);
});

thoughtDockPathSecondary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetSecondaryAction);
});

thoughtDockPathTertiary.addEventListener("click", () => {
  void handleMintSheetAction(mintSheetTertiaryAction);
});

thoughtDebugToggle.addEventListener("click", () => {
  debugState.open = !debugState.open;
  syncDebugPanel();
});

thoughtDebugEnabled.addEventListener("change", () => {
  debugState.enabled = thoughtDebugEnabled.checked;
  syncInterface();
});

thoughtDebugReset.addEventListener("click", () => {
  debugState = { ...DEFAULT_DEBUG_STATE };
  syncInterface();
});

thoughtDebugCta.addEventListener("change", () => {
  debugState.cta = thoughtDebugCta.value as ThoughtDebugCtaOverride;
  debugState.ctaStatus = "auto";
  debugState.warning = "auto";
  syncInterface();
});

thoughtDebugCtaStatus.addEventListener("change", () => {
  debugState.ctaStatus = thoughtDebugCtaStatus.value as ThoughtDebugCtaStatusOverride;
  debugState.warning = "auto";
  syncInterface();
});

thoughtDebugWarning.addEventListener("change", () => {
  debugState.warning = thoughtDebugWarning.value as ThoughtDebugWarningOverride;
  syncInterface();
});

connectOpenRouterButton.addEventListener("click", () => {
  connectOpenRouterButton.disabled = true;
  setWarning("");
  setStatus("opening openrouter...");

  void startOpenRouterConnect().catch((error) => {
    const message = error instanceof Error ? error.message : "openrouter connect failed.";
    connectOpenRouterButton.disabled = false;
    setWarning(message);
    setStatus("failed.");
  });
});

disconnectOpenRouterButton.addEventListener("click", () => {
  disconnectOpenRouter();
});

runAgentButton.addEventListener("click", () => {
  void runAgent();
});

resetThoughtButton.addEventListener("click", () => {
  if (isDebugCtaOverrideActive()) {
    setStatus("debug action only.", { flashMs: NOTICE_FLASH_MS });
    return;
  }

  if (secondaryActionState === "reset") {
    resetThought();
    return;
  }

  if (secondaryActionState === "view_tx") {
    void handleViewTx();
    return;
  }

  if (secondaryActionState === "view_thought") {
    void handleViewThought(walletState.mintedTokenId);
  }
});

thoughtDetailViewTx.addEventListener("click", (event) => {
  if (!currentThoughtDetail) {
    event.preventDefault();
    return;
  }

  if (!THOUGHT_EXPLORER_BASE_URL) {
    event.preventDefault();
    void copyThoughtDetailValue(currentThoughtDetail.txHash);
  }
});

thoughtDetailPath.addEventListener("click", (event) => {
  if (!currentThoughtDetail) {
    event.preventDefault();
  }
});

thoughtDetailSpecRef.addEventListener("click", (event) => {
  if (!currentThoughtDetail) {
    event.preventDefault();
    return;
  }

  if (thoughtDetailSpecRef.getAttribute("href") === "#") {
    event.preventDefault();
    void openThoughtDetailSpecJson();
  }
});

thoughtDetailColorFont.addEventListener("click", (event) => {
  if (thoughtDetailColorFont.dataset.blobReady === "true" && thoughtDetailColorFont.getAttribute("href") !== "#") {
    return;
  }

  event.preventDefault();
  void openColorFontDocument({ rawDocument: true });
});

thoughtDetailProvenanceBytes.addEventListener("click", (event) => {
  if (thoughtDetailProvenanceBytes.getAttribute("href") === "#") {
    event.preventDefault();
  }
});

const handleViewportResize = () => {
  syncCurrentWorkVisual({ suppressWarning: true });
  syncThoughtDetailTextBlocks();
  syncThoughtDetailEmbeddedHeights();
};

window.addEventListener("resize", handleViewportResize);
window.visualViewport?.addEventListener("resize", handleViewportResize);
window.addEventListener("beforeunload", () => {
  if (Date.now() < suppressBridgeLaunchUnloadUntil) {
    return;
  }

  pageUnloading = true;
  invalidateRunSession();
  if (runInFlight || runState === "running") {
    stopCliProgress();
    markInterruptedCliRun();
  }
  revokeThoughtInstructionsObjectUrl();
  revokeColorFontPageRawUrl();
});
window.addEventListener("focus", () => {
  refreshThoughtDockPolling();
  resumePendingMintReceiptMonitoring();
  resumeConflictingMintReceiptMonitoring();
  const canSoftRefresh =
    mintFlowState === "path_required" ||
    mintFlowState === "path_ready" ||
    (mintFlowState === "error" && isPathRecoveryError());

  if (
    !canSoftRefresh ||
    !walletState.address ||
    Date.now() - lastMintSheetFocusRefreshAt < 8000
  ) {
    return;
  }

  lastMintSheetFocusRefreshAt = Date.now();
  void refreshWalletState().then(async () => {
    if (!walletState.address || walletState.chainId !== THOUGHT_CHAIN_ID) return;
    await refreshPathInventoryForCurrentWallet({ force: true });
    if (canContinueWithPathInput() && mintFlowState !== "authorizing" && mintFlowState !== "minting") {
      await checkPathEligibility();
    }
  });
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshThoughtDockPolling();
    resumePendingMintReceiptMonitoring();
    resumeConflictingMintReceiptMonitoring();
  }
});
window.addEventListener("pageshow", () => {
  refreshThoughtDockPolling();
  resumePendingMintReceiptMonitoring();
  resumeConflictingMintReceiptMonitoring();
});
document.addEventListener("resume", () => {
  refreshThoughtDockPolling();
  resumePendingMintReceiptMonitoring();
  resumeConflictingMintReceiptMonitoring();
});
window.addEventListener("online", () => {
  refreshThoughtDockPolling();
  resumePendingMintReceiptMonitoring();
  resumeConflictingMintReceiptMonitoring();
});
document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      mintFlowUiMode === "sheet" &&
      mintFlowState !== "closed"
    ) {
      closeMintSheet();
    }
});

const initFrontpage = async () => {
  configurePreviewWatermark();
  configureReportBugLink();
  configureGalleryLink();
  document.title = IS_COLOR_FONT_PAGE
    ? "Color Font"
    : IS_VERIFY_PAGE
      ? `verify — ${SURFACE_TERMINOLOGY.thoughtDapp}`
      : IS_AGENT_DEMO_PAGE
        ? "Run with your Agent"
        : IS_PLUGIN_PAGE
          ? ROUTE_PLUGIN_AGENT === "codex"
            ? "THOUGHT Plugin · Codex"
            : ROUTE_PLUGIN_AGENT === "claude"
              ? "THOUGHT Plugin · Claude"
              : "THOUGHT Plugin"
        : IS_GALLERY_PAGE
          ? "Gallery"
          : IS_RUN_PAGE
            ? "THOUGHT Run"
          : SURFACE_TERMINOLOGY.thoughtDapp;

  if (IS_COLOR_FONT_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.add("is-hidden");
    thoughtPage.classList.add("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    colorFontPage.classList.remove("is-hidden");
    verifyPage.classList.add("is-hidden");
    await loadColorFontPage();
    return;
  }

  if (IS_VERIFY_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.add("is-hidden");
    thoughtPage.classList.add("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.remove("is-hidden");
    renderVerifyPage();
    return;
  }

  if (IS_AGENT_DEMO_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.add("is-hidden");
    thoughtPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    agentDemoPage.classList.remove("is-hidden");
    initAgentDemoPage();
    return;
  }

  if (IS_PLUGIN_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.add("is-hidden");
    thoughtPage.classList.add("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.add("is-hidden");
    pluginPage.classList.remove("is-hidden");
    renderPluginPage();
    return;
  }

  if (IS_GALLERY_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.remove("is-hidden");
    thoughtPage.classList.add("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.add("is-hidden");
    await loadThoughtGallery();
    return;
  }

  if (IS_THOUGHT_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.add("is-hidden");
    thoughtPage.classList.remove("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.add("is-hidden");
    await loadThoughtDetail();
    return;
  }

  frontpageStage.classList.remove("is-hidden");
  galleryPage.classList.add("is-hidden");
  thoughtPage.classList.add("is-hidden");
  agentDemoPage.classList.add("is-hidden");
  pluginPage.classList.add("is-hidden");
  colorFontPage.classList.add("is-hidden");
  verifyPage.classList.add("is-hidden");
  loadCliTranscript();
  const hydratedRunLink = await hydrateThoughtRunLink();
  const resumedPendingThoughtDockRun = hydratedRunLink ? false : resumeThoughtDockPendingRun();
  const resumedPendingThoughtAgentRun = hydratedRunLink || resumedPendingThoughtDockRun ? false : resumePendingThoughtAgentRun();
  if (!hydratedRunLink && !resumedPendingThoughtDockRun && !resumedPendingThoughtAgentRun && IS_CLI_DEBUG) {
    markInterruptedCliRun();
  }
  loadCliCommandHistory();
  if (!hydratedRunLink && !resumedPendingThoughtDockRun && !resumedPendingThoughtAgentRun) {
    resetThought({ preserveStoredOutput: true });
    restoreCurrentOutputSession();
    restoreCurrentCandidateSession();
  }
  initializeCliTranscript();
  syncInterface();

  try {
    const handledOpenRouterCallback = await handleOpenRouterCallback();
    if (handledOpenRouterCallback) {
      appendCliOutput(["openrouter linked.", "route: connect", "use: run"]);
    }
    void refreshCurrentModels({ silent: true });
  } catch (error) {
    cleanOpenRouterCallbackUrl();
    const message = error instanceof Error ? error.message : "openrouter connect failed.";
    setWarning(message);
    setStatus("failed.");
    appendCliError(
      message === "openrouter connect failed." ? message : ["openrouter connect failed.", message],
    );
  }

  bindThoughtShellWallet();
  bindWalletProviderEvents();
  bindPendingMintStorageEvents();
  await refreshWalletState();
  const resumedPendingMint = await resumePendingMintTransaction();
  resumeConflictingMintReceiptMonitoring();
  let resumedPathMint = false;
  if (!resumedPendingMint) {
    resumedPathMint = await resumePathMintHandoff();
  }
  if (!resumedPendingMint && !resumedPathMint) {
    if (mintDockRevealed) {
      await mintThoughtDockWork();
    } else {
      recordCurrentMintConsoleState();
    }
  }
  syncInterface();

  void ensureActiveThoughtSpec()
    .then(() => {
      syncThoughtInstructionsControls();
    })
    .catch(() => {
      syncThoughtInstructionsControls();
    });

  void document.fonts.load(`100 12px ${CANVAS_TEXT_FAMILY}`).then(() => {
    syncCurrentWorkVisual({ suppressWarning: true });
  });
  if (!IS_RUN_PAGE) {
    focusThoughtDockPrompt({ preventScroll: true });
  }
};

void initFrontpage();
