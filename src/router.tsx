import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Reuse data for 30s when moving between pages instead of refetching on every visit.
  // Any successful save marks all cached data stale so no page shows outdated values.
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => { void queryClient.invalidateQueries(); },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: 1 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
