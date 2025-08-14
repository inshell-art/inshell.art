import { RpcProvider, Account, json, CallData, uint256, hash } from "starknet";
import { fileURLToPath } from "node:url";
import { realpathSync, readFileSync, writeFileSync, write } from "node:fs";
import { resolve, join } from "node:path";
import { DEVNET_URL } from "./constants";

const ART_DIR = resolve("contracts/pulse/target/dev");
const SIERRA = join(ART_DIR, "pulse_PulseAuction.contract_class.json");
const CASM = join(ART_DIR, "pulse_PulseAuction.compiled_contract_class.json");

async function waitForDevnet(url: string, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${url}/is_alive`);
      console.log("Devnet is alive");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Devnet not reachable at ${url}`);
}

export async function deploy() {
  await waitForDevnet(DEVNET_URL);

  // Use the artifacts produced by scarb + copyAbi.js
  const sierra = json.parse(readFileSync(SIERRA, "utf8"));
  const casm = json.parse(readFileSync(CASM, "utf8"));

  // Trim to baseUrl and guarantee the rpcUrl ends with /rpc
  const baseUrl = DEVNET_URL.replace(/\/rpc$/, "");
  const rpcUrl = baseUrl.endsWith("/rpc") ? baseUrl : `${baseUrl}/rpc`;

  // Take the first predeployed account from Devnet
  const [pre] = await (await fetch(`${baseUrl}/predeployed_accounts`)).json();
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, pre.address, pre.private_key);

  // Prepare calldata
  const calldata = new CallData(sierra.abi).compile("constructor", {
    start_delay_sec: 0,
    k: uint256.bnToUint256(1000n),
    genesis_price: uint256.bnToUint256(100n),
    genesis_floor: uint256.bnToUint256(90n),
    initial_pts: "1",
    treasury: pre.address,
    target_contract: "0x1",
    genesis_id: 0,
  });

  // ---- declare ----
  let classHash = hash.computeSierraContractClassHash(sierra);
  console.log("PulseAuction class hash at", pre.address, "is", classHash);
  if (classHash) {
    console.log("PulseAuction contract already declared at", classHash);
  } else {
    const declared = await account.declare({ contract: sierra, casm });
    if (declared.transaction_hash) {
      await provider.waitForTransaction(declared.transaction_hash);
    }
    classHash = declared.class_hash;
    console.log("PulseAuction contract declared:", declared);
  }

  // ---- deploy ----
  const deployed = await account.deployContract({
    classHash,
    constructorCalldata: calldata,
  });
  if (deployed.transaction_hash) {
    await provider.waitForTransaction(deployed.transaction_hash);
  }
  console.log("PulseAuction contract deployed:", deployed);

  const addr = deployed.contract_address;
  writeFileSync("contracts.json:", JSON.stringify({ PULSE: addr }, null, 2));
  console.log("✔ PulseAuction contract address:", addr);
}

// ESM main guard
const me = realpathSync(fileURLToPath(import.meta.url));
const entry = realpathSync(resolve(process.argv[1] ?? ""));
if (me === entry)
  deploy().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
