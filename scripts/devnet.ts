import { Devnet } from "starknet-devnet";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { TAG, HOST, PORT } from "./constants.js";

export async function startDevnet() {
  const devnet = await Devnet.spawnVersion(TAG, {
    args: [
      "--seed",
      "0",
      "--accounts",
      "2",
      "--host",
      HOST,
      "--port",
      String(PORT),
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  await devnet.provider.setGasPrice({
    l1GasPrice: 1n,
    l1DataGasPrice: 1n,
    l2GasPrice: 1n,
  });
  console.log("Devnet URL:", devnet.provider.url);
  console.log("isAlive:", await devnet.provider.isAlive());

  process.stdin.resume();

  process.once("SIGINT", async () => {
    devnet.kill();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    devnet.kill();
    process.exit(0);
  });
}

// Main guard: normalize both sides to native, real paths
const me = realpathSync(fileURLToPath(import.meta.url));
const entry = realpathSync(resolve(process.argv[1] ?? ""));
console.log("me:", me);
console.log("entry:", entry);
if (me === entry) {
  await startDevnet();
}
