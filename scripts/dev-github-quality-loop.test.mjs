import assert from "node:assert/strict";
import test from "node:test";

import {
  latestWorkflowRuns,
  selectCurrentHeadWorkflowRuns,
} from "./dev-github-quality-loop.mjs";

test("ignores completed workflow runs from obsolete branch heads", () => {
  const currentHeadSha = "ce29c6e";
  const staleHeadSha = "48d87ee";
  const workflowRuns = [
    {
      id: 27495688502,
      workflow_id: 11,
      name: "Dependabot Updates",
      conclusion: "failure",
      head_sha: staleHeadSha,
    },
    {
      id: 27542398536,
      workflow_id: 11,
      name: "Dependabot Updates",
      conclusion: "success",
      head_sha: currentHeadSha,
    },
    {
      id: 27542398537,
      workflow_id: 12,
      name: "test",
      conclusion: "success",
      head_sha: currentHeadSha,
    },
  ];

  const { currentHeadRuns, ignoredStaleRuns } = selectCurrentHeadWorkflowRuns({
    workflowRuns,
    branchHeadSha: currentHeadSha,
  });
  const latestRuns = latestWorkflowRuns(currentHeadRuns);

  assert.equal(ignoredStaleRuns.length, 1);
  assert.deepEqual(latestRuns.map((run) => run.id), [27542398536, 27542398537]);
  assert.equal(latestRuns.some((run) => run.conclusion === "failure"), false);
});

test("keeps all completed workflow runs when branch head is unavailable", () => {
  const workflowRuns = [
    { id: 1, workflow_id: 11, conclusion: "failure", head_sha: "old" },
    { id: 2, workflow_id: 12, conclusion: "success", head_sha: "current" },
  ];

  const { currentHeadRuns, ignoredStaleRuns } = selectCurrentHeadWorkflowRuns({
    workflowRuns,
    branchHeadSha: null,
  });

  assert.deepEqual(currentHeadRuns, workflowRuns);
  assert.deepEqual(ignoredStaleRuns, []);
});
