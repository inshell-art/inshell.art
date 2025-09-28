import { useEffect, useState } from "react";
import { readStatus, Status } from "../services/statusService";

export function usePulseStatus(pollMs = 3000) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        const res = await readStatus();
        if (!stop) {
          setData(res);
          setError(null);
        }
      } catch (e: any) {
        if (!stop) setError(String(e?.message || e));
      }
    }

    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { data, error };
}
