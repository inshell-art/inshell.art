import { addresses } from "../config/env";
import { loadAdapterConfig } from "../protocol/adapter";
import { minter_has_role } from "../protocol/minter";
import { nft_has_role } from "../protocol/nft";
import { MINTER_ROLE, SALES_ROLE } from "../domain/roles";
import { validateAndParseAddress } from "starknet";

export type Status = {
  nftMinterRole: boolean;
  minterSalesRole: boolean;
  adapterAuctionOk: boolean;
  adapterMinterOk: boolean;
  details: {
    adapterAuction?: string;
    adapterMinter?: string;
  };
  ok: boolean;
};

const { auction, minter } = await loadAdapterConfig();

const sameAddress = (a: string, b: string) => {
  try {
    return validateAndParseAddress(a) === validateAndParseAddress(b);
  } catch {
    return false;
  }
};

export async function readStatus(): Promise<Status> {
  const nftMinterRole = await nft_has_role(
    addresses.PATH_NFT,
    MINTER_ROLE,
    addresses.PATH_MINTER
  );
  const minterSalesRole = await minter_has_role(
    addresses.PATH_MINTER,
    SALES_ROLE,
    addresses.PATH_ADAPTER
  );

  const adapterAuctionOk = sameAddress(auction, addresses.PULSE_AUCTION);
  const adapterMinterOk = sameAddress(minter, addresses.PATH_MINTER);

  return {
    nftMinterRole,
    minterSalesRole,
    adapterAuctionOk,
    adapterMinterOk,
    details: { adapterAuction: auction, adapterMinter: minter },
    ok: nftMinterRole && minterSalesRole && adapterAuctionOk && adapterMinterOk,
  };
}
