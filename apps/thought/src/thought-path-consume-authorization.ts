import { AbiCoder, id, keccak256 } from "ethers";

export const PATH_V0_5_0_CONSUME_AUTHORIZATION_SCHEMA = "permission-epoch-v1";
export const PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPE =
  "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 permissionEpoch,uint256 nonce,uint256 deadline)";
export const PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPEHASH = id(
  PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPE,
);

const abiCoder = AbiCoder.defaultAbiCoder();

export type PathV050ConsumeAuthorization = {
  pathNft: string;
  chainId: bigint;
  pathId: bigint;
  movement: string;
  claimer: string;
  executor: string;
  permissionEpoch: bigint;
  nonce: bigint;
  deadline: bigint;
};

export const hashPathV050ConsumeAuthorization = (
  authorization: PathV050ConsumeAuthorization,
) => keccak256(abiCoder.encode(
  [
    "bytes32",
    "address",
    "uint256",
    "uint256",
    "bytes32",
    "address",
    "address",
    "uint256",
    "uint256",
    "uint256",
  ],
  [
    PATH_V0_5_0_CONSUME_AUTHORIZATION_TYPEHASH,
    authorization.pathNft,
    authorization.chainId,
    authorization.pathId,
    authorization.movement,
    authorization.claimer,
    authorization.executor,
    authorization.permissionEpoch,
    authorization.nonce,
    authorization.deadline,
  ],
));
