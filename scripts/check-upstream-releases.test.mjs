import assert from "node:assert/strict";
import test from "node:test";
import {
  latestPathTag,
  latestThoughtTag,
  parseLsRemote,
} from "./check-upstream-releases.mjs";

test("selects the newest PATH semantic release", () => {
  const tags = parseLsRemote(`
1111111111111111111111111111111111111111\trefs/tags/v0.4.2
2222222222222222222222222222222222222222\trefs/tags/v0.5.0
3333333333333333333333333333333333333333\trefs/tags/v0.5.0^{}
4444444444444444444444444444444444444444\trefs/tags/sepolia-candidate
`);
  assert.equal(latestPathTag(tags), "v0.5.0");
});

test("selects the newest canonical THOUGHT release by date and revision", () => {
  const tags = parseLsRemote(`
1111111111111111111111111111111111111111\trefs/tags/thought-v2-canonical-portable-release-20260731-r9
2222222222222222222222222222222222222222\trefs/tags/thought-v2-canonical-portable-release-20260801-r1
3333333333333333333333333333333333333333\trefs/tags/thought-v2-noncanonical-integration-preview-20260809-r99
`);
  assert.equal(
    latestThoughtTag(tags),
    "thought-v2-canonical-portable-release-20260801-r1",
  );
});
