import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const POLICY_FILE = "measurement-build-policy.json";
const RETIRED_COLLECTOR = /googletagmanager\.com\/gtag|google-analytics\.com\/g\/collect|inshell-ga4-choice|__INSHELL_ANON_ANALYTICS_INSTALLED__/i;
const NATIVE_LOADER = /static\.cloudflareinsights\.com\/beacon/i;

// Check a freshly built policy artifact, not arbitrary tamper-resistant JS.
// Vite emits this projection from the same publicEnv used by the bundle.
export function checkAnalyticsOffBuild(directory, { qualifiedHome = false } = {}) {
  const root = resolve(directory);
  if (!statSync(root).isDirectory()) throw new Error("Build directory required");
  let checked = 0;
  let policies = 0;

  function checkPolicy(directoryPath) {
    const policyPath = join(directoryPath, POLICY_FILE);
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    const qualifiedRoot = qualifiedHome && directoryPath === root;
    if (!policy || policy.schema !== "inshell.measurement-build-policy.v1" ||
        policy.enabled !== (qualifiedRoot ? "true" : "false") ||
        !(policy.policy === null || typeof policy.policy === "string") ||
        ![null, "local", "preview", "production"].includes(policy.deployEnv) ||
        (qualifiedRoot && (policy.policy !== "home-document-v1" || policy.deployEnv !== "production")) ||
        Object.keys(policy).sort().join(",") !== "deployEnv,enabled,policy,schema") {
      throw new Error(`Optional measurement is not configured ${qualifiedRoot ? "qualified Home-only" : "OFF"} in ${policyPath}`);
    }
    policies++;
  }

  function check(directoryPath) {
    if (directoryPath === root || existsSync(join(directoryPath, "index.html"))) {
      checkPolicy(directoryPath);
    }
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const filePath = join(directoryPath, entry.name);
      if (entry.isDirectory()) check(filePath);
      else if (/\.(js|html)$/i.test(entry.name)) {
        const content = readFileSync(filePath, "utf8");
        // Authored/generated docs may discuss retirement outside executables.
        if (RETIRED_COLLECTOR.test(content)) {
          throw new Error(`Retired collector remains in ${filePath}`);
        }
        // A dormant URL in JS is permitted. No installed/preloaded native
        // collector or inline native installer is allowed in OFF build HTML.
        if (/\.html$/i.test(entry.name) && NATIVE_LOADER.test(content)) {
          throw new Error(`Native collector remains in build HTML ${filePath}`);
        }
        checked++;
      }
    }
  }

  check(root);
  if (!checked) throw new Error("No build HTML/JS checked");
  return { checked, policies };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg.startsWith("--") && arg !== "--qualified-home") || args.filter(arg => !arg.startsWith("--")).length > 1) {
    throw new Error("Usage: check-analytics-off-build.mjs [build-directory] [--qualified-home]");
  }
  const qualifiedHome = args.includes("--qualified-home");
  const result = checkAnalyticsOffBuild(args.find(arg => !arg.startsWith("--")) ?? "dist/home", { qualifiedHome });
  console.log(`Optional measurement ${qualifiedHome ? "qualified Home-only, nested builds OFF" : "OFF"}: ${result.checked} HTML/JS files and ${result.policies} build policies checked`);
}
