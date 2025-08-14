import {
  Container,
  Stack,
  AspectRatio,
  Heading,
  useMediaQuery,
  Spinner,
  Alert,
} from "@chakra-ui/react";
import { PulseCurve } from "./PulseCurve";
import Movements from "./Movements";
import { AuctionBanner } from "./AuctionBanner";
import {
  useAuctionConfig,
  useCurrentPrice,
  useAuctionStatus,
  usePulseSales,
} from "@/hooks/usePulseAuction";

export default function Hero() {
  const [isDesktop] = useMediaQuery(["(min-width: 92px)"]); // desktop guard
  const { data: sales = [], isLoading, isError, error } = usePulseSales(100); // fetch sales data
  const auctionStatus = useAuctionStatus(); // fetch auction status
  const { data: currentPrice } = useCurrentPrice(); // fetch current price
  const { data: auctionConfig } = useAuctionConfig(); // fetch initial parameters

  if (isLoading) return <Spinner size="xl" />; // loading state
  if (isError) return <Alert.Root status="error">{error.message}</Alert.Root>; // error state

  console.log("Hero component rendered", {
    auctionStatus,
    currentPrice,
    auctionConfig,
    salesCount: sales.length,
  });

  return (
    <Container
      as="main" // renders <main>
      maxW="7xl" // 7xl → 80 rem ≈ 1280 px
      h="100vh"
      centerContent // shortcut for flex‑center
    >
      {isDesktop ? (
        <Stack w="full" gap={10} align="center">
          {auctionStatus === "LIVE" &&
            auctionConfig &&
            currentPrice !== undefined && (
              <>
                <AuctionBanner
                  status={auctionStatus}
                  price={currentPrice}
                  openTime={auctionConfig?.open_time ?? 0}
                />
                <AspectRatio ratio={5 / 3} w="full" minW="320px">
                  <PulseCurve
                    sales={sales}
                    k={auctionConfig?.k}
                    pts={auctionConfig?.pts}
                  />
                </AspectRatio>
              </>
            )}
          <Movements />
        </Stack>
      ) : (
        <Heading size="lg" textAlign="center">
          Best viewed on desktop.
        </Heading>
      )}
    </Container>
  );
}
