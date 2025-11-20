import { useEffect, useState } from "react";
import "./Movements.css";

export default function Movements() {
  const [opacity, setOpacity] = useState(0.4);

  useEffect(() => {
    const id = setInterval(() => setOpacity((o) => Math.min(o + 0.05, 1)), 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="movements" style={{ opacity }}>
      {["THOUGHT", "WILL", "AWA!"].map((word) => (
        <div key={word} className="movements__word">
          {word}
        </div>
      ))}
    </div>
  );
}
