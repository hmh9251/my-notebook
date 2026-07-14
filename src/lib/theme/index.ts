import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_THEME, type ThemePreset } from "./palettes";

const STORAGE_KEY = "theme_preset";

/** 纯 CSS 变量替换，零 React 重渲染 */
export function applyTheme(preset: ThemePreset): void {
  document.documentElement.dataset.theme = preset;
}

/** localStorage 里缓存的主题（initTheme 启动时写入，加载期兜底显示用） */
export function getCachedTheme(): ThemePreset | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v as ThemePreset | null;
  } catch {
    return null;
  }
}

function setCachedTheme(preset: ThemePreset) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preset);
  } catch {
    /* ignore */
  }
}

/** 启动时同步应用主题（先 localStorage 兜底，再读 DB 校正） */
export async function initTheme(): Promise<ThemePreset> {
  const cached = getCachedTheme();
  const initial = cached ?? DEFAULT_THEME;
  applyTheme(initial);

  try {
    const stored = (await invoke<string | null>("get_setting", {
      key: STORAGE_KEY,
    })) as ThemePreset | null;
    const preset = stored ?? DEFAULT_THEME;
    setCachedTheme(preset);
    applyTheme(preset);
    return preset;
  } catch {
    return initial;
  }
}

/** 切换主题：写 DB + localStorage + 应用 */
export async function setTheme(preset: ThemePreset): Promise<void> {
  applyTheme(preset);
  setCachedTheme(preset);
  await invoke("set_setting", { key: STORAGE_KEY, value: preset });
}
