import { statSync, readdirSync, readFileSync } from "fs";
import { resolve, extname, join } from "path";

const BANNED_TERMS = [
  "RESERVED_ROLE",
  "SPARK_BASE",
  "mintSparker",
  "getReservedCap",
  "getReservedRemaining",
  "reserved_cap",
] as const;

function usage(): never {
  console.error(
    "Usage: pnpm tsx scripts/validate-path-artifacts.ts <file-or-dir> [<file-or-dir> ...]"
  );
  process.exit(1);
}

function collectJsonFiles(inputPath: string, out: string[]) {
  const full = resolve(process.cwd(), inputPath);
  const st = statSync(full);
  if (st.isDirectory()) {
    for (const name of readdirSync(full)) {
      collectJsonFiles(join(full, name), out);
    }
    return;
  }
  if (st.isFile() && extname(full).toLowerCase() === ".json") {
    out.push(full);
  }
}

function scanFile(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return BANNED_TERMS.filter((term) => text.includes(term));
}

const inputs = process.argv.slice(2);
if (!inputs.length) usage();

const jsonFiles: string[] = [];
for (const input of inputs) {
  try {
    collectJsonFiles(input, jsonFiles);
  } catch (err) {
    console.error(
      `[validate-path-artifacts] ERROR: ${input}: ${String(
        (err as Error)?.message ?? err
      )}`
    );
    process.exit(1);
  }
}

if (!jsonFiles.length) {
  console.error("[validate-path-artifacts] ERROR: no JSON files found");
  process.exit(1);
}

let failed = false;
for (const file of jsonFiles.sort()) {
  const banned = scanFile(file);
  if (!banned.length) continue;
  failed = true;
  console.error(
    `[validate-path-artifacts] REJECT ${file}\n` +
      `  contains deprecated PATH spark/reserved surface: ${banned.join(", ")}`
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `[validate-path-artifacts] OK: ${jsonFiles.length} JSON file(s) contain no deprecated PATH spark/reserved surface`
);
