import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { inspect } from "node:util";

import { buildThoughtCodexOperationContract, buildThoughtCodexTask } from "../packages/thought-agent-protocol/src/codex-client";
import { THOUGHT_CODEX_TRANSPORT_WORKER_SHA256 } from "../packages/thought-agent-protocol/src/codex-transport-worker";
import { buildThoughtClaudeTask } from "../packages/thought-agent-protocol/src/claude-client";
import {
  thoughtAgentCanaryHandoffTransport,
  thoughtAgentCanaryLaunchTransport,
} from "./thought-agent-canary-endpoints";
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

describe("THOUGHT Agent canary uses the delivered endpoint", () => {
  const expectedApiOrigin = "https://preview.inshell.art";
  const publicRunUrl = `${expectedApiOrigin}/api/thought-agent/v2/runs/${runId}`;
  const launchToken = "canary-fixture-launch-credential";
  const taskInput = {
    ...buildInput(publicRunUrl),
    launchToken,
    bootstrap: {
      url: `${publicRunUrl}/bootstrap`,
      workerSha256: THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
      configSha256: `sha256:${"b".repeat(64)}` as const,
    },
  };
  const mutateCodexBootstrap = (
    handoff: string,
    mutate: (bootstrap: { url: string; workerSha256: string; configSha256: string }) => void,
  ) => {
    const lines = handoff.split("\n");
    const commandIndex = lines.findIndex((line) => line.startsWith("node -e "));
    assert.notEqual(commandIndex, -1);
    const match = lines[commandIndex].match(/^(node -e '[^']*' -- )'([^']*)' '([^']*)' '([^']*)'$/);
    assert.ok(match);
    const bootstrap = { url: match[2], workerSha256: match[3], configSha256: match[4] };
    mutate(bootstrap);
    lines[commandIndex] = `${match[1]}'${bootstrap.url}' '${bootstrap.workerSha256}' '${bootstrap.configSha256}'`;
    return lines.join("\n");
  };
  const agents = [
    { name: "Codex", fixedWorker: true, explicitEndpoints: false, handoff: buildThoughtCodexTask(taskInput) },
    { name: "Claude", fixedWorker: false, explicitEndpoints: true, handoff: buildThoughtClaudeTask({ ...taskInput, surface: "code" }) },
  ];
  const transport = (handoff: string, explicitEndpoints: boolean) => thoughtAgentCanaryHandoffTransport({
    handoff, explicitEndpoints, runId, launchToken, expectedApiOrigin,
  });
  const rejectsPrivately = (operation: () => unknown) => assert.throws(operation, (error) => {
    assert.ok(error instanceof Error);
    assert.ok(!inspect(error).includes(launchToken), "validation errors must not reveal the credential");
    return true;
  });

  for (const agent of agents) {
    test(`${agent.name} follows the public handoff when browser polling uses a private origin`, () => {
      const browserStatusUrl = new URL(`/api/thought-agent/v2/runs/${runId}`, "http://127.0.0.1:5185/thought/").href;
      const actual = transport(agent.handoff, agent.explicitEndpoints);
      assert.equal(actual.runUrl, publicRunUrl);
      assert.notEqual(actual.runUrl, browserStatusUrl);
      assert.equal(actual.launchToken, launchToken);
      assert.deepEqual(actual.endpoints, Object.fromEntries(
        ["claim", "ready", "start", "result", "fail"].map((action) => [action, `${publicRunUrl}/${action}`]),
      ));
    });

    test(`${agent.name} rejects a handoff that points at the wrong origin instead of masking it with statusUrl`, () => {
      rejectsPrivately(() => transport(agent.handoff.replaceAll(expectedApiOrigin, "https://inshell.art"), agent.explicitEndpoints));
    });

    test(`${agent.name} binds the endpoint path and run ID before using the credential`, () => {
      for (const endpoint of [
        `${expectedApiOrigin}/api/thought-agent/v1/runs/RUN_ID`,
        `${expectedApiOrigin}/api/thought-agent/v2/runs/tar_other_run`,
        `${publicRunUrl}/`,
        `${publicRunUrl}?token=${launchToken}`,
        `${publicRunUrl}#${launchToken}`,
        `https://${launchToken}@preview.inshell.art/api/thought-agent/v2/runs/RUN_ID`,
        `${expectedApiOrigin}/extra/../api/thought-agent/v2/runs/RUN_ID`,
        `/api/thought-agent/v2/runs/RUN_ID`,
        `not-a-url-${launchToken}`,
      ]) {
        const changed = agent.fixedWorker
          ? mutateCodexBootstrap(agent.handoff, (bootstrap) => {
              bootstrap.url = `${endpoint.replaceAll("RUN_ID", runId)}/bootstrap`;
            })
          : agent.handoff.replace(/^APP_ENDPOINT = .+$/m, `APP_ENDPOINT = ${endpoint}`);
        rejectsPrivately(() => transport(changed, agent.explicitEndpoints));
      }
    });

    test(`${agent.name} rejects missing, duplicated or mismatched capsule bindings without exposing credentials`, () => {
      const malformed = agent.fixedWorker
        ? [
            mutateCodexBootstrap(agent.handoff, (bootstrap) => { bootstrap.url = ""; }),
            `${agent.handoff}\nAPP_ENDPOINT = ${publicRunUrl}`,
            mutateCodexBootstrap(agent.handoff, (bootstrap) => {
              bootstrap.url = `${expectedApiOrigin}/api/thought-agent/v2/runs/tar_other_run/bootstrap`;
            }),
            agent.handoff.replace(/^Credential=.+$/m, "Credential=different-fixture-credential"),
            `${agent.handoff}\nLAUNCH_CREDENTIAL = ${launchToken}`,
          ]
        : [
            agent.handoff.replace(/^APP_ENDPOINT = .+\n/m, ""),
            `${agent.handoff}\nAPP_ENDPOINT = ${publicRunUrl}`,
            agent.handoff.replace(/^RUN_ID = .+$/m, "RUN_ID = tar_other_run"),
            agent.handoff.replace(/^LAUNCH_CREDENTIAL = .+$/m, "LAUNCH_CREDENTIAL = different-fixture-credential"),
            `${agent.handoff}\nLAUNCH_CREDENTIAL = ${launchToken}`,
          ];
      for (const handoff of malformed) rejectsPrivately(() => transport(handoff, agent.explicitEndpoints));
    });

    test(`${agent.name} rejects divergent explicit operation endpoints`, () => {
      for (const action of ["CLAIM", "READY", "START", "RESULT", "FAIL"]) {
        const field = `${action}_ENDPOINT`;
        const wrong = `${field} = https://other.invalid/api/thought-agent/v2/runs/RUN_ID/${action.toLowerCase()}`;
        const handoff = agent.explicitEndpoints
          ? agent.handoff.replace(new RegExp(`^${field} = .+$`, "m"), wrong)
          : `${agent.handoff}\n${wrong}`;
        rejectsPrivately(() => transport(handoff, agent.explicitEndpoints));
        if (agent.explicitEndpoints) {
          rejectsPrivately(() => transport(agent.handoff.replace(new RegExp(`^${field} = .+\\n`, "m"), ""), true));
        }
      }
    });
  }

  const launchUri = `thought://agent/run?${new URLSearchParams({ run_id: runId, token: launchToken, api_origin: expectedApiOrigin })}`;
  test("Codex live resolves the advertised API origin independently of the browser origin", () => {
    assert.deepEqual(thoughtAgentCanaryLaunchTransport(launchUri, runId, expectedApiOrigin), { runUrl: publicRunUrl, launchToken });
  });

  test("Codex live keeps browser-token status requests on the browser route in success and failure paths", () => {
    const source = readFileSync(new URL("./test-thought-agent-codex-live.ts", import.meta.url), "utf8");
    assert.match(source, /const browserStatusUrl = new URL\(created\.statusUrl, origin\)/);
    const browserRequests = [...source.matchAll(/}>\((\w+), \{\s*headers: \{ Authorization: `Bearer \$\{created\.browserToken\}` \}/g)];
    assert.deepEqual(browserRequests.map((match) => match[1]), ["browserStatusUrl", "browserStatusUrl"]);
    assert.match(source, /buildThoughtCodexTask\(\{\s*product: "Codex",\s*runId: created\.runId,\s*runUrl,/);
  });

  test("Codex live rejects an unexpected API origin, run ID or duplicate credential", () => {
    rejectsPrivately(() => thoughtAgentCanaryLaunchTransport(launchUri, runId, "https://inshell.art"));
    rejectsPrivately(() => thoughtAgentCanaryLaunchTransport(launchUri, "tar_other_run", expectedApiOrigin));
    rejectsPrivately(() => thoughtAgentCanaryLaunchTransport(`${launchUri}&token=${launchToken}`, runId, expectedApiOrigin));
  });

  test("loopback HTTP remains available for local tests", () => {
    const localOrigin = "http://127.0.0.1:5185";
    const localLaunch = launchUri.replace(encodeURIComponent(expectedApiOrigin), encodeURIComponent(localOrigin));
    assert.equal(thoughtAgentCanaryLaunchTransport(localLaunch, runId, localOrigin).runUrl, `${localOrigin}/api/thought-agent/v2/runs/${runId}`);
  });
});
