export const CURRENT_THOUGHT_LAUNCH_MAIN_DELTAS = Object.freeze([
  Object.freeze(["launch state delta 1", "} from \"./thought-preview-policy\";\nimport { createSingleRequestJsonRpcProvider } from \"./rpc-provider\";\nimport {\n  formatThoughtAuthorizationError,\n  getThoughtWorkReadyPresentation,\n  THOUGHT_PANEL_MINT_UI_MODE,\n  THOUGHT_V2_MINT_UNAVAILABLE_COPY,\n  type MintFlowUiMode,\n  type ThoughtAuthorizationStage,\n} from \"./thought-mint-ui\";\nimport {\n  THOUGHT_CONSOLE_EMPTY_DETAIL,\n  THOUGHT_CONSOLE_EMPTY_TITLE,\n", "} from \"./thought-preview-policy\";\nimport { createSingleRequestJsonRpcProvider } from \"./rpc-provider\";\nimport {\n  formatThoughtAuthorizationError,\n  getThoughtWorkReadyPresentation,\n  THOUGHT_PANEL_MINT_UI_MODE,\n  type MintFlowUiMode,\n  type ThoughtAuthorizationStage,\n} from \"./thought-mint-ui\";\nimport {\n  THOUGHT_CONSOLE_EMPTY_DETAIL,\n  THOUGHT_CONSOLE_EMPTY_TITLE,\n"]),
  Object.freeze(["launch state delta 2", "import {\n  PULSE_AUCTION_LIVE_PRICE_REFRESH_MS,\n  formatPulseAuctionPrice,\n  pulseAuctionPriceAtTimestamp,\n} from \"./thought-pulse-auction-price\";\nimport { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";\nimport {\n  THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,\n  isThoughtV2LocalDeploymentError,\n  verifyThoughtV2LocalDeployment,\n} from \"./thought-v2-local-deployment\";\nimport {\n", "import {\n  PULSE_AUCTION_LIVE_PRICE_REFRESH_MS,\n  formatPulseAuctionPrice,\n  pulseAuctionPriceAtTimestamp,\n} from \"./thought-pulse-auction-price\";\nimport { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";\nimport {\n  deriveThoughtLaunchState,\n  getThoughtLaunchGuidance,\n  localThoughtLaunchState,\n  parseThoughtLaunchReadModel,\n  shouldFetchThoughtLaunchReadModel,\n  studioPreviewLaunchState,\n  thoughtSavedWorkMatchesRelease,\n  type ThoughtActiveRelease,\n  type ThoughtLaunchDeployment,\n  type ThoughtLaunchState,\n} from \"./thought-launch-state\";\nimport {\n  THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY,\n  isThoughtV2LocalDeploymentError,\n  verifyThoughtV2LocalDeployment,\n} from \"./thought-v2-local-deployment\";\nimport {\n"]),
  Object.freeze(["launch state delta 3", "});\nconst THOUGHT_AGENT_REGISTERED_SPEC_ID = IS_LOCAL_THOUGHT_V2\n  ? USE_LATEST_LOCAL_GENERATION_SPEC\n    ? LATEST_LOCAL_GENERATION_SPEC.id\n    : THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId\n  : THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId;\nconst THOUGHT_V2_MINT_ENABLED =\n  IS_LOCAL_THOUGHT_V2 || (\n    THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&\n    THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null\n  );\nconst IS_THOUGHT_GALLERY_ACTIVE =\n  IS_LOCAL_THOUGHT_V2 || THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null;\nconst thoughtInstructions = IS_LOCAL_THOUGHT_V2\n  ? latestThoughtCreativeSpec\n  : THOUGHT_V2_PROTOCOL_RELEASE.spec.text;\nconst thoughtInstructionsUrl = IS_LOCAL_THOUGHT_V2\n", "});\nconst THOUGHT_AGENT_REGISTERED_SPEC_ID = IS_LOCAL_THOUGHT_V2\n  ? USE_LATEST_LOCAL_GENERATION_SPEC\n    ? LATEST_LOCAL_GENERATION_SPEC.id\n    : THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId\n  : THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId;\nconst THOUGHT_LAUNCH_READ_MODEL_URL =\n  readConfiguredUrl(\"VITE_THOUGHT_LAUNCH_READ_MODEL_URL\") || \"/api/pulse-auction\";\nconst THOUGHT_LAUNCH_DEPLOYMENT: ThoughtLaunchDeployment | null =\n  THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&\n  THOUGHT_V2_PRODUCTION_DEPLOYMENT &&\n  PATH_AUCTION_ADDRESS\n    ? {\n        artifactId: THOUGHT_V2_PRODUCTION_DEPLOYMENT.artifactId,\n        manifestSha256: THOUGHT_V2_PRODUCTION_DEPLOYMENT.manifestSha256,\n        chainId: THOUGHT_V2_PRODUCTION_DEPLOYMENT.chainId,\n        pulseAuction: PATH_AUCTION_ADDRESS,\n      }\n    : null;\nconst THOUGHT_LAUNCH_FIXTURE = IS_DEV_MODE\n  ? new URLSearchParams(window.location.search).get(\"launch\")\n  : null;\nconst simulatedThoughtLaunchState = (): ThoughtLaunchState | null => {\n  if (THOUGHT_LAUNCH_FIXTURE === \"studio-preview\") {\n    return studioPreviewLaunchState();\n  }\n  if (THOUGHT_LAUNCH_FIXTURE === \"onchain-countdown\") {\n    return {\n      environment: \"public-beta-sepolia\",\n      phase: \"onchain-countdown\",\n      chainId: 11155111,\n      openTime: \"2026-09-01T12:00:00.000Z\",\n      deploymentVerified: true,\n      mintEnabled: false,\n    };\n  }\n  if (THOUGHT_LAUNCH_FIXTURE === \"onchain-open\") {\n    return {\n      environment: \"public-beta-sepolia\",\n      phase: \"onchain-open\",\n      chainId: 11155111,\n      openTime: \"2026-01-01T00:00:00.000Z\",\n      deploymentVerified: true,\n      mintEnabled: true,\n    };\n  }\n  return null;\n};\nlet thoughtLaunchState: ThoughtLaunchState =\n  simulatedThoughtLaunchState() ??\n  (IS_LOCAL_THOUGHT_V2\n    ? localThoughtLaunchState(THOUGHT_CHAIN_ID)\n    : deriveThoughtLaunchState({\n        deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n        readModel: null,\n      }));\nconst isThoughtMintEnabled = () => thoughtLaunchState.mintEnabled;\nconst THOUGHT_ACTIVE_RELEASE: ThoughtActiveRelease | null =\n  THOUGHT_LAUNCH_DEPLOYMENT\n    ? {\n        manifestSha256: THOUGHT_V2_ARTIFACT.manifestSha256,\n        thoughtSpecId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,\n        thoughtSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,\n      }\n    : null;\nconst refreshThoughtLaunchState = async () => {\n  if (!shouldFetchThoughtLaunchReadModel({\n    deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n    localRuntime: IS_LOCAL_THOUGHT_V2,\n    simulatedPhase: THOUGHT_LAUNCH_FIXTURE,\n  })) {\n    return thoughtLaunchState;\n  }\n  let readModel = null;\n  try {\n    const response = await fetch(THOUGHT_LAUNCH_READ_MODEL_URL, {\n      method: \"GET\",\n      credentials: \"same-origin\",\n      cache: \"no-store\",\n      headers: { Accept: \"application/json\" },\n    });\n    if (response.ok) {\n      readModel = parseThoughtLaunchReadModel(await response.json());\n    }\n  } catch {\n    // Missing or unreachable public evidence keeps minting closed.\n  }\n  thoughtLaunchState = deriveThoughtLaunchState({\n    deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n    readModel,\n  });\n  return thoughtLaunchState;\n};\nconst IS_THOUGHT_GALLERY_ACTIVE =\n  IS_LOCAL_THOUGHT_V2 || THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null;\nconst thoughtInstructions = IS_LOCAL_THOUGHT_V2\n  ? latestThoughtCreativeSpec\n  : THOUGHT_V2_PROTOCOL_RELEASE.spec.text;\nconst thoughtInstructionsUrl = IS_LOCAL_THOUGHT_V2\n"]),
  Object.freeze(["launch state delta 4", "const localHelper = document.getElementById(\"local-helper\") as HTMLElement | null;\nconst thoughtCanvasPanel = document.querySelector(\".thought-canvas-panel\") as HTMLElement | null;\nconst thoughtCanvasFrame = document.querySelector(\".thought-canvas-frame\") as HTMLElement | null;\nconst thoughtPanel = document.getElementById(\"thought-panel\") as HTMLElement | null;\nconst thoughtDock = document.getElementById(\"thought-dock\") as HTMLElement | null;\nconst thoughtDockPrompt = document.getElementById(\"thought-dock-prompt\") as HTMLInputElement | null;\nconst thoughtDockPath = document.getElementById(\"thought-dock-path\") as HTMLElement | null;\nconst thoughtDockPathInventory = document.getElementById(\"thought-dock-path-inventory\") as HTMLElement | null;\nconst thoughtDockPathInventoryLabel = document.getElementById(\"thought-dock-path-inventory-label\") as HTMLElement | null;\nconst thoughtDockPathInventorySelect = document.getElementById(\"thought-dock-path-inventory-select\") as HTMLSelectElement | null;\nconst thoughtDockPathFlow = document.getElementById(\"thought-dock-path-flow\") as HTMLElement | null;\nconst thoughtDockMintStep = document.getElementById(\"thought-dock-mint-step\") as HTMLElement | null;\n", "const localHelper = document.getElementById(\"local-helper\") as HTMLElement | null;\nconst thoughtCanvasPanel = document.querySelector(\".thought-canvas-panel\") as HTMLElement | null;\nconst thoughtCanvasFrame = document.querySelector(\".thought-canvas-frame\") as HTMLElement | null;\nconst thoughtPanel = document.getElementById(\"thought-panel\") as HTMLElement | null;\nconst thoughtDock = document.getElementById(\"thought-dock\") as HTMLElement | null;\nconst thoughtDockPrompt = document.getElementById(\"thought-dock-prompt\") as HTMLInputElement | null;\nconst thoughtLaunchStatus = document.getElementById(\"thought-launch-status\") as HTMLElement | null;\nconst thoughtLaunchStatusEyebrow = document.getElementById(\n  \"thought-launch-status-eyebrow\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusTitle = document.getElementById(\n  \"thought-launch-status-title\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusDetail = document.getElementById(\n  \"thought-launch-status-detail\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusMeta = document.getElementById(\n  \"thought-launch-status-meta\",\n) as HTMLElement | null;\nconst thoughtDockPath = document.getElementById(\"thought-dock-path\") as HTMLElement | null;\nconst thoughtDockPathInventory = document.getElementById(\"thought-dock-path-inventory\") as HTMLElement | null;\nconst thoughtDockPathInventoryLabel = document.getElementById(\"thought-dock-path-inventory-label\") as HTMLElement | null;\nconst thoughtDockPathInventorySelect = document.getElementById(\"thought-dock-path-inventory-select\") as HTMLSelectElement | null;\nconst thoughtDockPathFlow = document.getElementById(\"thought-dock-path-flow\") as HTMLElement | null;\nconst thoughtDockMintStep = document.getElementById(\"thought-dock-mint-step\") as HTMLElement | null;\n"]),
  Object.freeze(["launch state delta 5", "  !localHelper ||\n  !thoughtCanvasPanel ||\n  !thoughtCanvasFrame ||\n  !thoughtPanel ||\n  !thoughtDock ||\n  !thoughtDockPrompt ||\n  !thoughtDockPath ||\n  !thoughtDockPathInventory ||\n  !thoughtDockPathInventoryLabel ||\n  !thoughtDockPathInventorySelect ||\n  !thoughtDockPathFlow ||\n  !thoughtDockMintStep ||\n", "  !localHelper ||\n  !thoughtCanvasPanel ||\n  !thoughtCanvasFrame ||\n  !thoughtPanel ||\n  !thoughtDock ||\n  !thoughtDockPrompt ||\n  !thoughtLaunchStatus ||\n  !thoughtLaunchStatusEyebrow ||\n  !thoughtLaunchStatusTitle ||\n  !thoughtLaunchStatusDetail ||\n  !thoughtLaunchStatusMeta ||\n  !thoughtDockPath ||\n  !thoughtDockPathInventory ||\n  !thoughtDockPathInventoryLabel ||\n  !thoughtDockPathInventorySelect ||\n  !thoughtDockPathFlow ||\n  !thoughtDockMintStep ||\n"]),
  Object.freeze(["launch state delta 6", "};\n\ntype ThoughtWorkMintReadiness =\n  | { ready: true }\n  | { ready: false; reason: string; blockedTitle: \"mint unavailable\" | \"work needs rerun\" };\n\nconst getCurrentWorkMintReadiness = (): ThoughtWorkMintReadiness => {\n  if (!THOUGHT_V2_MINT_ENABLED) {\n    return { ready: false, reason: THOUGHT_V2_MINT_UNAVAILABLE_COPY, blockedTitle: \"mint unavailable\" };\n  }\n  if (!currentOutputText || !currentRunContext) {\n    return {\n      ready: false,\n      reason: \"This work has no current V2 run context. Run it again before minting.\",\n      blockedTitle: \"work needs rerun\",\n    };\n  }\n  if (!hasCurrentContractWorkSvg()) {\n    return {\n      ready: false,\n      reason: \"This work has no verified contract preview. Run it again before minting.\",\n      blockedTitle: \"work needs rerun\",\n    };\n  }\n  if (!IS_LOCAL_THOUGHT_V2) {\n    return { ready: true };\n  }\n", "};\n\ntype ThoughtWorkMintReadiness =\n  | { ready: true }\n  | { ready: false; reason: string; blockedTitle: \"mint unavailable\" | \"work needs rerun\" };\n\nfunction isCurrentWorkLaunchCompatible() {\n  if (!currentOutputText || !currentRunContext || !currentWorkSvg.trim().startsWith(\"<svg\")) {\n    return false;\n  }\n  if (IS_LOCAL_THOUGHT_V2) {\n    return hasCurrentContractWorkSvg();\n  }\n  return thoughtSavedWorkMatchesRelease(\n    {\n      thoughtSpecId: currentRunContext.thoughtSpec?.id,\n      thoughtSpecHash: currentRunContext.thoughtSpec?.hash,\n      previewMethod: currentRunContext.previewProvider?.method,\n      previewEndpointLabel: currentRunContext.previewProvider?.endpointLabel,\n    },\n    THOUGHT_ACTIVE_RELEASE,\n  );\n}\n\nconst getCurrentWorkMintReadiness = (): ThoughtWorkMintReadiness => {\n  if (!isThoughtMintEnabled()) {\n    const guidance = getThoughtLaunchGuidance({\n      state: thoughtLaunchState,\n      workExists: Boolean(currentOutputText && currentWorkSvg),\n      workCompatible: isCurrentWorkLaunchCompatible(),\n      nowMs: Date.now(),\n    });\n    return {\n      ready: false,\n      reason: guidance.detail,\n      blockedTitle: \"mint unavailable\",\n    };\n  }\n  if (!currentOutputText || !currentRunContext) {\n    return {\n      ready: false,\n      reason: \"This work has no current V2 run context. Run it again before minting.\",\n      blockedTitle: \"work needs rerun\",\n    };\n  }\n  if (!isCurrentWorkLaunchCompatible()) {\n    return {\n      ready: false,\n      reason: \"This work does not match the approved Onchain release. Run it again before minting.\",\n      blockedTitle: \"work needs rerun\",\n    };\n  }\n  if (!IS_LOCAL_THOUGHT_V2) {\n    return { ready: true };\n  }\n"]),
  Object.freeze(["launch state delta 7", "        tone: state.reasonCode === 3 ? \"warning\" : \"error\",\n        actions: [resetAction()],\n      };\n    case \"work_ready\":\n      {\n        const workReady = getThoughtWorkReadyPresentation({\n          mintEnabled: THOUGHT_V2_MINT_ENABLED,\n        });\n        const workMintReadiness = getCurrentWorkMintReadiness();\n        const mintPanelOpen = mintDockRevealed;\n        const canOpenMint = workReady.canMint && workMintReadiness.ready;\n        const currentWorkSaved = currentWorkId !== null && Boolean(\n          getWorkById(readStoredThoughtWorks(), currentWorkId),\n        );\n        return {\n          status: workMintReadiness.ready\n            ? \"Work ready\"\n            : workMintReadiness.blockedTitle === \"work needs rerun\"\n              ? \"Work needs rerun\"\n              : \"Mint unavailable\",\n          tone: canOpenMint ? \"success\" : \"warning\",\n          actions: [\n            ...(canOpenMint\n              ? [dockRailAction(\n                  \"mint\",\n                  mintPanelOpen ? \"mint ↓\" : \"mint\",\n                  mintPanelOpen ? \"collapse Mint panel\" : \"mint this accepted THOUGHT work\",\n", "        tone: state.reasonCode === 3 ? \"warning\" : \"error\",\n        actions: [resetAction()],\n      };\n    case \"work_ready\":\n      {\n        const workReady = getThoughtWorkReadyPresentation({\n          mintEnabled: isThoughtMintEnabled(),\n        });\n        const workMintReadiness = getCurrentWorkMintReadiness();\n        const mintPanelOpen = mintDockRevealed;\n        const canOpenMint = workReady.canMint && workMintReadiness.ready;\n        const currentWorkSaved = currentWorkId !== null && Boolean(\n          getWorkById(readStoredThoughtWorks(), currentWorkId),\n        );\n        return {\n          status: thoughtLaunchState.phase !== \"onchain-open\"\n            ? \"Work ready in Studio\"\n            : workMintReadiness.ready\n              ? \"Work ready\"\n              : workMintReadiness.blockedTitle === \"work needs rerun\"\n                ? \"Work needs rerun\"\n                : \"Mint unavailable\",\n          tone: canOpenMint || thoughtLaunchState.phase !== \"onchain-open\"\n            ? \"success\"\n            : \"warning\",\n          actions: [\n            ...(canOpenMint\n              ? [dockRailAction(\n                  \"mint\",\n                  mintPanelOpen ? \"mint ↓\" : \"mint\",\n                  mintPanelOpen ? \"collapse Mint panel\" : \"mint this accepted THOUGHT work\",\n"]),
  Object.freeze(["launch state delta 8", "const formatPathAcquisitionPrice = (price: bigint) => {\n  return formatPulseAuctionPrice(price);\n};\n\nconst getCurrentMintPresentation = () => presentThoughtMint({\n  state: mintFlowState,\n  mintEnabled: THOUGHT_V2_MINT_ENABLED,\n  work: (() => {\n    const readiness = getCurrentWorkMintReadiness();\n    return readiness.ready\n      ? { ready: true, blockedTitle: \"\", reason: \"\" }\n      : {\n          ready: false,\n", "const formatPathAcquisitionPrice = (price: bigint) => {\n  return formatPulseAuctionPrice(price);\n};\n\nconst getCurrentMintPresentation = () => presentThoughtMint({\n  state: mintFlowState,\n  mintEnabled: isThoughtMintEnabled(),\n  work: (() => {\n    const readiness = getCurrentWorkMintReadiness();\n    return readiness.ready\n      ? { ready: true, blockedTitle: \"\", reason: \"\" }\n      : {\n          ready: false,\n"]),
  Object.freeze(["launch state delta 9", "    kind: mintFlowData.errorKind,\n    message: mintFlowData.error,\n  },\n});\n\nconst recordCurrentMintConsoleState = () => {\n  recordMintConsoleState(\n    getResolvedThoughtDockState(),\n    getCurrentMintPresentation(),\n  );\n};\n\n", "    kind: mintFlowData.errorKind,\n    message: mintFlowData.error,\n  },\n});\n\nconst recordCurrentMintConsoleState = () => {\n  if (thoughtLaunchState.phase !== \"onchain-open\") {\n    return;\n  }\n  recordMintConsoleState(\n    getResolvedThoughtDockState(),\n    getCurrentMintPresentation(),\n  );\n};\n\n"]),
  Object.freeze(["launch state delta 10", "  if (/reject|denied|cancel/i.test(mintFlowData.error)) {\n    return \"transaction rejected.\";\n  }\n  return \"mint failed.\";\n};\n\nconst renderThoughtDock = () => {\n  const state = getResolvedThoughtDockState();\n  const locked = isThoughtDockInputLockedState(state);\n  const mintPresentation = getCurrentMintPresentation();\n\n  thoughtDockPrompt.readOnly = locked;\n", "  if (/reject|denied|cancel/i.test(mintFlowData.error)) {\n    return \"transaction rejected.\";\n  }\n  return \"mint failed.\";\n};\n\nconst syncThoughtLaunchStatus = () => {\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists: Boolean(currentOutputText && currentWorkSvg),\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  thoughtLaunchStatus.dataset.phase = thoughtLaunchState.phase;\n  thoughtLaunchStatus.dataset.environment = thoughtLaunchState.environment;\n  thoughtLaunchStatus.dataset.tone = guidance.tone;\n  thoughtLaunchStatusEyebrow.textContent = guidance.eyebrow;\n  thoughtLaunchStatusTitle.textContent = guidance.title;\n  thoughtLaunchStatusDetail.textContent = guidance.detail;\n  thoughtLaunchStatusMeta.textContent = guidance.meta;\n};\n\nconst renderThoughtDock = () => {\n  const state = getResolvedThoughtDockState();\n  const locked = isThoughtDockInputLockedState(state);\n  const mintPresentation = getCurrentMintPresentation();\n\n  thoughtDockPrompt.readOnly = locked;\n"]),
  Object.freeze(["launch state delta 11", "    thoughtDockActionArea.replaceChildren();\n  } else if (shouldRenderRail || thoughtDockActionArea.childElementCount === 0) {\n    thoughtDockActionArea.replaceChildren(\n      thoughtDockActions(...rail.actions.map(renderDockRailAction)),\n    );\n  }\n  syncMintDockPathPanel();\n  syncWorkLibraryPanel();\n  renderThoughtDockDetails(state, mintPresentation);\n  syncThoughtDockRailInset();\n};\n\n", "    thoughtDockActionArea.replaceChildren();\n  } else if (shouldRenderRail || thoughtDockActionArea.childElementCount === 0) {\n    thoughtDockActionArea.replaceChildren(\n      thoughtDockActions(...rail.actions.map(renderDockRailAction)),\n    );\n  }\n  syncThoughtLaunchStatus();\n  syncMintDockPathPanel();\n  syncWorkLibraryPanel();\n  renderThoughtDockDetails(state, mintPresentation);\n  syncThoughtDockRailInset();\n};\n\n"]),
  Object.freeze(["launch state delta 12", "    title: \"to mint this THOUGHT\",\n    detail: \"Pick a $PATH, sign for this work, then mint.\",\n    tone: \"neutral\",\n    eventId: mintAttemptConsoleEventId(\"mint-flow-opened\"),\n  });\n\n  if (!THOUGHT_V2_MINT_ENABLED) {\n    setMintFlowError(THOUGHT_V2_MINT_UNAVAILABLE_COPY, \"thought\");\n    syncInterface();\n    return;\n  }\n  if (currentCandidate && runState === \"candidate_ready\") {\n    setMintFlowError(\"current candidate is not previewed.\", \"thought\");\n    syncInterface();\n", "    title: \"to mint this THOUGHT\",\n    detail: \"Pick a $PATH, sign for this work, then mint.\",\n    tone: \"neutral\",\n    eventId: mintAttemptConsoleEventId(\"mint-flow-opened\"),\n  });\n\n  if (!isThoughtMintEnabled()) {\n    const guidance = getThoughtLaunchGuidance({\n      state: thoughtLaunchState,\n      workExists: Boolean(currentOutputText && currentWorkSvg),\n      workCompatible: isCurrentWorkLaunchCompatible(),\n      nowMs: Date.now(),\n    });\n    setMintFlowError(guidance.detail, \"thought\");\n    syncInterface();\n    return;\n  }\n  if (currentCandidate && runState === \"candidate_ready\") {\n    setMintFlowError(\"current candidate is not previewed.\", \"thought\");\n    syncInterface();\n"]),
  Object.freeze(["launch state delta 13", ") => {\n  const agentLine = payload.result?.agentLine;\n  if (typeof agentLine !== \"string\") {\n    return { agentLine: \"\" };\n  }\n  assertActiveThoughtLine(agentLine, \"agent\");\n  if (!THOUGHT_V2_MINT_ENABLED) {\n    return { agentLine };\n  }\n\n  const payloadResult = payload.result;\n  const raw = payloadResult?.raw;\n  const rawSha256 = payloadResult?.rawSha256;\n  if (typeof raw !== \"string\" || typeof rawSha256 !== \"string\") {\n    throw new Error(\"Agent result evidence is incomplete.\");\n  }\n  const result = parseThoughtV2LocalAgentResult(raw);\n  const verifiedRawSha256 = agentDemoSha256(raw);\n  if (result.agentLine !== agentLine || verifiedRawSha256 !== rawSha256) {\n", ") => {\n  const agentLine = payload.result?.agentLine;\n  if (typeof agentLine !== \"string\") {\n    return { agentLine: \"\" };\n  }\n  assertActiveThoughtLine(agentLine, \"agent\");\n  const payloadResult = payload.result;\n  const raw = payloadResult?.raw;\n  const rawSha256 = payloadResult?.rawSha256;\n  if (\n    !isThoughtMintEnabled() &&\n    (typeof raw !== \"string\" || typeof rawSha256 !== \"string\")\n  ) {\n    return { agentLine };\n  }\n\n  if (typeof raw !== \"string\" || typeof rawSha256 !== \"string\") {\n    throw new Error(\"Agent result evidence is incomplete.\");\n  }\n  const result = parseThoughtV2LocalAgentResult(raw);\n  const verifiedRawSha256 = agentDemoSha256(raw);\n  if (result.agentLine !== agentLine || verifiedRawSha256 !== rawSha256) {\n"]),
  Object.freeze(["launch state delta 14", "    `preview endpoint: ${cliPreviewEndpointState()}`,\n    `work: ${cliCurrentWorkState()}`,\n    `candidate: ${cliCurrentCandidateState()}`,\n    `preview: ${\n      currentCandidate && runState === \"candidate_ready\"\n        ? currentCandidate.previewStatus\n        : hasCurrentContractWorkSvg()\n          ? \"accepted contract SVG\"\n          : currentCandidate\n            ? currentCandidate.previewStatus\n            : \"missing\"\n    }`,\n    `mintable: ${\n      currentCandidate && runState === \"candidate_ready\"\n        ? \"no\"\n        : hasCurrentContractWorkSvg()\n          ? \"yes, after picking a $PATH and wallet confirmation\"\n          : \"no\"\n    }`,\n    `provenance: ${provenance ? `${provenance.bytes} bytes` : \"empty\"}`,\n  );\n\n", "    `preview endpoint: ${cliPreviewEndpointState()}`,\n    `work: ${cliCurrentWorkState()}`,\n    `candidate: ${cliCurrentCandidateState()}`,\n    `preview: ${\n      currentCandidate && runState === \"candidate_ready\"\n        ? currentCandidate.previewStatus\n        : isCurrentWorkLaunchCompatible()\n          ? \"accepted release preview\"\n          : currentCandidate\n            ? currentCandidate.previewStatus\n            : \"missing\"\n    }`,\n    `mintable: ${\n      currentCandidate && runState === \"candidate_ready\"\n        ? \"no\"\n        : isCurrentWorkLaunchCompatible()\n          ? \"yes, after picking a $PATH and wallet confirmation\"\n          : \"no\"\n    }`,\n    `provenance: ${provenance ? `${provenance.bytes} bytes` : \"empty\"}`,\n  );\n\n"]),
  Object.freeze(["launch state delta 15", "      return;\n    }\n    appendCliError([\"no work to mint.\", \"use: run\"]);\n    return;\n  }\n\n  if (!hasCurrentContractWorkSvg()) {\n    appendCliError([\n      \"current candidate is not previewed.\",\n      \"use: preview retry\",\n    ]);\n    return;\n  }\n", "      return;\n    }\n    appendCliError([\"no work to mint.\", \"use: run\"]);\n    return;\n  }\n\n  if (!isCurrentWorkLaunchCompatible()) {\n    appendCliError([\n      \"current candidate is not previewed.\",\n      \"use: preview retry\",\n    ]);\n    return;\n  }\n"]),
  Object.freeze(["launch state delta 16", "      return false;\n    }\n    appendCliError([\"no work to mint.\", \"use: run\"]);\n    return false;\n  }\n\n  if (!hasCurrentContractWorkSvg()) {\n    appendCliError([\n      \"current candidate is not previewed.\",\n      \"use: preview retry\",\n    ]);\n    return false;\n  }\n", "      return false;\n    }\n    appendCliError([\"no work to mint.\", \"use: run\"]);\n    return false;\n  }\n\n  if (!isCurrentWorkLaunchCompatible()) {\n    appendCliError([\n      \"current candidate is not previewed.\",\n      \"use: preview retry\",\n    ]);\n    return false;\n  }\n"]),
  Object.freeze(["launch state delta 17", "    markInterruptedCliRun();\n  }\n  revokeThoughtInstructionsObjectUrl();\n  revokeColorFontPageRawUrl();\n});\nwindow.addEventListener(\"focus\", () => {\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n  const canSoftRefresh =\n    mintFlowState === \"path_required\" ||\n    mintFlowState === \"path_ready\" ||\n", "    markInterruptedCliRun();\n  }\n  revokeThoughtInstructionsObjectUrl();\n  revokeColorFontPageRawUrl();\n});\nwindow.addEventListener(\"focus\", () => {\n  void refreshThoughtLaunchState().then(() => {\n    syncInterface();\n  });\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n  const canSoftRefresh =\n    mintFlowState === \"path_required\" ||\n    mintFlowState === \"path_ready\" ||\n"]),
  Object.freeze(["launch state delta 18", "document.addEventListener(\"resume\", () => {\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});\nwindow.addEventListener(\"online\", () => {\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});\ndocument.addEventListener(\"keydown\", (event) => {\n    if (\n      event.key === \"Escape\" &&\n      mintFlowUiMode === \"sheet\" &&\n      mintFlowState !== \"closed\"\n    ) {\n", "document.addEventListener(\"resume\", () => {\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});\nwindow.addEventListener(\"online\", () => {\n  void refreshThoughtLaunchState().then(() => {\n    syncInterface();\n  });\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});\nwindow.setInterval(() => {\n  if (\n    thoughtLaunchState.phase === \"onchain-countdown\" &&\n    !frontpageStage.classList.contains(\"is-hidden\")\n  ) {\n    syncThoughtLaunchStatus();\n  }\n}, 1000);\ndocument.addEventListener(\"keydown\", (event) => {\n    if (\n      event.key === \"Escape\" &&\n      mintFlowUiMode === \"sheet\" &&\n      mintFlowState !== \"closed\"\n    ) {\n"]),
  Object.freeze(["launch state delta 19", "    colorFontPage.classList.add(\"is-hidden\");\n    verifyPage.classList.add(\"is-hidden\");\n    await loadThoughtDetail();\n    return;\n  }\n\n  frontpageStage.classList.remove(\"is-hidden\");\n  galleryPage.classList.add(\"is-hidden\");\n  thoughtPage.classList.add(\"is-hidden\");\n  agentDemoPage.classList.add(\"is-hidden\");\n  pluginPage.classList.add(\"is-hidden\");\n  colorFontPage.classList.add(\"is-hidden\");\n", "    colorFontPage.classList.add(\"is-hidden\");\n    verifyPage.classList.add(\"is-hidden\");\n    await loadThoughtDetail();\n    return;\n  }\n\n  await refreshThoughtLaunchState();\n  frontpageStage.classList.remove(\"is-hidden\");\n  galleryPage.classList.add(\"is-hidden\");\n  thoughtPage.classList.add(\"is-hidden\");\n  agentDemoPage.classList.add(\"is-hidden\");\n  pluginPage.classList.add(\"is-hidden\");\n  colorFontPage.classList.add(\"is-hidden\");\n"]),
  Object.freeze(["launch state delta 20", "    );\n  }\n\n  bindThoughtShellWallet();\n  bindWalletProviderEvents();\n  bindPendingMintStorageEvents();\n  await refreshWalletState();\n  const resumedPendingMint = await resumePendingMintTransaction();\n  resumeConflictingMintReceiptMonitoring();\n  let resumedPathMint = false;\n  if (!resumedPendingMint) {\n    resumedPathMint = await resumePathMintHandoff();\n  }\n  if (!resumedPendingMint && !resumedPathMint) {\n    if (mintDockRevealed) {\n      await mintThoughtDockWork();\n    } else {\n      recordCurrentMintConsoleState();\n    }\n    if (\n      restoredDanglingMintRequest &&\n      !pendingMintTransaction &&\n      mintFlowState !== \"minted\" &&\n      mintFlowState !== \"text_taken\"\n    ) {\n      emitThoughtConsoleEvent({\n        kind: \"mint_request_interrupted\",\n        title: \"mint status needs checking\",\n        detail: \"The page reloaded before the wallet returned a transaction hash.\",\n        nextStep: \"check wallet activity before trying again\",\n        tone: \"warning\",\n        eventId: `mint-request-interrupted:${restoredDanglingMintRequest.id}`,\n      });\n    }\n  }\n  syncInterface();\n\n  void ensureActiveThoughtSpec()\n    .then(() => {\n", "    );\n  }\n\n  bindThoughtShellWallet();\n  bindWalletProviderEvents();\n  bindPendingMintStorageEvents();\n  if (isThoughtMintEnabled()) {\n    await refreshWalletState();\n    const resumedPendingMint = await resumePendingMintTransaction();\n    resumeConflictingMintReceiptMonitoring();\n    let resumedPathMint = false;\n    if (!resumedPendingMint) {\n      resumedPathMint = await resumePathMintHandoff();\n    }\n    if (!resumedPendingMint && !resumedPathMint) {\n      if (mintDockRevealed) {\n        await mintThoughtDockWork();\n      } else {\n        recordCurrentMintConsoleState();\n      }\n      if (\n        restoredDanglingMintRequest &&\n        !pendingMintTransaction &&\n        mintFlowState !== \"minted\" &&\n        mintFlowState !== \"text_taken\"\n      ) {\n        emitThoughtConsoleEvent({\n          kind: \"mint_request_interrupted\",\n          title: \"mint status needs checking\",\n          detail: \"The page reloaded before the wallet returned a transaction hash.\",\n          nextStep: \"check wallet activity before trying again\",\n          tone: \"warning\",\n          eventId: `mint-request-interrupted:${restoredDanglingMintRequest.id}`,\n        });\n      }\n    }\n  }\n  syncInterface();\n\n  void ensureActiveThoughtSpec()\n    .then(() => {\n"]),
  Object.freeze(["launch state delta 21", "    ctaLabel: \"chatgpt\",", "    ctaLabel: \"ChatGPT\","]),
  Object.freeze(["launch state delta 22", "    ctaLabel: \"claude\",", "    ctaLabel: \"Claude\","]),
  Object.freeze(["launch state delta 23", "?.ctaLabel ?? \"agent\";", "?.ctaLabel ?? \"Agent\";"]),
  Object.freeze(["launch state delta 24", "            \"send to your agent\",\n            \"Enter a THOUGHT before running with your Agent\",", "            \"send to your Agent\",\n            \"Enter a THOUGHT before running with your Agent\","]),
  Object.freeze(["launch state delta 25", "          dockRailAction(\"send-agent\", \"send to your agent\", \"run this THOUGHT with your Agent\", () => {", "          dockRailAction(\"send-agent\", \"send to your Agent\", \"run this THOUGHT with your Agent\", () => {"]),
  Object.freeze(["launch state delta 26", "const thoughtDockPrompt = document.getElementById(\"thought-dock-prompt\") as HTMLInputElement | null;\nconst thoughtLaunchStatus = document.getElementById(\"thought-launch-status\") as HTMLElement | null;\nconst thoughtLaunchStatusEyebrow = document.getElementById(\n  \"thought-launch-status-eyebrow\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusTitle = document.getElementById(\n  \"thought-launch-status-title\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusDetail = document.getElementById(\n  \"thought-launch-status-detail\",\n) as HTMLElement | null;\nconst thoughtLaunchStatusMeta = document.getElementById(\n  \"thought-launch-status-meta\",\n) as HTMLElement | null;\nconst thoughtDockPath = document.getElementById(\"thought-dock-path\") as HTMLElement | null;", "const thoughtDockPrompt = document.getElementById(\"thought-dock-prompt\") as HTMLInputElement | null;\nconst thoughtDockPath = document.getElementById(\"thought-dock-path\") as HTMLElement | null;"]),
  Object.freeze(["launch state delta 27", "  !thoughtDockPrompt ||\n  !thoughtLaunchStatus ||\n  !thoughtLaunchStatusEyebrow ||\n  !thoughtLaunchStatusTitle ||\n  !thoughtLaunchStatusDetail ||\n  !thoughtLaunchStatusMeta ||\n  !thoughtDockPath ||", "  !thoughtDockPrompt ||\n  !thoughtDockPath ||"]),
  Object.freeze(["launch state delta 28", "const syncThoughtLaunchStatus = () => {\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists: Boolean(currentOutputText && currentWorkSvg),\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  thoughtLaunchStatus.dataset.phase = thoughtLaunchState.phase;\n  thoughtLaunchStatus.dataset.environment = thoughtLaunchState.environment;\n  thoughtLaunchStatus.dataset.tone = guidance.tone;\n  thoughtLaunchStatusEyebrow.textContent = guidance.eyebrow;\n  thoughtLaunchStatusTitle.textContent = guidance.title;\n  thoughtLaunchStatusDetail.textContent = guidance.detail;\n  thoughtLaunchStatusMeta.textContent = guidance.meta;\n};", "const syncThoughtLaunchGuidance = () => {\n  const workExists = Boolean(currentOutputText && currentWorkSvg);\n  const workCompatible = isCurrentWorkLaunchCompatible();\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists,\n    workCompatible,\n    nowMs: Date.now(),\n  });\n  const workState = !workExists\n    ? \"empty\"\n    : workCompatible\n      ? \"compatible\"\n      : \"incompatible\";\n  frontpageStage.dataset.thoughtLaunchPhase = thoughtLaunchState.phase;\n  frontpageStage.dataset.thoughtLaunchEnvironment = thoughtLaunchState.environment;\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_guidance\",\n    title: `${guidance.eyebrow}: ${guidance.title}`,\n    detail: `${guidance.detail} ${guidance.meta}.`,\n    nextStep: thoughtLaunchState.phase === \"studio-preview\"\n      ? \"save completed work in this browser\"\n      : thoughtLaunchState.phase === \"onchain-countdown\"\n        ? \"save completed work and return when Onchain opens\"\n        : workExists && !workCompatible\n          ? \"run this work again with your Agent\"\n          : workExists\n            ? \"continue to mint when ready\"\n            : \"send a prompt to your Agent\",\n    tone: \"warning\",\n    eventId: `thought-launch-guidance:${thoughtLaunchState.phase}:${workState}`,\n  });\n};"]),
  Object.freeze(["launch state delta 29", "  syncThoughtLaunchStatus();\n  syncMintDockPathPanel();", "  syncThoughtLaunchGuidance();\n  syncMintDockPathPanel();"]),
  Object.freeze(["launch state delta 30", "window.addEventListener(\"online\", () => {\n  void refreshThoughtLaunchState().then(() => {\n    syncInterface();\n  });\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});\nwindow.setInterval(() => {\n  if (\n    thoughtLaunchState.phase === \"onchain-countdown\" &&\n    !frontpageStage.classList.contains(\"is-hidden\")\n  ) {\n    syncThoughtLaunchStatus();\n  }\n}, 1000);", "window.addEventListener(\"online\", () => {\n  void refreshThoughtLaunchState().then(() => {\n    syncInterface();\n  });\n  refreshThoughtDockPolling();\n  resumePendingMintReceiptMonitoring();\n  resumeConflictingMintReceiptMonitoring();\n});"]),
  Object.freeze(["launch state delta 31", "          status: thoughtLaunchState.phase !== \"onchain-open\"\n            ? \"Work ready in Studio\"", "          status: thoughtLaunchState.phase !== \"onchain-open\"\n            ? \"Work ready\""]),
  Object.freeze(["launch state delta 32", "    nextStep: thoughtLaunchState.phase === \"studio-preview\"\n      ? \"save completed work in this browser\"\n      : thoughtLaunchState.phase === \"onchain-countdown\"\n        ? \"save completed work and return when Onchain opens\"", "    nextStep: thoughtLaunchState.phase === \"studio-preview\"\n      ? \"save this work in your browser\"\n      : thoughtLaunchState.phase === \"onchain-countdown\"\n        ? \"save this work and return when minting opens\""]),
  Object.freeze(["launch state delta 33", "    eventId: `thought-launch-guidance:${thoughtLaunchState.phase}:${workState}`", "    eventId: `thought-launch-guidance:plain-v1:${thoughtLaunchState.phase}:${workState}`"]),
  Object.freeze(["launch state delta 34", "      reason: \"This work does not match the approved Onchain release. Run it again before minting.\",", "      reason: \"This work was created with an older approved version. Run it again before minting.\","]),
  Object.freeze(["launch state delta 35", "const getThoughtDockRailView = (state: ThoughtDockState): DockRailView => {", "// The mint CTA is always on screen, so it is also where the launch phase\n// explains itself. A visitor learns that minting is not open yet by reaching\n// for it, not from a banner they have to read before they have made anything.\nconst noticeThoughtMintUnavailable = () => {\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists: Boolean(currentOutputText && currentWorkSvg),\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_mint_closed\",\n    title: `${guidance.eyebrow}: ${guidance.title}`,\n    detail: `${guidance.detail} ${guidance.meta}.`,\n    nextStep: isThoughtMintEnabled()\n      ? \"run this work again with your Agent\"\n      : \"save this work in your browser\",\n    tone: \"warning\",\n  });\n};\n\nconst getThoughtDockRailView = (state: ThoughtDockState): DockRailView => {"]),
  Object.freeze(["launch state delta 36", "            ...(canOpenMint\n              ? [dockRailAction(\n                  \"mint\",\n                  mintPanelOpen ? \"mint \u2193\" : \"mint\",\n                  mintPanelOpen ? \"collapse Mint panel\" : \"mint this accepted THOUGHT work\",\n                  () => {\n                    if (mintPanelOpen) {\n                      mintDockRevealed = false;\n                      writeCurrentOutputSession();\n                      syncThoughtDock();\n                      return;\n                    }\n                    revealMintDock();\n                    syncThoughtDock();\n                    void mintThoughtDockWork();\n                  },\n                  { expanded: mintPanelOpen },\n                )]\n              : []),\n", "            dockRailAction(\n              \"mint\",\n              mintPanelOpen ? \"mint \u2193\" : \"mint\",\n              mintPanelOpen ? \"collapse Mint panel\" : \"mint this accepted THOUGHT work\",\n              () => {\n                if (!canOpenMint) {\n                  noticeThoughtMintUnavailable();\n                  syncThoughtDock();\n                  return;\n                }\n                if (mintPanelOpen) {\n                  mintDockRevealed = false;\n                  writeCurrentOutputSession();\n                  syncThoughtDock();\n                  return;\n                }\n                revealMintDock();\n                syncThoughtDock();\n                void mintThoughtDockWork();\n              },\n              { expanded: mintPanelOpen },\n            ),\n"]),
  Object.freeze(["launch state delta 37", "const syncThoughtLaunchGuidance = () => {\n  const workExists = Boolean(currentOutputText && currentWorkSvg);\n  const workCompatible = isCurrentWorkLaunchCompatible();\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists,\n    workCompatible,\n    nowMs: Date.now(),\n  });\n  const workState = !workExists\n    ? \"empty\"\n    : workCompatible\n      ? \"compatible\"\n      : \"incompatible\";\n  frontpageStage.dataset.thoughtLaunchPhase = thoughtLaunchState.phase;\n  frontpageStage.dataset.thoughtLaunchEnvironment = thoughtLaunchState.environment;\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_guidance\",\n    title: `${guidance.eyebrow}: ${guidance.title}`,\n    detail: `${guidance.detail} ${guidance.meta}.`,\n    nextStep: thoughtLaunchState.phase === \"studio-preview\"\n      ? \"save this work in your browser\"\n      : thoughtLaunchState.phase === \"onchain-countdown\"\n        ? \"save this work and return when minting opens\"\n        : workExists && !workCompatible\n          ? \"run this work again with your Agent\"\n          : workExists\n            ? \"continue to mint when ready\"\n            : \"send a prompt to your Agent\",\n    tone: \"warning\",\n    eventId: `thought-launch-guidance:plain-v1:${thoughtLaunchState.phase}:${workState}`,\n  });\n};", "const syncThoughtLaunchPhaseState = () => {\n  frontpageStage.dataset.thoughtLaunchPhase = thoughtLaunchState.phase;\n  frontpageStage.dataset.thoughtLaunchEnvironment = thoughtLaunchState.environment;\n};"]),
  Object.freeze(["launch state delta 38", "  syncThoughtLaunchGuidance();\n  syncMintDockPathPanel();", "  syncThoughtLaunchPhaseState();\n  syncMintDockPathPanel();"]),
  Object.freeze(["launch state delta 39", "const noticeThoughtMintUnavailable = () => {\n  const guidance = getThoughtLaunchGuidance({\n    state: thoughtLaunchState,\n    workExists: Boolean(currentOutputText && currentWorkSvg),\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_mint_closed\",\n    title: `${guidance.eyebrow}: ${guidance.title}`,\n    detail: `${guidance.detail} ${guidance.meta}.`,\n    nextStep: isThoughtMintEnabled()\n      ? \"run this work again with your Agent\"\n      : \"save this work in your browser\",\n    tone: \"warning\",\n  });\n};", "const noticeThoughtMintUnavailable = () => {\n  const notice = getThoughtMintClosedNotice({\n    state: thoughtLaunchState,\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_mint_closed\",\n    title: notice.title,\n    detail: `${notice.detail} ${notice.meta}.`,\n    nextStep: notice.nextStep,\n    tone: \"warning\",\n  });\n};"]),
  Object.freeze(["launch state delta 40", "  getThoughtLaunchGuidance,\n", "  getThoughtLaunchGuidance,\n  getThoughtMintClosedNotice,\n"]),
  Object.freeze(["launch state delta 41", "  const notice = getThoughtMintClosedNotice({\n    state: thoughtLaunchState,\n    workCompatible: isCurrentWorkLaunchCompatible(),\n    nowMs: Date.now(),\n  });\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_mint_closed\",\n    title: notice.title,\n    detail: `${notice.detail} ${notice.meta}.`,\n    nextStep: notice.nextStep,\n    tone: \"warning\",\n  });", "  const notice = getThoughtMintClosedNotice({\n    state: thoughtLaunchState,\n    workCompatible: isCurrentWorkLaunchCompatible(),\n  });\n  emitThoughtConsoleEvent({\n    kind: \"thought_launch_mint_closed\",\n    title: notice.title,\n    detail: notice.detail,\n    nextStep: notice.nextStep,\n    tone: \"warning\",\n  });"]),
  Object.freeze(["launch state delta 42", "    const guidance = getThoughtLaunchGuidance({\n      state: thoughtLaunchState,\n      workExists: Boolean(currentOutputText && currentWorkSvg),\n      workCompatible: isCurrentWorkLaunchCompatible(),\n      nowMs: Date.now(),\n    });\n    return {\n      ready: false,\n      reason: guidance.detail,\n      blockedTitle: \"mint unavailable\",\n    };", "    const notice = getThoughtMintClosedNotice({\n      state: thoughtLaunchState,\n      workCompatible: isCurrentWorkLaunchCompatible(),\n    });\n    return {\n      ready: false,\n      reason: notice.detail,\n      blockedTitle: \"mint unavailable\",\n    };"]),
  Object.freeze(["launch state delta 43", "    const guidance = getThoughtLaunchGuidance({\n      state: thoughtLaunchState,\n      workExists: Boolean(currentOutputText && currentWorkSvg),\n      workCompatible: isCurrentWorkLaunchCompatible(),\n      nowMs: Date.now(),\n    });\n    setMintFlowError(guidance.detail, \"thought\");", "    const notice = getThoughtMintClosedNotice({\n      state: thoughtLaunchState,\n      workCompatible: isCurrentWorkLaunchCompatible(),\n    });\n    setMintFlowError(notice.detail, \"thought\");"]),
  Object.freeze(["launch state delta 44", "  getThoughtLaunchGuidance,\n  getThoughtMintClosedNotice,\n", "  getThoughtMintClosedNotice,\n"]),
  Object.freeze(["launch state delta 45", "      title: `sign ${path} in wallet`,\n      detail: \"Approve the signature request. No transaction or gas.\",", "      title: \"waiting for your signature\",\n      detail: `A signature request for ${path} is open in your wallet. Approve it to continue. No transaction or gas.`,"]),
  Object.freeze(["launch state delta 46", "      title: txHash ? \"THOUGHT mint submitted\" : \"confirm THOUGHT mint in wallet\",\n      detail: txHash\n        ? shortHex(txHash, 10, 8)\n        : \"Open your wallet and confirm the transaction. Gas applies.\",", "      title: txHash ? \"THOUGHT mint submitted\" : \"waiting for your confirmation\",\n      detail: txHash\n        ? shortHex(txHash, 10, 8)\n        : \"A THOUGHT mint transaction is open in your wallet. Confirm it to continue. Gas applies.\","]),
  Object.freeze(["launch state delta 47", "        title: \"approve wallet connection\",\n        detail: \"Open your wallet and approve the connection. No signature or transaction.\",", "        title: \"waiting for your wallet\",\n        detail: \"A connection request is open in your wallet. Approve it to continue. No signature or transaction.\","]),
  Object.freeze(["launch state delta 48", "      title: \"approve wallet connection\",\n      detail: \"Open your wallet and approve the connection. No signature or transaction.\",", "      title: \"waiting for your wallet\",\n      detail: \"A connection request is open in your wallet. Approve it to continue. No signature or transaction.\","]),
  Object.freeze(["launch state delta 49", "    title: \"confirm $PATH mint in wallet\",\n    detail: \"Open your wallet and confirm the transaction. Gas applies.\",", "    title: \"waiting for your confirmation\",\n    detail: \"A $PATH mint transaction is open in your wallet. Confirm it to continue. Gas applies.\","]),
  Object.freeze(["launch state delta 50", "      title: \"close the previous wallet request\",\n      detail: \"No transaction was found. Cancel or reject the previous request in your wallet before retrying.\",", "      title: \"a previous wallet request is still open\",\n      detail: \"No transaction was found. Cancel or reject the earlier request in your wallet before retrying.\","]),
  Object.freeze(["launch state delta 51", "      detail: \"Choose an Agent available on this machine to receive the prompt.\",", "      detail: \"Only Agents installed on this machine can receive the prompt.\","]),
  Object.freeze(["launch state delta 52", "const thoughtDockAgentLifecycleTitle = (adapterId: ThoughtDockAgentAdapterId, remoteState?: string | null) =>\n  thoughtDockAgentLifecycleStatus(adapterId, remoteState).replace(/\\.\\.\\.$/, \"\");", "const thoughtDockAgentLifecycleTitle = (adapterId: ThoughtDockAgentAdapterId, remoteState?: string | null) =>\n  thoughtDockAgentLifecycleStatus(adapterId, remoteState).replace(/\\.\\.\\.$/, \"\");\n\n// Each lifecycle state needs its own detail. A shared line made distinct states\n// read as one repeated event, and restating the product name added nothing the\n// title had not already said.\nconst thoughtDockAgentLifecycleDetail = (remoteState?: string | null) => {\n  switch (remoteState) {\n    case \"claimed\":\n      return \"It has the prompt and is starting.\";\n    case \"ready\":\n      return \"It is preparing the work.\";\n    case \"running\":\n      return \"It is writing the work now.\";\n    case \"returned\":\n      return \"The returned work is being checked.\";\n    default:\n      return \"The task has been sent and is not accepted yet.\";\n  }\n};"]),
  Object.freeze(["launch state delta 53", "        : `${product} is working on this THOUGHT task.`,", "        : thoughtDockAgentLifecycleDetail(state.run.remoteState),"]),
  Object.freeze(["launch state delta 54", "      title: \"Agent request unavailable\",\n      detail: \"This Agent request cannot continue.\",", "      title: \"Agent request unavailable\",\n      detail: \"The App could not reach it on this machine.\","]),
  Object.freeze(["launch state delta 55", "      title: \"Agent request expired\",\n      detail: \"This Agent request cannot continue.\",", "      title: \"Agent request expired\",\n      detail: \"It was not accepted in time.\","]),
  Object.freeze(["launch state delta 56", "    detail: `${thoughtAgentProductLabel(adapterId)} does not expose a supported App link yet.`,", "    detail: \"It does not expose a supported App link yet.\","]),
  Object.freeze(["launch state delta 57", "      detail: `Match code ${state.authorization.verificationCode || \"------\"} with ${product}, then select \u201callow ${product.toLowerCase()}\u201d above.`,", "      detail: `Match code ${state.authorization.verificationCode || \"------\"} with ${product}, then allow it above.`,"]),
  Object.freeze(["launch state delta 58", "        detail: `Match code ${state.authorization.verificationCode || \"------\"} with ${product}, then allow it above.`,\n        tone: \"neutral\",", "        detail: `Match code ${state.authorization.verificationCode || \"------\"} with ${product}.`,\n        nextStep: `allow ${product.toLowerCase()} above`,\n        tone: \"neutral\","]),
  Object.freeze(["launch state delta 59", "      title: \"choose an Agent\",", "      title: \"Choose an Agent\","]),
  Object.freeze(["launch state delta 60", "        title: `allow ${product}`,", "        title: `Allow ${product}`,"]),
  Object.freeze(["launch state delta 61", "        nextStep: `allow ${product.toLowerCase()} above`,", "        nextStep: `Allow ${product.toLowerCase()} above`,"]),
  Object.freeze(["launch state delta 62", "        title: `authorizing ${product}`,", "        title: `Authorizing ${product}`,"]),
  Object.freeze(["launch state delta 63", "        ? { nextStep: `keep this page open while ${product} creates` }", "        ? { nextStep: `Keep this page open while ${product} creates` }"]),
  Object.freeze(["launch state delta 64", "        ? { nextStep: `keep this page open while ${product} connects` }\n        : { nextStep: `keep this page open while ${product} finishes` }),", "        ? { nextStep: `Keep this page open while ${product} connects` }\n        : { nextStep: `Keep this page open while ${product} finishes` }),"]),
  Object.freeze(["launch state delta 65", "      nextStep: \"canonical artwork preview is unavailable in this environment\",", "      nextStep: \"Canonical artwork preview is unavailable in this environment\","]),
  Object.freeze(["launch state delta 66", "      title: state.issue?.title ?? (textTooLong ? \"text too long\" : \"work rejected\"),", "      title: state.issue?.title ?? (textTooLong ? \"Text too long\" : \"Work rejected\"),"]),
  Object.freeze(["launch state delta 67", "      detail: \"It was not accepted in time.\",\n      nextStep: \"start a new Agent run\",\n      tone: \"error\",", "      detail: \"It was not accepted in time.\",\n      nextStep: \"Start a new Agent run\",\n      tone: \"error\","]),
  Object.freeze(["launch state delta 68", "            nextStep: \"start a new Agent run\",", "            nextStep: \"Start a new Agent run\","]),
  Object.freeze(["launch state delta 69", "  action.textContent = \"[ try again ]\";\n  action.setAttribute(\"aria-label\", \"start a new Agent run\");", "  action.textContent = \"[ Try again ]\";\n  action.setAttribute(\"aria-label\", \"Start a new Agent run\");"]),
  Object.freeze(["launch state delta 70", "      return \"try preview again\";", "      return \"Try preview again\";"]),
  Object.freeze(["launch state delta 71", "      return \"reset, then send the prompt to your Agent again\";", "      return \"Reset, then send the prompt to your Agent again\";"]),
  Object.freeze(["launch state delta 72", "    case \"work_failed\":\n      return \"reset and send the prompt to your Agent again\";\n    case \"work_run_expired\":", "    case \"work_failed\":\n      return \"Reset and send the prompt to your Agent again\";\n    case \"work_run_expired\":"]),
  Object.freeze(["launch state delta 73", "      return \"start a new Agent run\";", "      return \"Start a new Agent run\";"]),
  Object.freeze(["launch state delta 74", "    case \"work_blocked\":\n      return \"reset and send the prompt to your Agent again\";\n    case \"wallet_connection_failed\":", "    case \"work_blocked\":\n      return \"Reset and send the prompt to your Agent again\";\n    case \"wallet_connection_failed\":"]),
  Object.freeze(["launch state delta 75", "      return \"try the wallet connection again\";", "      return \"Try the wallet connection again\";"]),
  Object.freeze(["launch state delta 76", "      return \"wait for the original transaction; do not mint again\";", "      return \"Wait for the original transaction; do not mint again\";"]),
  Object.freeze(["launch state delta 77", "      return \"wait while both transactions are checked; do not mint again\";", "      return \"Wait while both transactions are checked; do not mint again\";"]),
  Object.freeze(["launch state delta 78", "      return \"open the browser tab where you submitted the mint; do not mint again here\";", "      return \"Open the browser tab where you submitted the mint; do not mint again here\";"]),
  Object.freeze(["launch state delta 79", "      return \"check your wallet before trying again\";", "      return \"Check your wallet before trying again\";"]),
  Object.freeze(["launch state delta 80", "      return \"create or load a completed work, then select save\";", "      return \"Create or load a completed work, then select save\";"]),
  Object.freeze(["launch state delta 81", "    return \"resolve the open wallet request\";", "    return \"Resolve the open wallet request\";"]),
  Object.freeze(["launch state delta 82", "    return \"install or enable a wallet\";", "    return \"Install or enable a wallet\";"]),
  Object.freeze(["launch state delta 83", "    return \"switch to the $PATH owner account, then refresh wallet from the shell bar\";", "    return \"Switch to the $PATH owner account, then refresh wallet from the shell bar\";"]),
  Object.freeze(["launch state delta 84", "    return \"switch to the THOUGHT network, then refresh wallet from the shell bar\";", "    return \"Switch to the THOUGHT network, then refresh wallet from the shell bar\";"]),
  Object.freeze(["launch state delta 85", "    return \"open the wallet menu and select refresh\";", "    return \"Open the wallet menu and select refresh\";"]),
  Object.freeze(["launch state delta 86", "    return \"mint a $PATH, then select refresh in the wallet menu\";", "    return \"Mint a $PATH, then select refresh in the wallet menu\";"]),
  Object.freeze(["launch state delta 87", "    return \"pick another $PATH or select refresh in the wallet menu\";", "    return \"Pick another $PATH or select refresh in the wallet menu\";"]),
  Object.freeze(["launch state delta 88", "      title: \"continue on desktop\",", "      title: \"Continue on desktop\","]),
  Object.freeze(["launch state delta 89", "      title: readiness.ready ? \"ready to mint\" : \"run this work again\",", "      title: readiness.ready ? \"Ready to mint\" : \"Run this work again\","]),
  Object.freeze(["launch state delta 90", "      title: \"waiting for your signature\",", "      title: \"Waiting for your signature\","]),
  Object.freeze(["launch state delta 91", "      title: txHash ? \"THOUGHT mint submitted\" : \"waiting for your confirmation\",", "      title: txHash ? \"THOUGHT mint submitted\" : \"Waiting for your confirmation\","]),
  Object.freeze(["launch state delta 92", "    dockRailAction(\"reset\", \"reset\", \"reset THOUGHT Dock and clear input\", () => {", "    dockRailAction(\"reset\", \"Reset\", \"Reset THOUGHT Dock and clear input\", () => {"]),
  Object.freeze(["launch state delta 93", "    dockRailAction(\"cancel\", \"cancel\", \"cancel Agent selection\", () => {", "    dockRailAction(\"cancel\", \"Cancel\", \"Cancel Agent selection\", () => {"]),
  Object.freeze(["launch state delta 94", "      loadPanelOpen ? \"load \u2193\" : \"load\",\n      loadPanelOpen ? \"collapse saved works\" : \"open saved works\",", "      loadPanelOpen ? \"Load \u2193\" : \"Load\",\n      loadPanelOpen ? \"Collapse saved works\" : \"Open saved works\","]),
  Object.freeze(["launch state delta 95", "            title: \"load a saved work\",", "            title: \"Load a saved work\","]),
  Object.freeze(["launch state delta 96", "    dockRailAction(\"new-thought\", \"new thought\", \"start a new THOUGHT\", () => {", "    dockRailAction(\"new-thought\", \"New thought\", \"Start a new THOUGHT\", () => {"]),
  Object.freeze(["launch state delta 97", "            \"send to your Agent\",", "            \"Send to your Agent\","]),
  Object.freeze(["launch state delta 98", "          dockRailAction(\"send-agent\", \"send to your Agent\", \"run this THOUGHT with your Agent\", () => {", "          dockRailAction(\"send-agent\", \"Send to your Agent\", \"Run this THOUGHT with your Agent\", () => {"]),
  Object.freeze(["launch state delta 99", "                `allow ${state.adapterId}`,\n                `allow ${product} claim ${code}`,", "                `Allow ${state.adapterId}`,\n                `Allow ${product} claim ${code}`,"]),
  Object.freeze(["launch state delta 100", "          dockRailAction(\"retry\", \"retry\", \"retry preview\", () => {", "          dockRailAction(\"retry\", \"Retry\", \"Retry preview\", () => {"]),
  Object.freeze(["launch state delta 101", "              mintPanelOpen ? \"mint \u2193\" : \"mint\",\n              mintPanelOpen ? \"collapse Mint panel\" : \"mint this accepted THOUGHT work\",", "              mintPanelOpen ? \"Mint \u2193\" : \"Mint\",\n              mintPanelOpen ? \"Collapse Mint panel\" : \"Mint this accepted THOUGHT work\","]),
  Object.freeze(["launch state delta 102", "              currentWorkSaved ? \"saved\" : \"save\",\n              currentWorkSaved ? \"current work is saved\" : \"save current work\",", "              currentWorkSaved ? \"Saved\" : \"Save\",\n              currentWorkSaved ? \"Current work is saved\" : \"Save current work\","]),
  Object.freeze(["launch state delta 103", "          dockRailAction(\"view\", \"view\", \"view minted THOUGHT\", () => {", "          dockRailAction(\"view\", \"View\", \"View minted THOUGHT\", () => {"]),
  Object.freeze(["launch state delta 104", "            currentWorkSaved ? \"saved\" : \"save\",\n            currentWorkSaved ? \"current work is saved\" : \"save current work\",", "            currentWorkSaved ? \"Saved\" : \"Save\",\n            currentWorkSaved ? \"Current work is saved\" : \"Save current work\","]),
  Object.freeze(["launch state delta 105", "    title: \"the work is created by you\",", "    title: \"The work is created by you\","]),
  Object.freeze(["launch state delta 106", "    kind: \"work_agent_mobile_desktop_required\",\n    title: \"continue on desktop\",\n    detail: \"Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.\",", "    kind: \"work_agent_mobile_desktop_required\",\n    title: \"Continue on desktop\",\n    detail: \"Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.\","]),
  Object.freeze(["launch state delta 107", "        nextStep: \"wait for an earlier run to finish, then send the prompt again\",", "        nextStep: \"Wait for an earlier run to finish, then send the prompt again\","]),
  Object.freeze(["launch state delta 108", "      title: \"run this work again\",", "      title: \"Run this work again\","]),
  Object.freeze(["launch state delta 109", "    title: \"work reset\",", "    title: \"Work reset\","]),
  Object.freeze(["launch state delta 110", "    title: pending ? \"THOUGHT mint pending\" : \"wallet request still open\",", "    title: pending ? \"THOUGHT mint pending\" : \"Wallet request still open\","]),
  Object.freeze(["launch state delta 111", "      detail: \"No signature was created. No transaction or gas.\",\n      nextStep: \"select \u201cTry again\u201d, or pick another $PATH\",\n      tone: \"warning\",", "      detail: \"No signature was created. No transaction or gas.\",\n      nextStep: \"Select \u201cTry again\u201d, or pick another $PATH\",\n      tone: \"warning\","]),
  Object.freeze(["launch state delta 112", "        : `No transaction was submitted, and ${path} was not used.`,\n      nextStep: \"select \u201cTry again\u201d, or pick another $PATH\",\n      tone: \"warning\",", "        : `No transaction was submitted, and ${path} was not used.`,\n      nextStep: \"Select \u201cTry again\u201d, or pick another $PATH\",\n      tone: \"warning\","]),
  Object.freeze(["launch state delta 113", "  placeholder.textContent = \"pick a $PATH\";", "  placeholder.textContent = \"Pick a $PATH\";"]),
  Object.freeze(["launch state delta 114", "    title.textContent = \"checking $PATH\";\n    detail.textContent = \"reading wallet $PATH tokens.\";", "    title.textContent = \"Checking $PATH\";\n    detail.textContent = \"Reading wallet $PATH tokens.\";"]),
  Object.freeze(["launch state delta 115", "  mintSheetTitle.textContent = \"mint THOUGHT\";", "  mintSheetTitle.textContent = \"Mint THOUGHT\";"]),
  Object.freeze(["launch state delta 116", "  thoughtDockWorksLabel.textContent = \"load a saved work\";", "  thoughtDockWorksLabel.textContent = \"Load a saved work\";"]),
  Object.freeze(["launch state delta 117", "  placeholder.textContent = works.length ? \"load a saved work\" : \"no saved works\";", "  placeholder.textContent = works.length ? \"Load a saved work\" : \"No saved works\";"]),
  Object.freeze(["launch state delta 118", "      title: \"wallet connection canceled\",", "      title: \"Wallet connection canceled\","]),
  Object.freeze(["launch state delta 119", "      nextStep: \"select \u201cConnect wallet\u201d when ready\",", "      nextStep: \"Select \u201cConnect wallet\u201d when ready\","]),
  Object.freeze(["launch state delta 120", "      title: \"wallet request already open\",", "      title: \"Wallet request already open\","]),
  Object.freeze(["launch state delta 121", "    title: \"wallet did not connect\",", "    title: \"Wallet did not connect\","]),
  Object.freeze(["launch state delta 122", "        title: \"waiting for your wallet\",", "        title: \"Waiting for your wallet\","]),
  Object.freeze(["launch state delta 123", "      kind: \"wallet_connection_requested\",\n      title: \"waiting for your wallet\",\n      detail: \"A connection request is open in your wallet. Approve it to continue. No signature or transaction.\",", "      kind: \"wallet_connection_requested\",\n      title: \"Waiting for your wallet\",\n      detail: \"A connection request is open in your wallet. Approve it to continue. No signature or transaction.\","]),
  Object.freeze(["launch state delta 124", "    nextStep: \"select \u201cSwitch network\u201d when ready\",", "    nextStep: \"Select \u201cSwitch network\u201d when ready\","]),
  Object.freeze(["launch state delta 125", "      title: \"wallet disconnected\",", "      title: \"Wallet disconnected\","]),
  Object.freeze(["launch state delta 126", "    title: \"to mint this THOUGHT\",", "    title: \"To mint this THOUGHT\","]),
  Object.freeze(["launch state delta 127", "    title: \"one mint transaction failed\",", "    title: \"One mint transaction failed\","]),
  Object.freeze(["launch state delta 128", "        title: \"more than one mint transaction found\",", "        title: \"More than one mint transaction found\","]),
  Object.freeze(["launch state delta 129", "      title: \"check the earlier mint\",", "      title: \"Check the earlier mint\","]),
  Object.freeze(["launch state delta 130", "    title: \"returned from $PATH mint\",", "    title: \"Returned from $PATH mint\","]),
  Object.freeze(["launch state delta 131", "                  title: \"detached wallet request closed\",", "                  title: \"Detached wallet request closed\","]),
  Object.freeze(["launch state delta 132", "      title: \"a previous wallet request is still open\",", "      title: \"A previous wallet request is still open\","]),
  Object.freeze(["launch state delta 133", "      nextStep: \"cancel the previous wallet request, then select \u201cI closed it\u201d\",", "      nextStep: \"Cancel the previous wallet request, then select \u201cI closed it\u201d\","]),
  Object.freeze(["launch state delta 134", "    title: \"previous mint may still be open\",", "    title: \"Previous mint may still be open\","]),
  Object.freeze(["launch state delta 135", "    title: \"ready to retry\",", "    title: \"Ready to retry\","]),
  Object.freeze(["launch state delta 136", "    nextStep: \"select \u201cTry again\u201d\",", "    nextStep: \"Select \u201cTry again\u201d\","]),
  Object.freeze(["launch state delta 137", "    title: \"new $PATH not visible yet\",", "    title: \"New $PATH not visible yet\","]),
  Object.freeze(["launch state delta 138", "    nextStep: \"open the wallet menu and select refresh\",", "    nextStep: \"Open the wallet menu and select refresh\","]),
  Object.freeze(["launch state delta 139", "      nextStep: \"restore the original wallet and work\",", "      nextStep: \"Restore the original wallet and work\","]),
  Object.freeze(["launch state delta 140", "    title: \"waiting for your confirmation\",", "    title: \"Waiting for your confirmation\","]),
  Object.freeze(["launch state delta 141", "    title: \"old local mint archived\",", "    title: \"Old local mint archived\","]),
  Object.freeze(["launch state delta 142", "    nextStep: \"select mint and use THOUGHT Anvil\",", "    nextStep: \"Select mint and use THOUGHT Anvil\","]),
  Object.freeze(["launch state delta 143", "      title: \"nothing to save\",", "      title: \"Nothing to save\","]),
  Object.freeze(["launch state delta 144", "    title: \"work saved\",", "    title: \"Work saved\","]),
  Object.freeze(["launch state delta 145", "  label.textContent = \"next:\";", "  label.textContent = \"Next:\";"]),
  Object.freeze(["launch state delta 146", "    title: \"work loaded\",", "    title: \"Work loaded\","]),
  Object.freeze(["launch state delta 147", "          title: \"mint status needs checking\",", "          title: \"Mint status needs checking\","]),
  Object.freeze(["launch state delta 148", "          nextStep: \"check wallet activity before trying again\",", "          nextStep: \"Check wallet activity before trying again\","]),
  Object.freeze(["launch state delta 149", "    const textTooLong = state.issue?.title === \"text too long\" || state.reasonCode === 3;", "    const textTooLong = state.issue?.title?.toLowerCase() === \"text too long\" || state.reasonCode === 3;"]),
  Object.freeze(["launch state delta 150", "    kind: issue.title === \"text too long\" ? \"work_prompt_too_long\" : \"work_prompt_invalid\",", "    kind: issue.title.toLowerCase() === \"text too long\" ? \"work_prompt_too_long\" : \"work_prompt_invalid\","]),
  Object.freeze(["launch state delta 151", "    return { provider: null, reason: \"preview is off.\" };", "    return { provider: null, reason: \"Preview is off.\" };"]),
  Object.freeze(["launch state delta 152", "      : { provider: null, reason: \"local THOUGHT V2 unavailable.\" };", "      : { provider: null, reason: \"Local THOUGHT V2 unavailable.\" };"]),
  Object.freeze(["deployment integrity v2 1","import { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";","import { assertDeploymentOverrides, THOUGHT_ACTIVATION_POLICY, THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";"]),
  Object.freeze(["deployment integrity v2 2","const THOUGHT_LAUNCH_DEPLOYMENT: ThoughtLaunchDeployment | null =\n  THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&\n  THOUGHT_V2_PRODUCTION_DEPLOYMENT &&\n  PATH_AUCTION_ADDRESS","if (!IS_DEV_MODE) assertDeploymentOverrides(import.meta.env);\nconst THOUGHT_MINT_ACTIVATION_APPROVED =\n  THOUGHT_ACTIVATION_POLICY.frontendActivationApproved &&\n  THOUGHT_ACTIVATION_POLICY.signerActivationApproved &&\n  THOUGHT_ACTIVATION_POLICY.mintActivationApproved &&\n  THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled;\nconst THOUGHT_LAUNCH_DEPLOYMENT: ThoughtLaunchDeployment | null =\n  THOUGHT_V2_PRODUCTION_DEPLOYMENT"]),
  Object.freeze(["deployment integrity v2 3","        pulseAuction: PATH_AUCTION_ADDRESS,\n      }\n    : null;","        pulseAuction: THOUGHT_V2_PRODUCTION_DEPLOYMENT.contracts.pulseAuction,\n      }\n    : null;"]),
  Object.freeze(["deployment integrity v2 4","        deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n        readModel: null,","        deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n        activationApproved: THOUGHT_MINT_ACTIVATION_APPROVED,\n        readModel: null,"]),
  Object.freeze(["deployment integrity v2 5","    deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n    readModel,","    deployment: THOUGHT_LAUNCH_DEPLOYMENT,\n    activationApproved: THOUGHT_MINT_ACTIVATION_APPROVED,\n    readModel,"]),
  Object.freeze(["deployment selected config v2 0","import { assertDeploymentOverrides, THOUGHT_ACTIVATION_POLICY, THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";","import { assertDeploymentConfiguration, assertDeploymentOverrides, THOUGHT_ACTIVATION_POLICY, THOUGHT_V2_PRODUCTION_DEPLOYMENT } from \"./thought-v2-production-deployment\";"]),
  Object.freeze(["deployment selected config v2 1","if (!IS_DEV_MODE) assertDeploymentOverrides(import.meta.env);","if (!IS_DEV_MODE) assertDeploymentOverrides(import.meta.env);\nif (!IS_LOCAL_THOUGHT_V2 && THOUGHT_V2_PRODUCTION_DEPLOYMENT) {\n  const selected = THOUGHT_V2_PRODUCTION_DEPLOYMENT;\n  assertDeploymentConfiguration({\n    ...selected, chainId: THOUGHT_CHAIN_ID,\n    contracts: { ...selected.contracts, pathNft: PATH_NFT_ADDRESS.toLowerCase(),\n      thoughtNft: THOUGHT_NFT_ADDRESS.toLowerCase(),\n      pulseAuction: PATH_AUCTION_ADDRESS.toLowerCase(),\n      pathPulseAdapter: PATH_PULSE_ADAPTER_ADDRESS.toLowerCase() },\n  });\n}"]),
  Object.freeze(["studio dev deployment override validation", "if (!IS_DEV_MODE) assertDeploymentOverrides(import.meta.env);", "if (!IS_LOCAL_THOUGHT_V2) assertDeploymentOverrides(import.meta.env);"]),
  Object.freeze(["launch state delta 153", "  galleryStatus.textContent = thoughts.length === 0 ? \"no minted THOUGHTs yet.\" : `${thoughts.length} minted THOUGHT${thoughts.length === 1 ? \"\" : \"s\"}.`;", "  galleryStatus.textContent = thoughts.length === 0 ? \"The gallery is ready for its first THOUGHT.\" : `${thoughts.length} minted THOUGHT${thoughts.length === 1 ? \"\" : \"s\"}.`;"]),
  Object.freeze(["launch state delta 154", "    galleryStatus.textContent = \"Current THOUGHT collection is not deployed.\";", "    galleryStatus.textContent = \"The gallery is ready for its first THOUGHT.\";"]),
  Object.freeze(["launch state delta 155", "    thoughtDetailStatus.textContent = \"Current THOUGHT collection is not deployed.\";", "    thoughtDetailStatus.textContent = \"THOUGHT details begin with the first work.\";"]),
  Object.freeze([
    "launch state delta 156",
    `const isThoughtMintEnabled = () => thoughtLaunchState.mintEnabled;`,
    `const isThoughtMintEnabled = () => thoughtLaunchState.mintEnabled;
const shouldShowThoughtMintSurface = () =>
  thoughtLaunchState.phase !== "studio-preview";`,
  ]),
  Object.freeze([
    "launch state delta 157",
    `        const mintPanelOpen = mintDockRevealed;`,
    `        const showMintSurface = shouldShowThoughtMintSurface();
        const mintPanelOpen = showMintSurface && mintDockRevealed;`,
  ]),
  Object.freeze([
    "launch state delta 160",
    `  if (hasOutput) {
    if (!THOUGHT_RPC_URL || !THOUGHT_NFT_ADDRESS) {`,
    `  if (hasOutput) {
    if (!shouldShowThoughtMintSurface()) {
      action = {
        primaryLabel: "",
        primaryDisabled: true,
        primaryAction: "none",
        status: "",
        secondaryLabel: "[ reset ]",
        secondaryAction: "reset",
        hidePrimary: true,
      };
      return applyDebugStatusOverride(action);
    }

    if (!THOUGHT_RPC_URL || !THOUGHT_NFT_ADDRESS) {`,
  ]),
  Object.freeze([
    "launch state delta 161",
    `  const isVisible = mintDockRevealed;`,
    `  const isVisible = shouldShowThoughtMintSurface() && mintDockRevealed;`,
  ]),
  Object.freeze([
    "launch state delta 162",
    `  mintDockRevealed = stored.mintDockRevealed;`,
    `  mintDockRevealed = shouldShowThoughtMintSurface() && stored.mintDockRevealed;`,
  ]),
  Object.freeze([
    "launch state delta 163",
    `const renderThoughtConsoleHistory = (state: ThoughtDockState) => {
  const newestEntry = thoughtConsoleHistory.entries.at(-1);
  const runRecoveryEntryId = [...thoughtConsoleHistory.entries]`,
    `const isStudioPreviewOnchainConsoleEntry = (entry: ThoughtConsoleEntry) =>
  entry.kind !== "thought_launch_mint_closed" &&
  /^(?:authorization_|conflicting_mint|detached_mint|legacy_local_mint|mint_|minted$|multiple_mint|path_|pending_mint|thought_exists$|thought_launch_mint|transaction_|wallet_)/.test(
    entry.kind,
  );

const renderThoughtConsoleHistory = (state: ThoughtDockState) => {
  const visibleHistoryEntries = shouldShowThoughtMintSurface()
    ? thoughtConsoleHistory.entries
    : thoughtConsoleHistory.entries.filter(
        (entry) => !isStudioPreviewOnchainConsoleEntry(entry),
      );
  const newestEntry = visibleHistoryEntries.at(-1);
  const runRecoveryEntryId = [...visibleHistoryEntries]`,
  ]),
  Object.freeze([
    "launch state delta 164",
    `  const entries = newestFirstThoughtConsoleEntries(thoughtConsoleHistory.entries)`,
    `  const entries = newestFirstThoughtConsoleEntries(visibleHistoryEntries)`,
  ]),
  Object.freeze([
    "launch state delta 165",
    `mountThoughtShell(thoughtShellRoot, THOUGHT_CHAIN_ID, () => refreshThoughtWalletFromShell());`,
    `mountThoughtShell(
  thoughtShellRoot,
  THOUGHT_CHAIN_ID,
  () => refreshThoughtWalletFromShell(),
  thoughtLaunchState.phase === "studio-preview",
);`,
  ]),
  Object.freeze([
    "launch state delta 166",
    `  galleryStatus.textContent = thoughts.length === 0 ? "The gallery is ready for its first THOUGHT." : \`${"${thoughts.length}"} minted THOUGHT${"${thoughts.length === 1 ? \"\" : \"s\"}"}.\`;`,
    `  galleryStatus.textContent = thoughts.length === 0 ? "Create and save the first THOUGHT in this browser." : \`${"${thoughts.length}"} minted THOUGHT${"${thoughts.length === 1 ? \"\" : \"s\"}"}.\`;`,
  ]),
  Object.freeze([
    "launch state delta 167",
    `    galleryStatus.textContent = "The gallery is ready for its first THOUGHT.";`,
    `    galleryStatus.textContent = "Studio Preview · Create and save a THOUGHT in this browser.";`,
  ]),
  Object.freeze([
    "launch state delta 168",
    `    thoughtDetailStatus.textContent = "THOUGHT details begin with the first work.";`,
    `    thoughtDetailStatus.textContent = "Studio Preview · Onchain THOUGHT details will appear here after minting opens.";`,
  ]),
  Object.freeze([
    "launch state delta 169",
    `  getThoughtMintClosedNotice,
  localThoughtLaunchState,
  parseThoughtLaunchReadModel,`,
    `  getThoughtMintClosedNotice,
  parseThoughtLaunchReadModel,`,
  ]),
  Object.freeze([
    "launch state delta 170",
    `let thoughtLaunchState: ThoughtLaunchState =
  simulatedThoughtLaunchState() ??
  (IS_LOCAL_THOUGHT_V2
    ? localThoughtLaunchState(THOUGHT_CHAIN_ID)
    : deriveThoughtLaunchState({
        deployment: THOUGHT_LAUNCH_DEPLOYMENT,
        activationApproved: THOUGHT_MINT_ACTIVATION_APPROVED,
        readModel: null,
      }));`,
    `let thoughtLaunchState: ThoughtLaunchState =
  simulatedThoughtLaunchState() ??
  deriveThoughtLaunchState({
    deployment: THOUGHT_LAUNCH_DEPLOYMENT,
    activationApproved: THOUGHT_MINT_ACTIVATION_APPROVED,
    readModel: null,
  });`,
  ]),
  Object.freeze([
    "launch state delta 171",
    `const IS_THOUGHT_GALLERY_ACTIVE =
  IS_LOCAL_THOUGHT_V2 || THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null;`,
    `const IS_THOUGHT_GALLERY_ACTIVE =
  THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null;`,
  ]),
  Object.freeze([
    "launch state delta 172",
    `      detail: "Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",`,
    `      detail: thoughtLaunchState.phase === "studio-preview"
        ? "ChatGPT and Claude creation require the desktop THOUGHT App. Open this page on desktop to create and save a THOUGHT."
        : "ChatGPT and Claude creation require the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",`,
  ]),
  Object.freeze([
    "launch state delta 173",
    `    detail: "Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",`,
    `    detail: thoughtLaunchState.phase === "studio-preview"
      ? "ChatGPT and Claude creation require the desktop THOUGHT App. Open this page on desktop to create and save a THOUGHT."
      : "ChatGPT and Claude creation require the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",`,
  ]),
  Object.freeze([
    "launch state delta 174",
    `const preflightCurrentThoughtExistence = async () => {
  if (!currentOutputText || runState !== "output_ready") {`,
    `const preflightCurrentThoughtExistence = async () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return;
  }
  if (!currentOutputText || runState !== "output_ready") {`,
  ]),
  Object.freeze([
    "launch state delta 175",
    `const syncEmptyFrameStyleFromContract = async () => {
  if (!IS_LOCAL_THOUGHT_V2 || !THOUGHT_RENDERER_ADDRESS) {`,
    `const syncEmptyFrameStyleFromContract = async () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return;
  }
  if (!IS_LOCAL_THOUGHT_V2 || !THOUGHT_RENDERER_ADDRESS) {`,
  ]),
  Object.freeze([
    "launch state delta 176",
    `const currentOutputSessionIsMinted = async () => {
  const stored = readCurrentOutputSession();`,
    `const currentOutputSessionIsMinted = async () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return false;
  }
  const stored = readCurrentOutputSession();`,
  ]),
  Object.freeze([
    "launch state delta 177",
    `const getReadProvider = () => {
  if (!THOUGHT_RPC_URL) {`,
    `const getReadProvider = () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return null;
  }
  if (!THOUGHT_RPC_URL) {`,
  ]),
  Object.freeze([
    "launch state delta 178",
    `const getPathReadProvider = () => {
  if (!PATH_RPC_URL) {`,
    `const getPathReadProvider = () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return null;
  }
  if (!PATH_RPC_URL) {`,
  ]),
  Object.freeze([
    "launch state delta 179",
    `    galleryStatus.textContent = "Studio Preview · Create and save a THOUGHT in this browser.";`,
    `    galleryStatus.textContent = "Create and save a THOUGHT in this browser. Onchain minting is not open yet.";`,
  ]),
  Object.freeze([
    "launch state delta 180",
    `    thoughtDetailStatus.textContent = "Studio Preview · Onchain THOUGHT details will appear here after minting opens.";`,
    `    thoughtDetailStatus.textContent = "Onchain THOUGHT details will appear when minting opens.";`,
  ]),
  Object.freeze([
    "launch state delta 181",
    `  const notice = getThoughtMintClosedNotice({
    state: thoughtLaunchState,
    workCompatible: isCurrentWorkLaunchCompatible(),
  });
  emitThoughtConsoleEvent({
    kind: "thought_launch_mint_closed",
    title: notice.title,
    detail: notice.detail,
    nextStep: notice.nextStep,
    tone: "warning",
  });`,
    `  const notice = getThoughtMintClosedNotice({
    state: thoughtLaunchState,
    workCompatible: isCurrentWorkLaunchCompatible(),
    workSaved: currentWorkId !== null && Boolean(
      getWorkById(readStoredThoughtWorks(), currentWorkId),
    ),
  });
  emitThoughtConsoleEvent({
    kind: "thought_launch_mint_closed",
    title: notice.title,
    detail: notice.detail,
    ...(notice.nextStep ? { nextStep: notice.nextStep } : {}),
    tone: "warning",
  });`,
  ]),
  Object.freeze([
    "launch state delta 182",
    `  void refreshWalletState().then(() => {
    syncInterface();
  });`,
    `  // Wallet state changes only after an explicit wallet action.`,
  ]),
  Object.freeze([
    "launch state delta 183",
    `let mintSheetTertiaryAction: MintSheetAction = "none";
let lastMintSheetFocusRefreshAt = 0;`,
    `let mintSheetTertiaryAction: MintSheetAction = "none";`,
  ]),
  Object.freeze([
    "launch state delta 184",
    `const refreshWalletState = async () => {`,
    `type RefreshWalletStateOptions = Readonly<{
  queryInjectedProvider?: boolean;
  refreshPreflight?: boolean;
  injectedAccounts?: unknown;
  injectedChainId?: unknown;
}>;

const parseWalletChainId = (value: unknown) => {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return Number(BigInt(value));
  } catch {
    return null;
  }
};

const refreshWalletState = async (options: RefreshWalletStateOptions = {}) => {`,
  ]),
  Object.freeze([
    "launch state delta 185",
    `  } else {
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

  const walletContextChanged =`,
    `  } else if (options.queryInjectedProvider) {
    try {
      const [accounts, chainHex] = await Promise.all([
        ethereum.request({ method: "eth_accounts" }),
        ethereum.request({ method: "eth_chainId" }),
      ]);

      walletState.address =
        Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      walletState.chainId = parseWalletChainId(chainHex);
    } catch {
      walletState.address = "";
      walletState.chainId = null;
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(options, "injectedAccounts")) {
      walletState.address = extractPrimaryAccount(options.injectedAccounts);
    }
    if (Object.prototype.hasOwnProperty.call(options, "injectedChainId")) {
      walletState.chainId = parseWalletChainId(options.injectedChainId);
    }
  }

  const walletContextChanged =`,
  ]),
  Object.freeze([
    "launch state delta 186",
    `  walletStateHydrated = true;
  await refreshMintPreflight();
};`,
    `  walletStateHydrated = true;
  if (options.refreshPreflight) {
    await refreshMintPreflight();
  } else {
    if (walletContextChanged) {
      walletState.balance = null;
      walletState.preflightLoading = false;
      walletState.preflightError = "";
    }
    syncPrimaryCtaAvailability();
    syncWalletMenu();
  }
};`,
  ]),
  Object.freeze([
    "launch state delta 187",
    `  await refreshWalletState();
  if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID) {`,
    `  await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
  if (walletState.address && walletState.chainId === THOUGHT_CHAIN_ID) {`,
  ]),
  Object.freeze([
    "launch state delta 188",
    `    (mintFlowState === "error" && isPathRecoveryError());

  await refreshWalletState();
  syncMintFlowAfterWalletCommand();`,
    `    (mintFlowState === "error" && isPathRecoveryError());

  await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
  syncMintFlowAfterWalletCommand();`,
  ]),
  Object.freeze([
    "launch state delta 189",
    `  const handleWalletChange = () => {
    void refreshWalletState().then(() => {
      syncInterface();
    });
  };

  providers.forEach((provider) => {
    provider.on?.("accountsChanged", handleWalletChange);
    provider.on?.("chainChanged", handleWalletChange);
  });`,
    `  providers.forEach((provider) => {
    provider.on?.("accountsChanged", (accounts) => {
      if (provider !== getEthereumProvider() || !walletState.address) return;
      void refreshWalletState({ injectedAccounts: accounts }).then(() => {
        syncInterface();
      });
    });
    provider.on?.("chainChanged", (chainId) => {
      if (provider !== getEthereumProvider() || !walletState.address) return;
      void refreshWalletState({ injectedChainId: chainId }).then(() => {
        syncInterface();
      });
    });
  });`,
  ]),
  Object.freeze([
    "launch state delta 190",
    `      await refreshWalletState();
      if (!walletState.address) {`,
    `      await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
      if (!walletState.address) {`,
  ]),
  Object.freeze([
    "launch state delta 191",
    `      if (!detectedAccount) {
        const requestedAccount = await requestAccounts;
        if (!requestedAccount && requestError) {
          throw requestError;
        }
      }
    }

    await refreshWalletState();

    if (!walletState.address) {`,
    `      if (!detectedAccount) {
        const requestedAccount = await requestAccounts;
        if (!requestedAccount && requestError) {
          throw requestError;
        }
      }
    }

    await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });

    if (!walletState.address) {`,
  ]),
  Object.freeze([
    "launch state delta 192",
    `  await refreshWalletState();
  if (walletState.chainId !== THOUGHT_CHAIN_ID) {`,
    `  await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
  if (walletState.chainId !== THOUGHT_CHAIN_ID) {`,
  ]),
  Object.freeze([
    "launch state delta 193",
    `    mintFlowData.pathId = parsePathTokenId(mintFlowData.pathIdInput);
    await refreshWalletState();
    const pathSelectionReady = moveMintFlowToWalletOrPathSelection();`,
    `    mintFlowData.pathId = parsePathTokenId(mintFlowData.pathIdInput);
    await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
    const pathSelectionReady = moveMintFlowToWalletOrPathSelection();`,
  ]),
  Object.freeze([
    "launch state delta 194",
    `  const ethereum = getEthereumProvider();
  if (!ethereum) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  await refreshWalletState();
  if (isTerminalMintFlowState(mintFlowState)) {`,
    `  const ethereum = getEthereumProvider();
  if (!ethereum) {
    mintFlowState = "wallet_required";
    recordCurrentMintConsoleState();
    syncInterface();
    focusMintDockStage();
    return;
  }

  await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });
  if (isTerminalMintFlowState(mintFlowState)) {`,
  ]),
  Object.freeze([
    "launch state delta 195",
    `const listCliPaths = async () => {
  await withCliLoading("loading...", async () => {
    await refreshWalletState();`,
    `const listCliPaths = async () => {
  await withCliLoading("loading...", async () => {
    await refreshWalletState({ queryInjectedProvider: true, refreshPreflight: true });`,
  ]),
  Object.freeze([
    "launch state delta 196",
    `  resumeConflictingMintReceiptMonitoring();
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
document.addEventListener("visibilitychange", () => {`,
    `  resumeConflictingMintReceiptMonitoring();
});
document.addEventListener("visibilitychange", () => {`,
  ]),
  Object.freeze([
    "launch state delta 197",
    `const getWalletMintReceiptProvider = () => {
  const ethereum = getEthereumProvider();`,
    `const getWalletMintReceiptProvider = () => {
  if (thoughtLaunchState.phase === "studio-preview") {
    return null;
  }
  const ethereum = getEthereumProvider();`,
  ]),
  Object.freeze([
    "launch state delta 198",
    `const startConflictingMintReceiptMonitor = (
  transaction: PendingMintTransaction,
  shouldAppendCliResult = false,
) => {
  if (
    !isPendingMintDeploymentCompatible(transaction) ||`,
    `const startConflictingMintReceiptMonitor = (
  transaction: PendingMintTransaction,
  shouldAppendCliResult = false,
) => {
  if (
    thoughtLaunchState.phase === "studio-preview" ||
    !isPendingMintDeploymentCompatible(transaction) ||`,
  ]),
  Object.freeze([
    "launch state delta 199",
    `const resumePendingMintReceiptMonitoring = () => {
  const pending = pendingMintTransaction;
  if (!pending) {`,
    `const resumePendingMintReceiptMonitoring = () => {
  const pending = pendingMintTransaction;
  // Retain submitted hashes for recovery when an approved deployment is active.
  if (thoughtLaunchState.phase === "studio-preview" || !pending) {`,
  ]),
  Object.freeze([
    "launch state delta 200",
    `const loadThoughtDetail = async () => {
  if (ROUTE_THOUGHT_NFT_ID === null) {
    thoughtDetailStatus.textContent = "THOUGHT unavailable.";
    return;
  }
  if (!IS_THOUGHT_GALLERY_ACTIVE) {
    clearThoughtGalleryCache();
    thoughtDetailStatus.textContent = "Onchain THOUGHT details will appear when minting opens.";
    return;
  }

  thoughtDetailTitleToken.textContent = ROUTE_THOUGHT_NFT_ID.toString();
  thoughtDetailBody.classList.add("is-hidden");`,
    `const loadThoughtDetail = async () => {
  if (ROUTE_THOUGHT_NFT_ID === null) {
    thoughtDetailStatus.textContent = "THOUGHT unavailable.";
    return;
  }
  thoughtDetailTitleToken.textContent = ROUTE_THOUGHT_NFT_ID.toString();
  if (!IS_THOUGHT_GALLERY_ACTIVE) {
    clearThoughtGalleryCache();
    thoughtDetailStatus.textContent = "Onchain THOUGHT details will appear when minting opens.";
    return;
  }

  thoughtDetailBody.classList.add("is-hidden");`,
  ]),
]);

export const applyCurrentThoughtLaunchMainDeltas = (source, direction, replaceExactCount) => {
  let current = source;
  const deltas = direction === "restore"
    ? [...CURRENT_THOUGHT_LAUNCH_MAIN_DELTAS].reverse()
    : CURRENT_THOUGHT_LAUNCH_MAIN_DELTAS;
  for (const [label, previous, next] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? next : previous,
      direction === "restore" ? previous : next,
    );
  }
  return current;
};
