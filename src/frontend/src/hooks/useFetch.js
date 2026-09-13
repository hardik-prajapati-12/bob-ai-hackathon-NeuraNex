import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic data-fetching hook.
 * Handles loading, error, and data states.
 * Cancels in-flight requests on unmount or dependency change.
 */
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  const execute = useCallback(async () => {
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (!cancelRef.current) setData(result);
    } catch (err) {
      if (!cancelRef.current) {
        setError(err.response?.data?.message || err.message || 'Failed to load data');
      }
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    execute();
    return () => { cancelRef.current = true; };
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

/**
 * Debounce hook for search inputs.
 */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
