import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/storage";

export function useStoragePath() {
  return useQuery({
    queryKey: ["storagePath"],
    queryFn: () => api.getStoragePath(),
    staleTime: Infinity,
  });
}

export function useChangeStoragePath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newDir: string) => api.changeStoragePath(newDir),
    onMutate: () => {
      // 迁移后会重启，但若失败需失效以便刷新
      queryClient.invalidateQueries();
    },
  });
}
