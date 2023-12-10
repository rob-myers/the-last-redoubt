import { useQuery } from "@tanstack/react-query";

/**
 * @template T
 * @param {string} queryKey
 * @param {import("@tanstack/react-query").QueryFunction<T>} queryFn
 */
export function useQueryOnce(queryKey, queryFn) {
  return useQuery({
    queryKey: [queryKey],
    queryFn,
    refetchOnMount: "always",
    gcTime: Infinity,
    staleTime: Infinity,
  });
}

/**
 * @template T
 * @param {string} queryKey
 * @param {import("@tanstack/react-query").QueryFunction<T>} queryFn
 */
export function useQueryWrap(queryKey, queryFn) {
  return useQuery({
    queryKey: [queryKey],
    queryFn,
  });
}
