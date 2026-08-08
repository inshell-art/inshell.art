import assert from "node:assert/strict";
import test from "node:test";

import {
  THOUGHT_V2_PRODUCTION_DEPLOYMENT,
  readThoughtV2ProductionDeployment,
} from "../apps/thought/src/thought-v2-production-deployment";
import {
  onRequestGet,
  onRequestPost,
} from "../functions/api/thought-contract/v2/attestation";

test("THOUGHT production deployment lock is disabled and empty", () => {
  assert.equal(readThoughtV2ProductionDeployment(), null);
  assert.equal(THOUGHT_V2_PRODUCTION_DEPLOYMENT, null);
});

test("THOUGHT production attestation is observable and fail-closed", async () => {
  const status = onRequestGet();
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("cache-control"), "no-store");
  assert.deepEqual(await status.json(), {
    schema: "inshell.thought.production-attestation-status.v1",
    browserSigning: false,
    deploymentLocked: false,
    enabled: false,
    signerLocation: "backend-only",
    status: "not-deployed",
  });

  const rejected = onRequestPost();
  assert.equal(rejected.status, 503);
  assert.deepEqual(await rejected.json(), {
    error: {
      code: "PRODUCTION_ATTESTATION_NOT_AUTHORIZED",
      message: "THOUGHT production attestation is not authorized.",
    },
  });
});
