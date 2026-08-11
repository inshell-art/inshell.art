import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildThoughtCodexOperationContract } from "../packages/thought-agent-protocol/src/codex-client";
import {
  THOUGHT_CLAUDE_COWORK_DIRECT_PROFILE,
  buildThoughtDirectAgentOperationContract,
} from "../packages/thought-agent-protocol/src/direct-agent-task";

const runId = "tar_run_url_test";
const baseUrl = `https://inshell.art/api/thought-agent/v2/runs/${runId}`;
const longSlashSequence = "/".repeat(100_000);

const buildInput = (runUrl: string) => ({
  product: "Test agent",
  runId,
  runUrl,
  launchToken: "test-launch-token",
});

type OperationContract = {
  baseUrl: string;
  endpoints: {
    claim: string;
    ready: string;
    start: string;
    result: string;
    fail: string;
  };
};

const consumers: ReadonlyArray<[
  name: string,
  build: (runUrl: string) => OperationContract,
]> = [
  [
    "Codex",
    (runUrl) => buildThoughtCodexOperationContract(buildInput(runUrl)),
  ],
  [
    "direct agent",
    (runUrl) =>
      buildThoughtDirectAgentOperationContract(
        buildInput(runUrl),
        THOUGHT_CLAUDE_COWORK_DIRECT_PROFILE,
      ),
  ],
];

const assertNormalizedContract = (
  contract: OperationContract,
  expectedBaseUrl: string,
) => {
  assert.equal(contract.baseUrl, expectedBaseUrl);
  assert.deepEqual(contract.endpoints, {
    claim: `${expectedBaseUrl}/claim`,
    ready: `${expectedBaseUrl}/ready`,
    start: `${expectedBaseUrl}/start`,
    result: `${expectedBaseUrl}/result`,
    fail: `${expectedBaseUrl}/fail`,
  });
};

describe("THOUGHT Agent run URL normalization", () => {
  for (const [consumerName, buildContract] of consumers) {
    test(`${consumerName} leaves a URL without trailing slashes unchanged`, () => {
      assertNormalizedContract(buildContract(baseUrl), baseUrl);
    });

    test(`${consumerName} removes one trailing slash`, () => {
      assertNormalizedContract(buildContract(`${baseUrl}/`), baseUrl);
    });

    test(`${consumerName} removes a long trailing-slash suffix`, () => {
      assertNormalizedContract(
        buildContract(`${baseUrl}${longSlashSequence}`),
        baseUrl,
      );
    });

    test(`${consumerName} reduces an all-slash URL to an empty base`, () => {
      const contract = buildContract("////");
      assertNormalizedContract(contract, "");
      assert.equal(contract.endpoints.claim, "/claim");
    });

    test(`${consumerName} preserves a long non-trailing slash sequence`, () => {
      const runUrl = `${longSlashSequence}x`;
      assertNormalizedContract(buildContract(runUrl), runUrl);
    });
  }
});
