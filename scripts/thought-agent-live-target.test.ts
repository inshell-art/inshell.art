import assert from "node:assert/strict";
import test from "node:test";

import {
  ThoughtAgentCanaryError,
  requiredThoughtAgentLiveTarget,
  validateThoughtAgentCandidateCheckout,
  validateThoughtAgentLiveTarget,
} from "./lib/thought-agent-live-target";

const commitSha = "a".repeat(40);

test("requires an exact qualified preview candidate", () => {
  assert.throws(
    () => requiredThoughtAgentLiveTarget({}),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_ORIGIN_REQUIRED",
  );
  assert.throws(
    () => requiredThoughtAgentLiveTarget({
      THOUGHT_LIVE_ORIGIN: "https://inshell.art",
      THOUGHT_LIVE_COMMIT_SHA: commitSha,
    }),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_NOT_PREVIEW",
  );
  assert.throws(
    () => requiredThoughtAgentLiveTarget({
      THOUGHT_LIVE_ORIGIN: "https://preview.inshell.art",
      THOUGHT_LIVE_COMMIT_SHA: "staging",
    }),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_COMMIT_REQUIRED",
  );
});

test("requires the exact clean candidate checkout before remote qualification", () => {
  const target = requiredThoughtAgentLiveTarget({
    THOUGHT_LIVE_ORIGIN: "https://preview.inshell.art",
    THOUGHT_LIVE_COMMIT_SHA: commitSha,
  });
  assert.doesNotThrow(() => validateThoughtAgentCandidateCheckout(target, {
    headSha: commitSha,
    porcelain: "",
  }));
  assert.throws(
    () => validateThoughtAgentCandidateCheckout(target, {
      headSha: "b".repeat(40),
      porcelain: "",
    }),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_CHECKOUT_MISMATCH",
  );
  assert.throws(
    () => validateThoughtAgentCandidateCheckout(target, {
      headSha: commitSha,
      porcelain: "?? local-change.ts\n",
    }),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_CHECKOUT_DIRTY",
  );
});

test("verifies commit, staging branch, and Agent route without retaining an origin", async () => {
  const target = requiredThoughtAgentLiveTarget({
    THOUGHT_LIVE_ORIGIN: "https://preview.inshell.art/path?ignored=1",
    THOUGHT_LIVE_COMMIT_SHA: commitSha,
    THOUGHT_CANARY_RUNNER_ID: "Mac A Canary",
  });
  assert.equal(target.origin, "https://preview.inshell.art");
  assert.equal(target.runnerId, "mac-a-canary");

  const result = await validateThoughtAgentLiveTarget(
    target,
    async (input) => {
      if (String(input).endsWith("/api/thought-agent/v2/connectivity")) {
        return new Response(JSON.stringify({
          schema: "inshell.thought.agent-connectivity.v1",
          status: "reachable",
          protocolVersion: "inshell.thought.agent-run.v2",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        host: { branch: "staging", commitSha },
        routes: {
          thoughtAgent: { baseRoute: "/api/thought-agent/v2" },
        },
      }), { status: 200 });
    },
  );
  assert.deepEqual(result, {
    environment: "preview",
    commitSha,
    protocolVersion: "inshell.thought.agent-run.v2",
  });
});

test("fails closed when the preview lacks the qualified connectivity contract", async () => {
  const target = requiredThoughtAgentLiveTarget({
    THOUGHT_LIVE_ORIGIN: "https://preview.inshell.art",
    THOUGHT_LIVE_COMMIT_SHA: commitSha,
  });
  await assert.rejects(
    () => validateThoughtAgentLiveTarget(
      target,
      async (input) => new Response(JSON.stringify(
        String(input).endsWith("/api/thought-agent/v2/connectivity")
          ? {
              schema: "inshell.thought.agent-connectivity.v1",
              status: "unreachable",
              protocolVersion: "inshell.thought.agent-run.v2",
            }
          : {
              ok: true,
              host: { branch: "staging", commitSha },
              routes: {
                thoughtAgent: { baseRoute: "/api/thought-agent/v2" },
              },
            },
      ), { status: 200 }),
    ),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_CONNECTIVITY_INVALID",
  );
});

test("fails closed on a different deployed commit", async () => {
  const target = requiredThoughtAgentLiveTarget({
    THOUGHT_LIVE_ORIGIN: "https://preview.inshell.art",
    THOUGHT_LIVE_COMMIT_SHA: commitSha,
  });
  await assert.rejects(
    () => validateThoughtAgentLiveTarget(
      target,
      async () => new Response(JSON.stringify({
        ok: true,
        host: { branch: "staging", commitSha: "b".repeat(40) },
        routes: {
          thoughtAgent: { baseRoute: "/api/thought-agent/v2" },
        },
      }), { status: 200 }),
    ),
    (error) => error instanceof ThoughtAgentCanaryError &&
      error.code === "TARGET_COMMIT_MISMATCH",
  );
});
