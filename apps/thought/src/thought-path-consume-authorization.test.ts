import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import {
  PATH_V0_5_0_CONSUME_AUTHORIZATION_SCHEMA,
  PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPE,
  hashPathV050ConsumeAuthorization,
} from "./thought-path-consume-authorization";

const base = {
  pathNft: "0x0000000000000000000000000000000000000001",
  chainId: 31338n,
  pathId: 7n,
  movement: `0x${Buffer.from("THOUGHT").toString("hex").padEnd(64, "0")}`,
  claimer: "0x0000000000000000000000000000000000000002",
  executor: "0x0000000000000000000000000000000000000003",
  permissionEpoch: 0n,
  nonce: 4n,
  deadline: 1_900_000_000n,
};

export const runThoughtPathConsumeAuthorizationTests = () => {
  assert.equal(PATH_V0_5_0_CONSUME_AUTHORIZATION_SCHEMA, "permission-epoch-v1");
  assert.equal(PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPE,
    "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 permissionEpoch,uint256 nonce,uint256 deadline)",
  );

  const beforeTransfer = hashPathV050ConsumeAuthorization(base);
  const afterTransfer = hashPathV050ConsumeAuthorization({
    ...base,
    permissionEpoch: base.permissionEpoch + 1n,
  });
  assert.notEqual(
    afterTransfer,
    beforeTransfer,
    "a PATH transfer epoch must invalidate the older consume digest",
  );
};
