import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/settings";
import { DEFAULT_THEME, type ThemePreset } from "@/lib/theme/palettes";
import { applyTheme, getCachedTheme, setTheme } from "@/lib/theme";

/** 读单个设置项 */
export function useSetting(key: string) {
  return useQuery({
    queryKey: ["setting", key],
    queryFn: () => api.getSetting(key),
    staleTime: 60 * 1000,
  });
}

/** 主题 hook：当前主题 + 切换（即时应用 + 乐观更新缓存 + 写 DB） */
export function useTheme() {
  const queryClient = useQueryClient();
  const { data: preset } = useSetting("theme_preset");
  // 加载期用 localStorage 缓存兜底（initTheme 已应用），不刷成默认
  const current =
    (preset as ThemePreset | null) ?? getCachedTheme() ?? DEFAULT_THEME;

  // 仅在拿到真实 DB 值时同步 CSS 变量，避免加载中刷成默认主题
  useEffect(() => {
    if (preset) applyTheme(preset as ThemePreset);
  }, [preset]);

  // 切换：立即应用 + 乐观更新 queryData（选中框马上变）+ 写 DB + 失效重拉
  const change = useCallback(
    (p: ThemePreset) => {
      void setTheme(p);
      queryClient.setQueryData(["setting", "theme_preset"], p);
      queryClient.invalidateQueries({ queryKey: ["setting", "theme_preset"] });
    },
    [queryClient],
  );

  return { current, change };
}

/** 写设置项（通用） */
export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.setSetting(key, value),
    onSuccess: (_d, { key }) => {
      queryClient.invalidateQueries({ queryKey: ["setting", key] });
    },
  });
}
