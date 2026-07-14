import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/files";

export function useCachedFiles() {
  return useQuery({
    queryKey: ["cachedFiles"],
    queryFn: () => api.listCachedFiles(),
  });
}

export function useCacheFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.cacheFile(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cachedFiles"] });
    },
  });
}

export function useDeleteCachedFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.deleteCachedFile(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cachedFiles"] });
    },
  });
}
