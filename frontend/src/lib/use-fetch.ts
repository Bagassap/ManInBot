"use client";

import { useEffect, useState } from "react";

interface Result<T> {
  key: string;
  data: T | null;
  error: Error | null;
  at: number;
}

export function useFetch<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetcher().then(
      (data) =>
        !cancelled && setState({ key, data, error: null, at: Date.now() }),
      (error: unknown) =>
        !cancelled &&
        setState({
          key,
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
          at: Date.now(),
        }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: state?.data ?? null,
    error: state?.key === key ? state.error : null,
    updatedAt: state?.at ?? null,
    loading: key !== null && state?.key !== key,
  };
}
