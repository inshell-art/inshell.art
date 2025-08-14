import fs from "fs";
const out = "src/generated";
fs.mkdirSync(out, { recursive: true });
["pulse_PulseAuction.contract_class.json"].forEach((f) =>
  fs.copyFileSync(`contracts/pulse/target/dev/${f}`, `${out}/${f}`)
);
console.log("✓ ABI + CASM copied to src/generated/");
