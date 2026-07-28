import type { ThoughtPathAcquisitionState } from "./thought-path-acquisition";

export type ThoughtMintFlowState =
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

export type ThoughtMintErrorKind =
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

export type ThoughtMintInventoryStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "unavailable"
  | "error";

export type ThoughtMintActionId =
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
  | "switch_network";

export type ThoughtMintAction = {
  id: ThoughtMintActionId;
  label: string;
  disabled?: boolean;
};

export type ThoughtMintStep = "path" | "sign" | "mint";

export type ThoughtMintPresentation = {
  title: string;
  detail: string;
  stageCopy: string;
  consoleNextStep?: string;
  tone: "idle" | "running" | "success" | "warning" | "error";
  panelMode:
    | "ready_to_mint"
    | "wallet_needed"
    | "path_needed"
    | "minting"
    | "minted"
    | "failed";
  activeStep: ThoughtMintStep;
  completedSteps: ThoughtMintStep[];
  actions: ThoughtMintAction[];
};

export type ThoughtMintFacts = {
  state: ThoughtMintFlowState;
  mintEnabled: boolean;
  providerDetected: boolean;
  walletRequestPending: boolean;
  address: string;
  chainId: number | null;
  requiredChainId: number;
  chainName: string;
  inventory: {
    status: ThoughtMintInventoryStatus;
    matchesWallet: boolean;
    held: number;
    available: number;
    error?: string;
  };
  pathAcquisition: {
    state: ThoughtPathAcquisitionState;
    completed: boolean;
    priceLabel: string;
    txHash: string;
    error: string;
  };
  pathId: string;
  existingTokenId: number | null;
  authorization: {
    signed: boolean;
    deadline: bigint | null;
  };
  transaction: {
    state: "idle" | "awaiting_signature" | "submitted" | "failed";
    hash: string;
  };
  error: {
    kind: ThoughtMintErrorKind;
    message: string;
  };
  nowSeconds?: bigint;
};

const noAction = (): ThoughtMintAction => ({ id: "none", label: "" });
const action = (
  id: ThoughtMintActionId,
  label: string,
  disabled = false,
): ThoughtMintAction => ({ id, label, ...(disabled ? { disabled } : {}) });

const shortAddress = (address: string) =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

const shortHash = (hash: string) =>
  hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;

const withDefaults = (
  value: Omit<ThoughtMintPresentation, "activeStep" | "completedSteps"> &
    Partial<Pick<ThoughtMintPresentation, "activeStep" | "completedSteps">>,
): ThoughtMintPresentation => ({
  activeStep: "path",
  completedSteps: [],
  ...value,
});

const pathRecoveryKinds = new Set<ThoughtMintErrorKind>([
  "path_invalid",
  "path_not_found",
  "path_consumed",
  "path_not_ready",
  "path_unknown",
]);

