import fs from "fs";
import { RpcProvider, Account, Contract, uint256 } from "starknet";
import bids from "./fixtures/bidPlan.json";
import abi from "../contracts/pulse/abi/PulseAuction.json";

export async function seed(devnetUrl: string) {
  const pre = JSON.parse(
    await (await fetch(`${devnetUrl}/predeployed_accounts`)).text()
  )[0];

  const provider = new RpcProvider({ nodeUrl: devnetUrl });
  const account = new Account(provider, pre.address, pre.private_key);

  const { PULSE } = JSON.parse(fs.readFileSync("contracts.json", "utf8"));
  const pulse = new Contract(abi as any, PULSE, account);

  for (const { quantity, price } of bids) {
    await pulse.invoke("place_bid", [uint256.bnToUint256(quantity), price]);
  }
  console.log(`✔ seeded ${bids.length} bids`);
}

if (require.main === module) {
  const url = process.argv[2] ?? "http://127.0.0.1:5050";
  await seed(url);
}
