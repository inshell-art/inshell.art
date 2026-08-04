import type { ThoughtPathAcquisitionState } from "./thought-path-acquisition";
import { THOUGHT_EXISTS_CONSOLE_NEXT_STEP } from "./thought-console";

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
  | "local_deployment"
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
  | "archive_legacy_local_mint"
  | "view_thought"
  | "choose_another"
  | "enter_path_manually"
  | "mint_path"
  | "confirm_path_mint"
  | "view_path_tx"
  | "recover_submission"
  | "confirm_wallet_request_closed"
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
  work: {
    ready: boolean;
    blockedTitle: string;
    reason: string;
  };
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
    canArchiveLegacyLocalMint?: boolean;
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
      detail: "Checking the current auction price.",
      stageCopy: "Please wait.",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (facts.pathAcquisition.state === "review") {
    const mintLabel = `Mint $PATH for ${facts.pathAcquisition.priceLabel}`;
    return withDefaults({
      title: "you need a $PATH",
      detail: `Select “${mintLabel}” above to mint the $PATH required for this THOUGHT work.`,
      stageCopy: "Your wallet will ask you to confirm a transaction. Gas applies.",
      consoleNextStep: "mint here, or explore $PATH at /path",
      tone: "idle",
      panelMode: "path_needed",
      actions: [action("confirm_path_mint", mintLabel)],
    });
  }

  if (facts.pathAcquisition.state === "awaiting_signature") {
    return withDefaults({
      title: "confirm $PATH mint in wallet",
      detail: "Open your wallet and confirm the transaction.",
      stageCopy: "Transaction not submitted yet · gas applies",
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
      stageCopy: "Wait for confirmation. The new $PATH will be picked automatically.",
      tone: "running",
      panelMode: "path_needed",
      actions: facts.pathAcquisition.txHash
        ? [action("view_path_tx", "View transaction")]
        : [noAction()],
    });
  }

  if (facts.pathAcquisition.state === "inventory_pending") {
    return withDefaults({
      title: "$PATH minted; wallet updating",
      detail: "The transaction is confirmed, but the new $PATH is not listed yet.",
      stageCopy: "Do not mint another. Open the wallet menu and select “refresh”.",
      consoleNextStep: "open the wallet menu and select refresh",
      tone: "warning",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  return withDefaults({
    title: "$PATH mint unavailable",
    detail: "The $PATH transaction could not be prepared. Nothing was submitted.",
    stageCopy: "Select “Try again”, or open /path.",
    consoleNextStep: "try again here, or explore $PATH at /path",
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
      stageCopy: "Please wait.",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (inventory.status === "unavailable" || inventory.status === "error") {
    return withDefaults({
      title: "$PATH list unavailable",
      detail: "The App could not load this wallet’s $PATH tokens. Your wallet may still hold them.",
      stageCopy: "Open the wallet menu and select “refresh”.",
      consoleNextStep: "open the wallet menu and select refresh",
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
      ? `Select “Use $PATH #${facts.pathId}” above for this THOUGHT work.`
      : "Pick a $PATH above for this THOUGHT work.",
    tone: "idle",
    panelMode: "path_needed",
    actions: [action("continue", facts.pathId ? `Use $PATH #${facts.pathId}` : "Pick $PATH", !facts.pathId)],
  });
};

const presentError = (facts: ThoughtMintFacts): ThoughtMintPresentation => {
  const { kind, message } = facts.error;
  const mintRequest = facts.pathAcquisition.completed ? "Wallet request 3 of 3" : "Wallet request 2 of 2";

  if (kind === "local_deployment") {
    return withDefaults({
      title: "local mint unavailable",
      detail:
        "Local Anvil is not serving the THOUGHT contracts configured for this App. Nothing was submitted.",
      stageCopy: "Start or restore the local dev chain, then select “Try again”.",
      consoleNextStep: "start or restore the local dev chain, then select “Try again”",
      tone: "error",
      panelMode: "failed",
      actions: [action("continue", "Try again")],
    });
  }

  if (kind === "path_mint_pending") {
    return withDefaults({
      title: "$PATH mint confirming",
      detail: "The $PATH transaction is still confirming.",
      stageCopy: "Wait for confirmation. Do not submit another mint.",
      consoleNextStep: "wait for confirmation, then open the wallet menu and select refresh",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (kind === "path_mint_chain_mismatch") {
    return withDefaults({
      title: "$PATH minted on another network",
      detail: `This THOUGHT needs a $PATH on ${facts.chainName}.`,
      stageCopy: "Switch networks, then select “Mint another $PATH”.",
      consoleNextStep: `switch to ${facts.chainName}, then mint another $PATH`,
      tone: "warning",
      panelMode: "path_needed",
      actions: [action("mint_path", "Mint another $PATH")],
    });
  }

  if (kind === "wallet_account_mismatch") {
    return withDefaults({
      title: "switch wallet account",
      detail: "This $PATH belongs to another wallet account.",
      stageCopy: "Use the account that owns this $PATH, then open the wallet menu and select “refresh”.",
      consoleNextStep: "switch to the $PATH owner account, then open the wallet menu and select refresh",
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
      detail: `Select “Switch to ${facts.chainName}” above to use the required network for this THOUGHT work.`,
      stageCopy: "Approve the network change in your wallet.",
      tone: "warning",
      panelMode: "wallet_needed",
      actions: [action("switch_network", `Switch to ${facts.chainName}`)],
    });
  }

  if (pathRecoveryKinds.has(kind)) {
    const path = facts.pathId ? `$PATH #${facts.pathId}` : "This $PATH";
    const unavailable = kind === "path_consumed" || kind === "path_not_ready";
    return withDefaults({
      title: "$PATH unavailable",
      detail: unavailable
        ? `${path} cannot mint this THOUGHT.`
        : `The App could not check ${path}.`,
      stageCopy: "Select “Pick another $PATH”, or open the wallet menu and select “refresh”.",
      consoleNextStep: "pick another $PATH, or open the wallet menu and select refresh",
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
        detail: "Open your wallet and approve or reject the existing signature request.",
        stageCopy: "Signature only · no transaction · no gas",
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
        ? "Nothing changed. Select “Try again”, or pick another $PATH."
        : expired
          ? `Select “Sign ${signaturePath}” above to sign again.`
          : `Select “Sign ${signaturePath}” above to try again.`,
      stageCopy: "Signature only · no transaction · no gas",
      consoleNextStep: rejected
        ? "select “Try again”, or pick another $PATH"
        : undefined,
      tone: "warning",
      panelMode: "path_needed",
      activeStep: "sign",
      completedSteps: ["path"],
      actions: [
        action("authorize", rejected ? "Try again" : `Sign ${signaturePath}`),
        action("choose_another", "Pick another $PATH"),
      ],
    });
  }

  const missingAuthoritativeAgentRun =
    /attestation requires a returned Agent run|Agent run held by this dev backend/i.test(message);
  if (kind === "mint" && missingAuthoritativeAgentRun) {
    return withDefaults({
      title: "run this work again",
      detail: "This work is no longer ready to mint. Nothing was submitted.",
      stageCopy: "Select “reset”, then send the prompt to your Agent again.",
      consoleNextStep: "reset and send the prompt to your Agent again",
      tone: "warning",
      panelMode: "failed",
      activeStep: "mint",
      completedSteps: ["path", "sign"],
      actions: [noAction()],
    });
  }

  if (kind === "mint" && facts.authorization.signed) {
    const recoveryCleared = /recovery check complete|waiter is detached/i.test(message);
    const returnedWithoutHash = /wallet returned.*not submitted/i.test(message);
    const walletRequestOpen =
      /previous transaction.*still being signed|already processing|already pending|request.*open|wallet request may still be open/i.test(message);
    const delayed = /not submitted|timed out|timeout|delayed|queued|nonce|another tab|unresolved|submission lock|recovery check complete|detached/i.test(message);
    const rejected = /reject|denied|cancel/i.test(message);
    const canceledAfterSubmission = rejected && Boolean(facts.transaction.hash);
    if (facts.transaction.hash && !rejected && !delayed) {
      return withDefaults({
        title: "mint failed on-chain",
        detail: "The transaction failed. No THOUGHT was created.",
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
      title: recoveryCleared
        ? "ready to retry"
        : walletRequestOpen
          ? "wallet request already open"
        : returnedWithoutHash
          ? "mint not submitted"
        : delayed
          ? "wallet response delayed"
          : canceledAfterSubmission
            ? "mint canceled"
            : rejected
              ? "mint not submitted"
              : "mint transaction failed",
      detail: recoveryCleared
        ? "The previous wallet request was not submitted. Confirm that your wallet has no open request, then retry."
        : walletRequestOpen
          ? "Finish or cancel the previous transaction request in your wallet. This mint was not submitted."
        : returnedWithoutHash
          ? "The wallet closed without returning a transaction hash. Check wallet activity before trying again."
        : delayed
        ? "Do not open a duplicate request. Check wallet activity first."
        : canceledAfterSubmission
          ? "The submitted mint was canceled. No THOUGHT was created."
        : rejected
          ? "Nothing was sent. Your $PATH signature is still valid."
          : "The mint request failed before submission. No THOUGHT was created.",
      stageCopy: canceledAfterSubmission
        ? `${shortHash(facts.transaction.hash)} · transaction canceled`
        : walletRequestOpen
          ? "Resolve the open wallet request first"
        : returnedWithoutHash
          ? "No transaction hash received"
          : `${mintRequest} · transaction · gas applies`,
      consoleNextStep: walletRequestOpen
        ? "finish or cancel the previous wallet request, then select “I closed it”"
        : returnedWithoutHash
          ? "select “Check wallet activity” before retrying"
        : rejected
          ? "select “Try again”, or pick another $PATH"
          : undefined,
      tone: "warning",
      panelMode: "minting",
      activeStep: "mint",
      completedSteps: ["path", "sign"],
      actions: recoveryCleared
        ? [action("confirm_mint", "Try again"), action("choose_another", "Pick another $PATH")]
        : walletRequestOpen
          ? [action("confirm_wallet_request_closed", "I closed it")]
          : returnedWithoutHash || delayed
            ? [action("recover_submission", "Check wallet activity")]
            : [action("confirm_mint", "Try again"), action("choose_another", "Pick another $PATH")],
    });
  }

  return withDefaults({
    title: kind === "thought" || kind === "spec" ? "mint unavailable" : "mint failed",
    detail: kind === "thought" || kind === "spec"
      ? "This THOUGHT cannot be minted right now. Nothing was submitted."
      : "The mint could not be prepared. Nothing was submitted.",
    stageCopy: "Select “Try again”.",
    consoleNextStep: "select “Try again”",
    tone: "error",
    panelMode: "failed",
    actions: [action("continue", "Try again")],
  });
};

export const presentThoughtMint = (facts: ThoughtMintFacts): ThoughtMintPresentation => {
  const path = facts.pathId ? `$PATH #${facts.pathId}` : "the picked $PATH";

  if (facts.state === "closed") {
    if (!facts.work.ready) {
      return withDefaults({
        title: "run this work again",
        detail: "This work is no longer ready to mint.",
        stageCopy: "Select “reset”, then send the prompt to your Agent again.",
        consoleNextStep: "reset and send the prompt to your Agent again",
        tone: "warning",
        panelMode: "failed",
        actions: [],
      });
    }
    return withDefaults({
      title: "work ready",
      detail: !facts.mintEnabled
        ? "THOUGHT minting is unavailable right now."
        : facts.address
          ? "Select “mint” above to start minting this THOUGHT work."
          : "Select “mint” above to connect your wallet.",
      stageCopy: "1 THOUGHT requires 1 available $PATH.",
      tone: "idle",
      panelMode: "ready_to_mint",
      actions: [],
    });
  }

  if (facts.state === "thought_checking") {
    return withDefaults({
      title: "checking THOUGHT",
      detail: "Checking whether this THOUGHT is new and ready to mint.",
      stageCopy: "Please wait.",
      tone: "running",
      panelMode: "minting",
      actions: [noAction()],
    });
  }

  if (facts.state === "text_taken") {
    return withDefaults({
      title: "THOUGHT already exists",
      detail: "This exact prompt + Agent response pair is already on-chain. The ordered pair can be minted only once, and your $PATH was not used.",
      stageCopy: facts.existingTokenId === null ? "Open the existing THOUGHT." : `THOUGHT #${facts.existingTokenId} is already on-chain.`,
      consoleNextStep: THOUGHT_EXISTS_CONSOLE_NEXT_STEP,
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
        ? "Install or enable a wallet to mint this THOUGHT work."
        : facts.walletRequestPending
          ? "Open your wallet and approve or reject the connection request."
          : "Select “Connect wallet” above to use that wallet for this THOUGHT mint.",
      stageCopy: "Connection only · no signature · no transaction",
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
    const checkingPath = facts.pathId ? `$PATH #${facts.pathId}` : "the picked $PATH";
    return withDefaults({
      title: facts.pathId ? `checking $PATH #${facts.pathId}` : "checking $PATH",
      detail: `Checking that ${checkingPath} belongs to this wallet and can mint a THOUGHT.`,
      stageCopy: "Please wait.",
      tone: "running",
      panelMode: "path_needed",
      actions: [noAction()],
    });
  }

  if (facts.state === "path_ready") {
    const signLabel = `Sign ${path}`;
    return withDefaults({
      title: `sign ${path}`,
      detail: `Select “${signLabel}” above, then approve the signature in your wallet.`,
      stageCopy: "Signature only · no transaction · no gas",
      tone: "idle",
      panelMode: "path_needed",
      activeStep: "sign",
      completedSteps: ["path"],
      actions: [action("authorize", signLabel), action("choose_another", "Pick another $PATH")],
    });
  }

  if (facts.state === "authorizing") {
    return withDefaults({
      title: `sign ${path} in wallet`,
      detail: "Open your wallet and approve the signature.",
      stageCopy: "Signature only · no transaction · no gas",
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
      detail: `Select “Mint THOUGHT” above to submit this THOUGHT work to the network.${expires}`,
      stageCopy: "Next wallet request · transaction · gas applies",
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
      const legacyLocalMismatch = facts.transaction.canArchiveLegacyLocalMint === true;
      return withDefaults({
        title: legacyLocalMismatch
          ? "old local mint cannot confirm here"
          : trackingWarning
            ? "mint tracking delayed"
            : "mint submitted",
        detail: legacyLocalMismatch
          ? "This hash was sent to the retired shared local node, not the current THOUGHT node."
          : trackingWarning
            ? "The transaction was submitted, but confirmation is delayed."
          : (facts.transaction.hash
          ? `${shortHash(facts.transaction.hash)} · waiting for chain confirmation.`
          : "Waiting for chain confirmation."),
        stageCopy: legacyLocalMismatch
          ? "Archive this local-only record, then mint again on THOUGHT Anvil."
          : trackingWarning
            ? "View the transaction to check its status. Do not submit another mint."
          : "Wait for confirmation. Do not submit another mint.",
        tone: trackingWarning ? "warning" : "running",
        panelMode: "minting",
        activeStep: "mint",
        completedSteps: ["path", "sign"],
        actions: facts.transaction.hash
          ? [
              action("view_tx", "View transaction"),
              ...(legacyLocalMismatch
                ? [action("archive_legacy_local_mint", "Archive old local mint")]
                : []),
            ]
          : [noAction()],
      });
    }

    return withDefaults({
      title: "confirm THOUGHT mint in wallet",
      detail: "Open your wallet and confirm the transaction.",
      stageCopy: "Transaction not submitted yet · gas applies",
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
