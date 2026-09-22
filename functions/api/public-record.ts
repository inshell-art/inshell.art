export type PublicRecordChainObservation = {
  kind: "chain-observation";
  chainId: number | null;
  contract: string | null;
  observedAtBlock: number | null;
  transactionHash: string | null;
};

export type PublicRecordCache = {
  kind: "indexed-chain-cache";
  cachedAt: number | null;
};

export type PublicRecordConsumerRelease = {
  kind: "contract-release-consumer";
  deploymentRecordsCoupled: boolean;
  manifestSha256: string | null;
};

export type PublicRecordBody<
  Schema extends string,
  Token,
  ConsumerRelease extends PublicRecordConsumerRelease,
> = {
  schema: Schema;
  chainObservation: PublicRecordChainObservation;
  cache: PublicRecordCache;
  consumerRelease: ConsumerRelease;
  token: Token;
};

export function createPublicRecord<
  const Schema extends string,
  Token,
  ConsumerRelease extends PublicRecordConsumerRelease,
>(body: PublicRecordBody<Schema, Token, ConsumerRelease>) {
  return body;
}