const presentPathAcquisition = (facts: ThoughtMintFacts): ThoughtMintPresentation | null => {
  if (facts.pathAcquisition.state === "idle") return null;

  if (facts.pathAcquisition.state === "quoting") {
    return withDefaults({
      title: "reading $PATH price",
      detail: "Checking the current auction price and contract wiring.",
      stageCopy: "No wallet request yet.",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (facts.pathAcquisition.state === "review") {
    return withDefaults({
      title: "you need a $PATH",
      detail: `${facts.pathAcquisition.priceLabel} · current auction price. The wallet reads the live price again before submission.`,
      stageCopy: "Wallet request 1 of 3 · transaction · gas applies",
      consoleNextStep: "mint here, or explore $PATH at /path",
      tone: "idle",
      panelMode: "path_needed",
      actions: [action("confirm_path_mint", `Mint $PATH for ${facts.pathAcquisition.priceLabel}`)],
    });
  }

  if (facts.pathAcquisition.state === "awaiting_signature") {
    return withDefaults({
      title: "confirm $PATH mint in wallet",
      detail: `${facts.pathAcquisition.priceLabel} · no transaction has been submitted yet.`,
      stageCopy: "Wallet request 1 of 3 · transaction · gas applies",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (facts.pathAcquisition.state === "submitted") {
    return withDefaults({
      title: "$PATH mint submitted",
      detail: facts.pathAcquisition.txHash
        ? `${shortHash(facts.pathAcquisition.txHash)} · waiting for confirmation.`
        : "Waiting for chain confirmation.",
      stageCopy: "The new $PATH will be picked automatically after confirmation.",
      tone: "running",
      panelMode: "path_needed",
      actions: facts.pathAcquisition.txHash
        ? [action("view_path_tx", "View transaction")]
        : [noAction()],
    });
  }

  return withDefaults({
    title: "$PATH mint unavailable",
    detail: facts.pathAcquisition.error || "The $PATH transaction could not be prepared.",
    stageCopy: "No $PATH was minted.",
    consoleNextStep: "retry here, or explore $PATH at /path",
    tone: "warning",
    panelMode: "path_needed",
    actions: [
      action("mint_path", "Try again"),
    ],
  });
};

const presentPathInventory = (facts: ThoughtMintFacts): ThoughtMintPresentation => {
  const { inventory } = facts;
  const walletContext = facts.address
    ? `${shortAddress(facts.address)} on ${facts.chainName}`
    : facts.chainName;

  if (!inventory.matchesWallet || inventory.status === "idle" || inventory.status === "loading") {
    return withDefaults({
      title: "finding your $PATH tokens",
      detail: `Reading ${walletContext}.`,
      stageCopy: "Checking $PATH inventory",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (inventory.status === "unavailable" || inventory.status === "error") {
    return withDefaults({
      title: "$PATH inventory unavailable",
      detail: "We could not read this wallet’s $PATH tokens. This does not mean the wallet is empty.",
      stageCopy: inventory.error?.trim() || "$PATH inventory could not be verified.",
      consoleNextStep: "refresh wallet from the shell bar",
      tone: "warning",
      panelMode: "path_needed",
      actions: [action("enter_path_manually", "Enter token ID")],
    });
  }

  if (inventory.available === 0) {
    const acquisition = presentPathAcquisition(facts);
    if (acquisition) return acquisition;
  }

  if (inventory.held === 0) {
    return withDefaults({
      title: "you need a $PATH",
      detail: `No $PATH found in ${walletContext}.`,
      stageCopy: "Reading the current auction price.",
      consoleNextStep: "mint here, or explore $PATH at /path",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (inventory.available === 0) {
    const noun = inventory.held === 1 ? "$PATH was" : "$PATH tokens were";
    return withDefaults({
      title: "no $PATH can mint a THOUGHT",
      detail: `${inventory.held} ${noun} found; all THOUGHT mints are used or unavailable.`,
      stageCopy: "Reading the current auction price for a new $PATH.",
      consoleNextStep: "mint here, or explore $PATH at /path",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  return withDefaults({
    title: inventory.available === 1 ? "one $PATH is ready" : "pick a $PATH",
    detail: inventory.available === 1
      ? "1 $PATH has a THOUGHT mint available."
      : `${inventory.available} $PATH tokens have a THOUGHT mint available.`,
    stageCopy: facts.pathId
      ? `$PATH #${facts.pathId} picked.`
      : "The picked $PATH becomes part of this THOUGHT’s provenance.",
    tone: "idle",
    panelMode: "path_needed",
    actions: [action("continue", facts.pathId ? `Use $PATH #${facts.pathId}` : "Pick $PATH", !facts.pathId)],
  });
};

const presentError = (facts: ThoughtMintFacts): ThoughtMintPresentation => {
  const { kind, message } = facts.error;
  const signatureRequest = facts.pathAcquisition.completed ? "Wallet request 2 of 3" : "Wallet request 1 of 2";
  const mintRequest = facts.pathAcquisition.completed ? "Wallet request 3 of 3" : "Wallet request 2 of 2";

  if (kind === "path_mint_pending") {
    return withDefaults({
      title: "$PATH mint confirming",
      detail: message,
      stageCopy: "Wait for confirmation, then refresh wallet from the shell bar.",
      consoleNextStep: "refresh wallet from the shell bar",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (kind === "path_mint_chain_mismatch") {
    return withDefaults({
      title: "$PATH minted on another network",
      detail: message,
      stageCopy: "Mint a $PATH on the THOUGHT network to continue.",
      consoleNextStep: "mint another $PATH, then refresh wallet from the shell bar",
      tone: "warning",
      panelMode: "path_needed",
      actions: [action("mint_path", "Mint another $PATH")],
    });
  }

  if (kind === "wallet_account_mismatch") {
    return withDefaults({
      title: "switch wallet account",
      detail: message,
      stageCopy: "The $PATH mint is confirmed. Use its owner account to continue this THOUGHT.",
      consoleNextStep: "switch to the $PATH owner account, then refresh wallet from the shell bar",
      tone: "warning",
      panelMode: "wallet_needed",
      actions: facts.address
        ? [action("disconnect_wallet", "Disconnect wallet")]
        : [action("connect_wallet", "Connect wallet")],
    });
  }

  if (kind === "wrong_network") {
    return withDefaults({
      title: "switch network",
      detail: `Use ${facts.chainName} to continue.`,
      stageCopy: "Network switching is a separate wallet request.",
      tone: "warning",
      panelMode: "wallet_needed",
      actions: [action("switch_network", `Switch to ${facts.chainName}`)],
    });
  }

  if (pathRecoveryKinds.has(kind)) {
    const path = facts.pathId ? `$PATH #${facts.pathId}` : "This $PATH";
    const unavailable = kind === "path_consumed" || kind === "path_not_ready";
    return withDefaults({
      title: unavailable ? "$PATH cannot mint a THOUGHT" : "$PATH could not be verified",
      detail: unavailable
        ? `${path} has no THOUGHT mint available.`
        : message || `${path} could not be verified.`,
      stageCopy: "Pick another $PATH, or refresh wallet from the shell bar.",
      consoleNextStep: "pick another $PATH, or refresh wallet from the shell bar",
      tone: "warning",
      panelMode: "path_needed",
      actions: [action("choose_another", "Pick another $PATH")],
    });
  }

  if (kind === "signature") {
    const signaturePath = facts.pathId ? `$PATH #${facts.pathId}` : "the picked $PATH";
    const pending = /already pending|request.*open/i.test(message);
    const rejected = /reject|denied|cancel/i.test(message);
    const expired = /expired/i.test(message);

    if (pending) {
      return withDefaults({
        title: "wallet request already open",
        detail: "Approve or reject the existing request in your wallet, then return here.",
        stageCopy: `${signatureRequest} · no gas`,
        tone: "warning",
        panelMode: "path_needed",
        activeStep: "sign",
        completedSteps: ["path"],
        actions: [noAction()],
      });
    }

    return withDefaults({
      title: expired ? "$PATH signature expired" : rejected ? "$PATH not signed" : "$PATH signature unavailable",
      detail: rejected
        ? "Nothing changed. You can try again or pick another $PATH."
        : expired
          ? "Sign a new $PATH permission to continue."
          : message || "The $PATH permission could not be signed.",
      stageCopy: `${signatureRequest} · no transaction · no gas`,
      tone: rejected ? "idle" : "warning",
      panelMode: "path_needed",
      activeStep: "sign",
      completedSteps: ["path"],
      actions: [action("authorize", rejected ? "Try signature again" : `Sign ${signaturePath}`), action("choose_another", "Pick another $PATH")],
    });
  }

  if (kind === "mint" && facts.authorization.signed) {
    const recoveryCleared = /recovery check complete|waiter is detached/i.test(message);
    const delayed = /not submitted|timed out|timeout|delayed|queued|nonce|another tab|unresolved|submission lock|recovery check complete|detached/i.test(message);
    const rejected = /reject|denied|cancel/i.test(message);
    if (facts.transaction.hash && !rejected && !delayed) {
      return withDefaults({
        title: "mint failed on-chain",
        detail: message || "No THOUGHT was created. Refresh wallet state before retrying.",
        stageCopy: `${shortHash(facts.transaction.hash)} · transaction failed`,
        consoleNextStep: "view the transaction, then refresh wallet from the shell bar",
        tone: "error",
        panelMode: "failed",
        activeStep: "mint",
        completedSteps: ["path", "sign"],
        actions: [action("view_tx", "View transaction")],
      });
    }
    return withDefaults({
      title: recoveryCleared ? "wallet retry unlocked" : delayed ? "wallet response delayed" : rejected ? "mint not submitted" : "mint transaction failed",
      detail: recoveryCleared
        ? "Two checks found no hash or nonce activity. Any late hash remains monitored. Confirm your wallet has no open request before retrying."
        : delayed
        ? "Do not open a duplicate request. Check wallet activity first."
        : rejected
          ? "Nothing was sent. Your $PATH permission is still valid."
          : message || "No THOUGHT was created.",
      stageCopy: `${mintRequest} · transaction · gas applies`,
      tone: rejected ? "idle" : "warning",
      panelMode: "minting",
      activeStep: "mint",
      completedSteps: ["path", "sign"],
      actions: recoveryCleared
        ? [action("confirm_mint", "Retry mint"), action("recover_submission", "Check again")]
        : delayed
        ? [action("recover_submission", "Check wallet activity")]
        : [action("confirm_mint", "Try transaction again"), action("choose_another", "Pick another $PATH")],
    });
  }

  return withDefaults({
    title: kind === "thought" || kind === "spec" ? "mint unavailable" : "mint failed",
    detail: message || "THOUGHT minting is unavailable.",
    stageCopy: "No transaction was submitted.",
    consoleNextStep: "refresh wallet from the shell bar",
    tone: "error",
    panelMode: "failed",
    actions: [noAction()],
  });
};

export const presentThoughtMint = (facts: ThoughtMintFacts): ThoughtMintPresentation => {
  const path = facts.pathId ? `$PATH #${facts.pathId}` : "the picked $PATH";
  const signatureRequest = facts.pathAcquisition.completed ? "Wallet request 2 of 3" : "Wallet request 1 of 2";
  const mintRequest = facts.pathAcquisition.completed ? "Wallet request 3 of 3" : "Wallet request 2 of 2";

  if (facts.state === "closed") {
    return withDefaults({
      title: "work ready",
      detail: !facts.mintEnabled
        ? "THOUGHT minting is not available in this deployment."
        : facts.address
          ? "Ready to prepare this THOUGHT mint."
          : "Connect wallet to mint.",
      stageCopy: "Minting needs one available THOUGHT mint on a $PATH token.",
      tone: "idle",
      panelMode: "ready_to_mint",
      actions: [],
    });
  }

  if (facts.state === "thought_checking") {
    return withDefaults({
      title: "preparing mint",
      detail: "Checking uniqueness, deployment, and mint state.",
      stageCopy: "Your work is preserved while these checks run.",
      tone: "running",
      panelMode: "minting",
      actions: [noAction()],
    });
  }

  if (facts.state === "text_taken") {
    return withDefaults({
      title: "THOUGHT already exists",
      detail: "This exact text is already on-chain. Each THOUGHT can be minted only once, and your $PATH was not used.",
      stageCopy: facts.existingTokenId === null ? "Open the existing THOUGHT." : `THOUGHT #${facts.existingTokenId} is already on-chain.`,
      consoleNextStep: "reset and create a new THOUGHT",
      tone: "success",
      panelMode: "minted",
      activeStep: "mint",
      completedSteps: ["path", "sign", "mint"],
      actions: [action("view_thought", "View THOUGHT")],
    });
  }

  if (facts.state === "wallet_required") {
    const noProvider = !facts.providerDetected;
    return withDefaults({
      title: noProvider ? "wallet unavailable" : "connect wallet",
      detail: noProvider
        ? "Install or enable a wallet to continue."
        : facts.walletRequestPending
          ? "Complete the open connection request in your wallet."
          : "Connection reads your account and network only.",
      stageCopy: "No signature · no transaction · no gas",
      tone: noProvider ? "warning" : facts.walletRequestPending ? "running" : "idle",
      panelMode: "wallet_needed",
      actions: noProvider || facts.walletRequestPending
        ? [noAction()]
        : [action("connect_wallet", "Connect wallet")],
    });
  }

  if (facts.state === "path_required") {
    if (facts.address && facts.chainId !== facts.requiredChainId) {
      return presentError({
        ...facts,
        error: { kind: "wrong_network", message: "wrong network" },
      });
    }
    return presentPathInventory(facts);
  }

  if (facts.state === "path_checking") {
    return withDefaults({
      title: facts.pathId ? `checking $PATH #${facts.pathId}` : "checking $PATH",
      detail: "Verifying ownership and an available THOUGHT mint.",
      stageCopy: "No wallet request yet.",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (facts.state === "path_ready") {
    return withDefaults({
      title: `sign ${path}`,
      detail: `Allow the THOUGHT contract to use one THOUGHT mint from ${path}.`,
      stageCopy: `${signatureRequest} · no transaction · no gas`,
      tone: "idle",
      panelMode: "path_needed",
      activeStep: "sign",
      completedSteps: ["path"],
      actions: [action("authorize", `Sign ${path}`), action("choose_another", "Pick another $PATH")],
    });
  }

  if (facts.state === "authorizing") {
    return withDefaults({
      title: "check your wallet",
      detail: `Sign the permission for ${path} to continue.`,
      stageCopy: `${signatureRequest} · no transaction · no gas`,
      tone: "running",
      panelMode: "path_needed",
      activeStep: "sign",
      completedSteps: ["path"],
      actions: [noAction()],
    });
  }

  if (facts.state === "authorized") {
    const expires = facts.authorization.deadline
      ? ` Permission expires at ${new Date(Number(facts.authorization.deadline) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
      : "";
    return withDefaults({
      title: `${path} signed`,
      detail: `Create this THOUGHT using one THOUGHT mint from ${path}.${expires}`,
      stageCopy: `${mintRequest} · transaction · gas applies`,
      tone: "success",
      panelMode: "minting",
      activeStep: "mint",
      completedSteps: ["path", "sign"],
      actions: [action("confirm_mint", "Mint THOUGHT"), action("choose_another", "Pick another $PATH")],
    });
  }

  if (facts.state === "minting") {
    if (facts.transaction.hash || facts.transaction.state === "submitted") {
      const trackingWarning = facts.error.kind === "mint" && facts.error.message.trim()
        ? facts.error.message.trim()
        : "";
      return withDefaults({
        title: trackingWarning ? "mint tracking delayed" : "mint submitted",
        detail: trackingWarning || (facts.transaction.hash
          ? `${shortHash(facts.transaction.hash)} · waiting for chain confirmation.`
          : "Waiting for chain confirmation."),
        stageCopy: trackingWarning
          ? "Transaction hash retained. Do not submit a duplicate."
          : "The submitted transaction keeps tracking if the active wallet changes.",
        tone: trackingWarning ? "warning" : "running",
        panelMode: "minting",
        activeStep: "mint",
        completedSteps: ["path", "sign"],
        actions: facts.transaction.hash ? [action("view_tx", "View transaction")] : [noAction()],
      });
    }

    return withDefaults({
      title: "confirm mint in wallet",
      detail: "No transaction has been submitted yet.",
      stageCopy: `${mintRequest} · transaction · gas applies`,
      tone: "running",
      panelMode: "minting",
      activeStep: "mint",
      completedSteps: ["path", "sign"],
      actions: [noAction()],
    });
  }

  if (facts.state === "minted") {
    const token = facts.existingTokenId === null ? "THOUGHT" : `THOUGHT #${facts.existingTokenId}`;
    return withDefaults({
      title: "THOUGHT minted",
      detail: `${token} was created using ${path}.`,
      stageCopy: facts.transaction.hash ? `${shortHash(facts.transaction.hash)} · confirmed` : "Confirmed on-chain.",
      tone: "success",
      panelMode: "minted",
      activeStep: "mint",
      completedSteps: ["path", "sign", "mint"],
      actions: [
        action("view_thought", "View THOUGHT"),
        ...(facts.transaction.hash ? [action("view_tx", "View transaction")] : []),
      ],
    });
  }

  if (facts.state === "error") {
    return presentError(facts);
  }

  return withDefaults({
    title: "preparing mint",
    detail: "Checking mint state.",
    stageCopy: "Your work is preserved.",
    tone: "running",
    panelMode: "minting",
    actions: [noAction()],
  });
};
