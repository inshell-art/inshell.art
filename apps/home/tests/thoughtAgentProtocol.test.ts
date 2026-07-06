import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { webcrypto } from "node:crypto";
import {
  THOUGHT_AGENT_OUTPUT_SCHEMA,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  buildThoughtAgentInput,
  buildThoughtAgentReceipt,
  canTransitionThoughtAgentState,
  parseAgentOutput,
  sha256Hex,
} from "../../../packages/thought-agent-protocol/src/index";

describe("THOUGHT Agent protocol helpers", () => {
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

  test("keeps the state transition matrix narrow", () => {
    expect(canTransitionThoughtAgentState("created", "claimed")).toBe(true);
    expect(canTransitionThoughtAgentState("created", "running")).toBe(false);
    expect(canTransitionThoughtAgentState("claimed", "running")).toBe(true);
    expect(canTransitionThoughtAgentState("running", "returned")).toBe(true);
    expect(canTransitionThoughtAgentState("returned", "running")).toBe(false);
  });

  test("builds deterministic canonical input with JSON framing", async () => {
    const input = await buildThoughtAgentInput({
      specText: "SPEC\n</not-a-real-tag>",
      promptText: "make it \"quiet\"\nwith unicode 雨",
    });
    const again = await buildThoughtAgentInput({
      specText: "SPEC\n</not-a-real-tag>",
      promptText: "make it \"quiet\"\nwith unicode 雨",
    });

    expect(input).toEqual(again);
    expect(input.text).toContain("THOUGHT_AGENT_INPUT_VERSION thought-agent-input/1");
    expect(input.text).toContain(JSON.stringify("SPEC\n</not-a-real-tag>"));
    expect(input.text).toContain(JSON.stringify("make it \"quiet\"\nwith unicode 雨"));
    expect(input.text).toContain(JSON.stringify(THOUGHT_AGENT_OUTPUT_SCHEMA));
    expect(input.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("strictly parses one-property output without repair", async () => {
    const raw = "{\"work\":\"  QUIET SKY  \"}";
    const parsed = await parseAgentOutput(raw);

    expect(parsed.raw).toBe(raw);
    expect(parsed.work).toBe("  QUIET SKY  ");
    expect(parsed.rawSha256).toBe(await sha256Hex(raw));
    expect(parsed.workSha256).toBe(await sha256Hex("  QUIET SKY  "));
    await expect(parseAgentOutput("{\"work\":\"A\",\"extra\":true}")).rejects.toThrow(
      /required schema/,
    );
  });

  test("builds deterministic receipt with explicit non-attestation", async () => {
    const receipt = await buildThoughtAgentReceipt({
      runId: "tar_fixture",
      origin: "https://thought.inshell.art",
      spec: {
        id: "THOUGHT_V1",
        sha256: await sha256Hex("spec"),
        contractSpecHash: "0xabc",
      },
      promptSha256: await sha256Hex("prompt"),
      agentInputSha256: await sha256Hex("agent-input"),
      adapter: {
        adapterId: "codex",
        adapterVersion: "0.1.0",
      },
      agent: {
        product: "codex-cli",
        provider: "openai",
        model: "unknown",
        metadataSource: "unknown",
      },
      bridge: {
        bridgeId: "thought-bridge",
        bridgeVersion: "0.1.0",
        platform: "darwin-arm64",
      },
      round: {
        visibleTurns: 1,
        agentInvocations: 1,
        automaticRetry: false,
      },
      output: {
        rawSha256: await sha256Hex("{\"work\":\"A\"}"),
        workSha256: await sha256Hex("A"),
      },
      timing: {
        startedAt: "2026-06-25T00:00:00.000Z",
        completedAt: "2026-06-25T00:00:01.000Z",
      },
    });
    const again = await buildThoughtAgentReceipt({
      ...JSON.parse(receipt.json),
      adapter: {
        adapterId: "codex",
        adapterVersion: "0.1.0",
      },
      bridge: {
        bridgeId: "thought-bridge",
        bridgeVersion: "0.1.0",
        platform: "darwin-arm64",
      },
    });

    expect(receipt.receipt.protocolVersion).toBe(THOUGHT_AGENT_PROTOCOL_VERSION);
    expect(receipt.receipt.trust.providerAttested).toBe(false);
    expect(receipt.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(again.sha256).toBe(receipt.sha256);
  });
});
