import React, { useMemo } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, Line } from "@visx/shape";
import { Group } from "@visx/group";
import { Box, useToken } from "@chakra-ui/react";

type Sale = {
  timestamp: number; // seconds
  price: bigint; // wei
};

type Props = {
  sales: Sale[]; // already decoded & sorted
  k: bigint;
  pts: bigint;
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
};

/** Chakra‑friendly Visx chart that displays ring, dot, solid, pump */
export const PulseCurve: React.FC<Props> = ({
  sales,
  k,
  pts,
  width = 800,
  height = 400,
  margin = { top: 10, right: 10, bottom: 40, left: 60 },
}) => {
  if (typeof pts !== "bigint" || typeof k !== "bigint") {
    console.error("PulseCurve: pts must be a bigint");
    return null;
  }
  //todo: and convert the raw bigint to numbers for the context here then
  //todo: detect the requirement of ABIs by the curve component first
  //todo: and then implement the interfaces to contract

  const [stroke] = useToken("colors", "teal.400");
  const [dotFill] = useToken("colors", "teal.500");

  const rounds = useMemo(() => {
    if (sales.length < 1) return [];
    const r = [];
    for (let i = 0; i < sales.length; i++) {
      const cur = sales[i];
      const prev = sales[i - 1];

      // genesis ring = dot
      let ringT = cur.timestamp;
      let ringY = cur.price;

      // subsequent curves
      if (prev) {
        const dt = BigInt(cur.timestamp - prev.timestamp);
        ringT = prev.timestamp;
        ringY = prev.price + pts * dt; // initial ask = floor + Δt·pts
      }

      r.push({
        ring: { x: ringT, y: ringY },
        dot: { x: cur.timestamp, y: cur.price },
      });
    }
    return r;
  }, [sales, pts]);

  // x/y domains
  const minX = rounds[0]?.ring.x ?? 0;
  const maxX = rounds[rounds.length - 1]?.dot.x ?? 1;
  const ys = rounds.flatMap((r) => [Number(r.ring.y), Number(r.dot.y)]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const xScale = scaleLinear<number>({
    domain: [minX, maxX],
    range: [margin.left, width - margin.right],
  });
  const yScale = scaleLinear<number>({
    domain: [minY, maxY],
    range: [height - margin.bottom, margin.top],
  });

  return (
    <Box as="svg" width={width} height={height}>
      <Group>
        {rounds.map((r, i) => {
          // solid line ring→dot
          return (
            <LinePath
              key={`solid-${i}`}
              data={[r.ring, r.dot]}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(Number(d.y))}
              stroke={stroke}
              strokeWidth={2}
            />
          );
        })}

        {/* pump lines except last round */}
        {rounds.slice(0, -1).map((r, i) => {
          const nextRing = rounds[i + 1].ring;
          return (
            <Line
              key={`pump-${i}`}
              from={{ x: xScale(r.dot.x), y: yScale(Number(r.dot.y)) }}
              to={{ x: xScale(nextRing.x), y: yScale(Number(nextRing.y)) }}
              stroke={stroke}
              strokeDasharray="4,4"
              strokeWidth={1.5}
            />
          );
        })}

        {/* dots & rings */}
        {rounds.map((r, i) => (
          <g key={`glyph-${i}`}>
            {/* ring */}
            <circle
              cx={xScale(r.ring.x)}
              cy={yScale(Number(r.ring.y))}
              r={6}
              fill="white"
              stroke={stroke}
              strokeWidth={2}
            />
            {/* dot */}
            <circle
              cx={xScale(r.dot.x)}
              cy={yScale(Number(r.dot.y))}
              r={4}
              fill={dotFill}
            />
          </g>
        ))}
      </Group>
    </Box>
  );
};
