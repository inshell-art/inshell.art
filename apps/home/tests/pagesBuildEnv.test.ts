import { resolvePagesBuildDeploymentEnv } from "../../../packages/shared/src/pagesBuildEnv";

describe("resolvePagesBuildDeploymentEnv", () => {
  test.each([
    ["main", "production"],
    ["staging", "preview"],
    ["codex/thought-public-agent-deploy", "preview"],
  ])(
    "maps Cloudflare Pages branch %s to %s",
    (pagesBranch, expected) => {
      expect(resolvePagesBuildDeploymentEnv({ pagesBranch })).toBe(expected);
    },
  );

  test("supports an explicitly configured production branch", () => {
    expect(
      resolvePagesBuildDeploymentEnv({
        pagesBranch: "release",
        productionBranch: "release",
      }),
    ).toBe("production");
  });

  test.each([
    ["preview", "main", "preview"],
    ["production", "feature", "production"],
    ["local", "staging", "local"],
  ])(
    "keeps explicit deploy env %s ahead of Pages branch %s",
    (configuredDeployEnv, pagesBranch, expected) => {
      expect(
        resolvePagesBuildDeploymentEnv({ configuredDeployEnv, pagesBranch }),
      ).toBe(expected);
    },
  );

  test("leaves non-Cloudflare builds unclassified", () => {
    expect(resolvePagesBuildDeploymentEnv()).toBeUndefined();
  });
});
