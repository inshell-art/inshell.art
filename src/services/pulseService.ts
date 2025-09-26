import { addresses } from "../config/env";
import { loadAdapterConfig, loadAdapterConfig1 } from "../protocol/adapter";
import { minter_has_role } from "../protocol/minter";
import { nft_has_role } from "../protocol/nft";
import { MINTER_ROLE, SALES_ROLE } from "../domain/roles";

export type PulseStatus = {
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

const { auction, minter } = await loadAdapterConfig1();

const eq = (a?: string, b?: string) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

export async function readPulseStatus(): Promise<PulseStatus> {
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

  const adapterAuctionOk = eq(auction, addresses.PULSE_AUCTION);
  const adapterMinterOk = eq(minter, addresses.PATH_MINTER);

  return {
    nftMinterRole,
    minterSalesRole,
    adapterAuctionOk,
    adapterMinterOk,
    details: { adapterAuction: auction, adapterMinter: minter },
    ok: nftMinterRole && minterSalesRole && adapterAuctionOk && adapterMinterOk,
  };
}
