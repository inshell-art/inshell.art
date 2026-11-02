import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.argv[2] ?? "dist/home");
let checked = 0;
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (/\.(js|html)$/.test(entry.name)) {
      const content = readFileSync(path, "utf8");
      // Executable bundle only: authored/generated docs may discuss retirement.
      if (/googletagmanager\.com\/gtag|google-analytics\.com\/g\/collect|static\.cloudflareinsights\.com\/beacon|inshell-ga4-choice|__INSHELL_ANON_ANALYTICS_INSTALLED__/.test(content)) {
        throw new Error(`Optional collector remains in ${path}`);
      }
      checked++;
    }
  }
}
if (!statSync(root).isDirectory()) throw new Error("Build directory required");
check(root);
if (!checked) throw new Error("No build HTML/JS checked");
console.log(`Optional measurement OFF: ${checked} HTML/JS files checked`);
