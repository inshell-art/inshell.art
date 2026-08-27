export type PagesBuildDeploymentEnv = "local" | "preview" | "production";

export type PagesBuildDeploymentEnvOptions = {
  configuredDeployEnv?: string | null;
  pagesBranch?: string | null;
  productionBranch?: string | null;
};

export function sortPagesBuildPublicEnv(
  env: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function normalizeConfiguredDeployEnv(
  value: string | null | undefined,
): PagesBuildDeploymentEnv | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "preview" || normalized === "staging") return "preview";
  if (
    normalized === "production" ||
    normalized === "prod" ||
    normalized === "main"
  ) {
    return "production";
  }
  if (
    normalized === "local" ||
    normalized === "dev" ||
    normalized === "development"
  ) {
    return "local";
  }
  return null;
}

export function resolvePagesBuildDeploymentEnv(
  options: PagesBuildDeploymentEnvOptions = {},
): PagesBuildDeploymentEnv | undefined {
  const configured = normalizeConfiguredDeployEnv(options.configuredDeployEnv);
  if (configured) return configured;

  const pagesBranch = options.pagesBranch?.trim();
  if (!pagesBranch) return undefined;

  const productionBranch = options.productionBranch?.trim() || "main";
  return pagesBranch === productionBranch ? "production" : "preview";
}
