import { statSync, readdirSync, readFileSync } from "fs";
import { basename, resolve, extname, join } from "path";

const SPARK_SELF_CLAIM_FUNCTIONS = [
  ["allowSparker", ["address"]],
  ["mintSparker", ["bytes"]],
  ["sparkClaimDuration", []],
  ["sparkAllowanceExpiresAt", ["address"]],
  ["getReservedCap", []],
  ["getReservedRemaining", []],
  ["isSparker", ["uint256"]],
] as const;

const SPARK_SELF_CLAIM_EVENTS = [
  ["SparkerAllowed", ["address", "uint64"]],
  ["SparkerMinted", ["address", "uint256"]],
] as const;

type AbiInput = { type?: unknown };
type AbiItem = {
  type?: unknown;
  name?: unknown;
  inputs?: AbiInput[];
};

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

function abiSignature(item: AbiItem) {
  const inputs = Array.isArray(item.inputs)
    ? item.inputs.map((input) => String(input?.type ?? ""))
    : [];
  return `${String(item.name ?? "")}(${inputs.join(",")})`;
}

function hasAbiItem(
  abi: AbiItem[],
  type: "function" | "event",
  name: string,
  inputs: readonly string[]
) {
  return abi.some(
    (item) =>
      item?.type === type &&
      item?.name === name &&
      abiSignature(item) === `${name}(${inputs.join(",")})`
  );
}

function validatePathAbi(file: string, abi: AbiItem[]) {
  const errors: string[] = [];
  if (hasAbiItem(abi, "function", "mintSparker", ["address", "bytes"])) {
    errors.push("contains obsolete issuer-direct mintSparker(address,bytes)");
  }

  const sparkNames = new Set([
    ...SPARK_SELF_CLAIM_FUNCTIONS.map(([name]) => name),
    ...SPARK_SELF_CLAIM_EVENTS.map(([name]) => name),
  ]);
  const exposesSpark = abi.some((item) => sparkNames.has(String(item?.name ?? "")));
  if (!exposesSpark) return errors;

  for (const [name, inputs] of SPARK_SELF_CLAIM_FUNCTIONS) {
    if (!hasAbiItem(abi, "function", name, inputs)) {
      errors.push(`missing Spark self-claim function ${name}(${inputs.join(",")})`);
    }
  }
  for (const [name, inputs] of SPARK_SELF_CLAIM_EVENTS) {
    if (!hasAbiItem(abi, "event", name, inputs)) {
      errors.push(`missing Spark self-claim event ${name}(${inputs.join(",")})`);
    }
  }

  if (basename(file) !== "PathNFT.json") {
    errors.push("Spark self-claim ABI must be published as PathNFT.json");
  }
  return errors;
}

function validatePathRelease(value: Record<string, unknown>) {
  const errors: string[] = [];
  if (value.protocol !== "path") return errors;
  const config =
    value.config && typeof value.config === "object" && !Array.isArray(value.config)
      ? (value.config as Record<string, unknown>)
      : {};
  const hasReservedCap = config.reserved_cap !== undefined;
  const hasClaimDuration = config.spark_claim_duration_sec !== undefined;
  if (hasReservedCap !== hasClaimDuration) {
    errors.push("Spark config must include reserved_cap and spark_claim_duration_sec together");
    return errors;
  }
  if (!hasReservedCap) return errors;

  for (const key of ["reserved_cap", "spark_claim_duration_sec"]) {
    if (typeof config[key] !== "string" || !/^\d+$/.test(String(config[key]))) {
      errors.push(`invalid Spark config ${key}`);
    }
  }
  if (
    typeof config.spark_claim_duration_sec === "string" &&
    /^\d+$/.test(config.spark_claim_duration_sec) &&
    BigInt(config.spark_claim_duration_sec) <= 0n
  ) {
    errors.push("spark_claim_duration_sec must be positive");
  }
  return errors;
}

function validateFile(file: string) {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return [`invalid JSON: ${String((error as Error)?.message ?? error)}`];
  }

  if (Array.isArray(value)) {
    return validatePathAbi(file, value as AbiItem[]);
  }
  if (value && typeof value === "object") {
    return validatePathRelease(value as Record<string, unknown>);
  }
  return [];
}

const inputs = process.argv.slice(2);
if (!inputs.length) usage();

const jsonFiles: string[] = [];
for (const input of inputs) {
  try {
    collectJsonFiles(input, jsonFiles);
  } catch (error) {
    console.error(
      `[validate-path-artifacts] ERROR: ${input}: ${String(
        (error as Error)?.message ?? error
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
  const errors = validateFile(file);
  if (!errors.length) continue;
  failed = true;
  console.error(
    `[validate-path-artifacts] REJECT ${file}\n` +
      errors.map((error) => `  ${error}`).join("\n")
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `[validate-path-artifacts] OK: ${jsonFiles.length} JSON file(s) conform to the PATH Spark self-claim policy`
);
