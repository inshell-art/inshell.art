import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { webcrypto } from "node:crypto";
import {
  THOUGHT_AGENT_DECLARATION_VERSION,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_SHA256_PREFIX,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtAgentInput,
  buildThoughtAgentReceipt,
  buildThoughtCodexTask,
  canTransitionThoughtAgentState,
  parseAgentOutput,
  parseCreateRunRequest,
  sha256Hex,
} from "../../../packages/thought-agent-protocol/src/index";
import { hasThoughtPollDeadlineExpired } from "../../thought/src/thought-poll-wake";

const releasedAgentResult = (
  agentLine: string,
  declaration?: Record<string, unknown>,
) => ({
  schema: THOUGHT_AGENT_RESULT_VERSION,
  release: THOUGHT_V2_PROTOCOL_RELEASE.release,
  agentLine,
  ...(declaration ? { declaration } : {}),
});

describe("THOUGHT Agent V2 protocol helpers", () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  test("keeps the run-state transition matrix narrow", () => {
    expect(canTransitionThoughtAgentState("created", "claimed")).toBe(true);
    expect(canTransitionThoughtAgentState("created", "running")).toBe(false);
    expect(canTransitionThoughtAgentState("claimed", "ready")).toBe(true);
    expect(canTransitionThoughtAgentState("claimed", "running")).toBe(false);
    expect(canTransitionThoughtAgentState("ready", "running")).toBe(true);
    expect(canTransitionThoughtAgentState("running", "returned")).toBe(true);
    expect(canTransitionThoughtAgentState("returned", "running")).toBe(false);
  });

  test("recognizes an expired browser polling deadline", () => {
    const now = Date.parse("2026-07-14T00:05:00.000Z");
    expect(hasThoughtPollDeadlineExpired("2026-07-14T00:04:59.999Z", now)).toBe(true);
    expect(hasThoughtPollDeadlineExpired("2026-07-14T00:05:00.001Z", now)).toBe(false);
    expect(hasThoughtPollDeadlineExpired(undefined, now)).toBe(false);
  });

  test("sends the exact prompt line to the Agent without framing or repair", async () => {
    const promptLine = "quiet signal";
    const input = await buildThoughtAgentInput({ promptLine });
    const again = await buildThoughtAgentInput({ promptLine });

    expect(input).toEqual(again);
    expect(input.text).toBe(promptLine);
    expect(input.sha256).toBe(await sha256Hex(promptLine));
    expect(input.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("accepts promptLine and rejects the removed V1 prompt field", () => {
    const request = {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine: "quiet signal",
      specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      requestedAgent: { adapterId: "codex", model: null },
    };

    expect(parseCreateRunRequest(request).promptLine).toBe("quiet signal");
    expect(() =>
      parseCreateRunRequest({ ...request, promptLine: undefined, prompt: "quiet signal" }),
    ).toThrow(/promptLine/);
  });

  test("strictly parses the V2 result without trimming or extraction", async () => {
    const agentLine = "quiet signal";
    const raw = JSON.stringify(releasedAgentResult(agentLine));
    const parsed = await parseAgentOutput(raw);

    expect(parsed.raw).toBe(raw);
    expect(parsed.agentLine).toBe(agentLine);
    expect(parsed.rawSha256).toBe(await sha256Hex(raw));
    expect(parsed.agentLineSha256).toBe(await sha256Hex(agentLine));
    expect(parsed.rawSha256.startsWith(THOUGHT_SHA256_PREFIX)).toBe(true);

    await expect(
      parseAgentOutput(
        JSON.stringify({ ...releasedAgentResult(agentLine), extra: true }),
      ),
    ).rejects.toThrow(/required schema/);
    await expect(
      parseAgentOutput(JSON.stringify(releasedAgentResult(" quiet"))),
    ).rejects.toThrow(/outer space/);
    await expect(
      parseAgentOutput(JSON.stringify(releasedAgentResult("quiet  signal"))),
    ).rejects.toThrow(/repeated internal spaces/);
    await expect(
      parseAgentOutput(JSON.stringify(releasedAgentResult("quiet\nsignal"))),
    ).rejects.toThrow(/unsupported U\+000A/);
  });

  test("accepts the optional declaration only in its exact schema", async () => {
    const declaration = {
      schema: THOUGHT_AGENT_DECLARATION_VERSION,
      status: "declared-unverified",
      label: "Codex",
      declaredOneCreativeResult: true,
    } as const;
    const raw = JSON.stringify(releasedAgentResult("quiet signal", declaration));

    await expect(parseAgentOutput(raw)).resolves.toMatchObject({ declaration });
    await expect(
      parseAgentOutput(
        JSON.stringify({
          ...releasedAgentResult("quiet signal"),
          declaration: {
            ...declaration,
            declaredOneCreativeResult: false,
          },
        }),
      ),
    ).rejects.toThrow(/declaration/);
  });

  test("enforces the released UTF-8 byte limits, not renderer display units", async () => {
    const promptAtLimit = "A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.promptMaxBytes);
    const agentAtLimit = "A".repeat(THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes);

    await expect(buildThoughtAgentInput({ promptLine: promptAtLimit })).resolves.toBeDefined();
    await expect(
      buildThoughtAgentInput({ promptLine: `${promptAtLimit}A` }),
    ).rejects.toThrow(/bytes/);
    await expect(
      parseAgentOutput(
        JSON.stringify(releasedAgentResult(agentAtLimit)),
      ),
    ).resolves.toBeDefined();
    await expect(
      parseAgentOutput(
        JSON.stringify(releasedAgentResult(`${agentAtLimit}A`)),
      ),
    ).rejects.toThrow(/bytes/);
    await expect(
      parseAgentOutput(
        JSON.stringify(releasedAgentResult("A".repeat(27))),
      ),
    ).resolves.toBeDefined();
  });

  test("builds Agent tasks from the active byte-based V2 contract", () => {
    const task = buildThoughtCodexTask({
      product: "Codex",
      runId: "tar_protocol_test",
      runUrl: "http://127.0.0.1:5173/api/thought-agent/v2/runs/tar_protocol_test",
      launchToken: "launch-token",
    });

    expect(task).toContain("1-64-byte Terminal English agentLine");
    expect(task).toContain(
      `<work_profile> = ${THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile}`,
    );
    expect(task).not.toContain("162 display units");
    expect(task).not.toContain("approval code");
  });

  test("builds a deterministic receipt with explicit non-attestation", async () => {
    const receiptInput = {
      runId: "tar_fixture",
      origin: "https://inshell.art",
      spec: {
        id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        sha256: await sha256Hex(THOUGHT_V2_PROTOCOL_RELEASE.spec.text),
        contractSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
      },
      promptSha256: await sha256Hex("prompt"),
      agentInputSha256: await sha256Hex("prompt"),
      adapter: {
        adapterId: "codex",
        adapterVersion: "0.1.0",
      },
      agent: {
        product: "codex-cli",
        provider: "openai",
        model: "unknown",
        metadataSource: "configured" as const,
      },
      bridge: {
        bridgeId: "thought-bridge",
        bridgeVersion: "0.1.0",
        platform: "darwin-arm64",
      },
      round: {
        visibleTurns: 1,
        agentInvocations: 1,
        automaticRetry: false as const,
      },
      output: {
        rawSha256: await sha256Hex(
          JSON.stringify(releasedAgentResult("A")),
        ),
        agentLineSha256: await sha256Hex("A"),
      },
      timing: {
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:01.000Z",
      },
    };
    const receipt = await buildThoughtAgentReceipt(receiptInput);
    const again = await buildThoughtAgentReceipt(receiptInput);

    expect(receipt.receipt.protocolVersion).toBe(THOUGHT_AGENT_PROTOCOL_VERSION);
    expect(receipt.receipt.trust.providerAttested).toBe(false);
    expect(receipt.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(again.sha256).toBe(receipt.sha256);
  });
});
