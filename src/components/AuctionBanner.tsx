import { AuctionStatus } from "@/hooks/usePulseAuction";
import { fmtDate, fmtPrice } from "@/helpers/fmtDate";

type Props = { status: AuctionStatus; price: bigint; openTime: bigint };

export function AuctionBanner({ status, price, openTime }: Props) {
  switch (status) {
    case AuctionStatus.PREDEPLOY:
      return <>🚀 $PATH: ignition sequence initiated.</>;
    case AuctionStatus.COUNTDOWN:
      return <>⏳ $PATH: gate opens {fmtDate(Number(openTime))}.</>;
    case AuctionStatus.GENESIS:
      return <>⚡️ $PATH: Genesis #0 available for {fmtPrice(price)} STRK.</>;
    case AuctionStatus.LIVE:
      return <>🔥 $PATH: curve live — fuel the auction.</>;
  }
}
