import { addrs } from "../config/env";
import { adapter_get_config } from "../protocol/adapter";
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

const eq = (a?: string, b?: string) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

export async function readPulseStatus(): Promise<PulseStatus> {
  const cfg = await adapter_get_config(addrs.PATH_ADAPTER); // { auction, minter }

  const nftMinterRole = await nft_has_role(
    addrs.PATH_NFT,
    MINTER_ROLE,
    addrs.PATH_MINTER
  );
  const minterSalesRole = await minter_has_role(
    addrs.PATH_MINTER,
    SALES_ROLE,
    addrs.PATH_ADAPTER
  );

  const adapterAuctionOk = eq(cfg.auction, addrs.PULSE_AUCTION);
  const adapterMinterOk = eq(cfg.minter, addrs.PATH_MINTER);

  return {
    nftMinterRole,
    minterSalesRole,
    adapterAuctionOk,
    adapterMinterOk,
    details: { adapterAuction: cfg.auction, adapterMinter: cfg.minter },
    ok: nftMinterRole && minterSalesRole && adapterAuctionOk && adapterMinterOk,
  };
}
