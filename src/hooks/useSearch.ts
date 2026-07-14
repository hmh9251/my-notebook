import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/search";

/** 带防抖的统一搜索（180ms） */
export function useSearch(query: string) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.trim().length > 0,
    staleTime: 30 * 1000,
  });
}

export function useRecentWeeks() {
  return useQuery({
    queryKey: ["recentWeeks"],
    queryFn: () => api.getRecentWeeks(),
    staleTime: 60 * 1000,
  });
}
