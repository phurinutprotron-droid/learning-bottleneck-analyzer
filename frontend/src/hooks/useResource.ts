import { useEffect, useState } from "react";
import { api } from "../services/api";
export function useResource<T>(
  path: string | null,
  token: string,
  revision = 0,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    if (!path) return;
    setLoading(true);
    api<T>(path, token)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, token, revision]);
  return { data, error, loading };
}
