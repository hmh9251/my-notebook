/** 主题预设 id（对应 CSS [data-theme] 与 settings 表 theme_preset） */
export type ThemePreset =
  | "creamyWhite"
  | "coolGray"
  | "mintWhite"
  | "roseWhite"
  | "linearDark";

export interface PaletteMeta {
  id: ThemePreset;
  name: string;
  /** 强调色 hex，用于色板预览 */
  accent: string;
  /** 背景色 hex，用于色板预览 */
  background: string;
  dark?: boolean;
}

/** 5 套预设（默认奶油白） */
export const PALETTES: PaletteMeta[] = [
  { id: "creamyWhite", name: "奶油白", accent: "#B45A3A", background: "#F7F3EE" },
  { id: "coolGray", name: "冷灰白", accent: "#5E6AD2", background: "#F7F7F9" },
  { id: "mintWhite", name: "薄荷白", accent: "#12A374", background: "#F3F8F6" },
  { id: "roseWhite", name: "粉白", accent: "#C8477A", background: "#F9F2F5" },
  { id: "linearDark", name: "线性深色", accent: "#5E6AD2", background: "#0F0F12", dark: true },
];

export const DEFAULT_THEME: ThemePreset = "creamyWhite";

export function getPalette(id: ThemePreset): PaletteMeta {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
