import { Flex, Text } from "@chakra-ui/react";
import { useState, useEffect } from "react";

export default function Movements() {
  const [opacity, setOpacity] = useState(0.4);

  useEffect(() => {
    const id = setInterval(() => setOpacity((o) => Math.min(o + 0.05, 1)), 120);
    return () => clearInterval(id);
  }, []);

  return (
    <Flex w="100%" mx="auto" justify="space-between" align="center">
      {["THOUGHT", "WILL", "AWA!"].map((word) => (
        <Text
          key={word}
          flex="1" /* each cell gets equal width        */
          textAlign="center" /* word centred inside its cell      */
          fontFamily="'Source Code Pro', monospace"
          fontWeight="200"
          fontSize="6xl"
          color={"grey"}
          opacity={opacity}
          transition="opacity 0.3s"
          gap={20}
          px={2} /* horizontal padding for each cell */
        >
          {word}
        </Text>
      ))}
    </Flex>
  );
}
