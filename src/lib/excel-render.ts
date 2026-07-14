import ExcelJS from "exceljs";

/** Office 默认主题色（theme 索引 → hex，无 #） */
const THEME: Record<number, string> = {
  0: "FFFFFF", // Background1
  1: "000000", // Text1
  2: "EEECE1", // Background2
  3: "1F497D", // Text2
  4: "4472C4", // Accent1
  5: "ED7D31", // Accent2
  6: "A5A5A5", // Accent3
  7: "FFC000", // Accent4
  8: "5B9BD5", // Accent5
  9: "70AD47", // Accent6
  10: "0563C1", // Hyperlink
  11: "990000", // FollowedHyperlink
};

interface XlsxColor {
  argb?: string;
  theme?: number;
  tint?: number;
  rgb?: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex2(n: number): string {
  return clamp(n).toString(16).padStart(2, "0");
}

/** tint 调亮/调暗（>0 偏白，<0 偏黑） */
function applyTint(hex: string, tint: number): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (tint < 0) {
    const f = 1 + tint;
    return toHex2(r * f) + toHex2(g * f) + toHex2(b * f);
  }
  return toHex2(r + (255 - r) * tint) + toHex2(g + (255 - g) * tint) + toHex2(b + (255 - b) * tint);
}

/** 颜色 → #RRGGBB */
function colorCss(c?: XlsxColor): string | null {
  if (!c) return null;
  let hex: string | null = null;
  if (c.argb) hex = c.argb.length === 8 ? c.argb.slice(2) : c.argb;
  else if ((c as { rgb?: string }).rgb) hex = (c as { rgb: string }).rgb;
  else if (c.theme != null) hex = THEME[c.theme] ?? null;
  if (!hex) return null;
  if (c.tint && c.tint !== 0) hex = applyTint(hex, c.tint);
  return `#${hex}`;
}

function fontCss(font?: Partial<ExcelJS.Font>): string {
  if (!font) return "";
  let s = "";
  if (font.bold) s += "font-weight:bold;";
  if (font.italic) s += "font-style:italic;";
  const decos: string[] = [];
  if (font.underline) decos.push("underline");
  if (font.strike) decos.push("line-through");
  if (decos.length) s += `text-decoration:${decos.join(" ")};`;
  if (font.size) s += `font-size:${font.size}px;`;
  if (font.name) s += `font-family:${font.name},sans-serif;`;
  const col = colorCss(font.color as XlsxColor);
  if (col) s += `color:${col};`;
  return s;
}

function fillCss(fill?: { type?: string; pattern?: string; fgColor?: XlsxColor; bgColor?: XlsxColor }): string {
  if (!fill || fill.type !== "pattern" || !fill.pattern) return "";
  const col = colorCss(fill.fgColor) ?? colorCss(fill.bgColor);
  return col ? `background-color:${col};` : "";
}

const BORDER_CSS: Record<string, string> = {
  thin: "1px solid",
  medium: "2px solid",
  thick: "3px solid",
  dashed: "1px dashed",
  dotted: "1px dotted",
  dot: "1px dotted",
  double: "3px double",
  hair: "1px solid",
  mediumDashed: "2px dashed",
  mediumDashDot: "2px solid",
  mediumDashDotDot: "2px solid",
  dashDot: "1px dashed",
  dashDotDot: "1px dashed",
  slantDashDot: "2px solid",
};

function borderCss(border?: {
  top?: { style?: string; color?: XlsxColor };
  bottom?: { style?: string; color?: XlsxColor };
  left?: { style?: string; color?: XlsxColor };
  right?: { style?: string; color?: XlsxColor };
}): string {
  if (!border) return "";
  const sides: Array<[{ style?: string; color?: XlsxColor } | undefined, string]> = [
    [border.top, "top"],
    [border.bottom, "bottom"],
    [border.left, "left"],
    [border.right, "right"],
  ];
  let s = "";
  for (const [side, name] of sides) {
    if (!side || !side.style || side.style === "none") continue;
    const w = BORDER_CSS[side.style] ?? "1px solid";
    const col = colorCss(side.color) ?? "#999999";
    s += `border-${name}:${w} ${col};`;
  }
  return s;
}

function alignCss(al?: {
  horizontal?: string;
  vertical?: string;
  wrapText?: boolean;
  indent?: number;
  textRotation?: number;
}): string {
  if (!al) return "";
  let s = "";
  if (al.horizontal) s += `text-align:${al.horizontal};`;
  if (al.vertical) s += `vertical-align:${al.vertical};`;
  if (al.wrapText) s += "white-space:normal;word-break:break-word;";
  if (al.indent) s += `padding-left:${al.indent * 8}px;`;
  if (al.textRotation) s += `writing-mode:${al.textRotation === 255 ? "vertical-rl" : "horizontal-tb"};`;
  return s;
}

/** 列字母（A, B, …, AA）→ 数字（1 起） */
function colLettersToNum(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - "A".charCodeAt(0) + 1);
  }
  return n;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 取单元格显示文本 */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | { formula?: string; result?: unknown; richText?: { text: string }[]; text?: string; hyperlink?: string; sharedFormula?: string };
  if (v == null) return "";
  if (typeof v === "string") return escapeHtml(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return escapeHtml(v.toLocaleString());
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => escapeHtml(r.text ?? "")).join("");
    }
    if ("result" in v && v.result != null) return String(v.result);
    if ("text" in v && v.text != null) return escapeHtml(v.text);
    if ("hyperlink" in v && v.hyperlink) return escapeHtml(String(v.hyperlink));
    return "";
  }
  return escapeHtml(String(v));
}

export interface RenderedSheet {
  name: string;
  html: string;
}

/** 用 exceljs 把 xlsx 字节渲染成 HTML（带颜色/删除线/边框/对齐/合并） */
export async function renderXlsx(bytes: Uint8Array): Promise<RenderedSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  const out: RenderedSheet[] = [];
  for (const ws of wb.worksheets) {
    out.push({ name: ws.name, html: renderSheet(ws) });
  }
  return out;
}

function renderSheet(ws: ExcelJS.Worksheet): string {
  const rowCount = ws.rowCount || 0;
  const colCount = ws.columnCount || 0;
  if (rowCount === 0 || colCount === 0) return '<table class="xlsx-tbl"><tbody></tbody></table>';

  // 合并单元格：exceljs model.merges 为 "A1:C3" 形式字符串
  const masters = new Map<string, { rs: number; cs: number }>();
  const slaves = new Set<string>();
  const merges: string[] = ws.model?.merges ?? [];
  for (const range of merges) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
    if (!m) continue;
    const top = Number(m[2]);
    const left = colLettersToNum(m[1]);
    const bottom = Number(m[4]);
    const right = colLettersToNum(m[3]);
    masters.set(`${top}_${left}`, {
      rs: bottom - top + 1,
      cs: right - left + 1,
    });
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (r !== top || c !== left) slaves.add(`${r}_${c}`);
      }
    }
  }

  const capRows = Math.min(rowCount, 5000);
  let html = '<table class="xlsx-tbl"><tbody>';
  for (let r = 1; r <= capRows; r++) {
    let rowHtml = "<tr>";
    for (let c = 1; c <= colCount; c++) {
      if (slaves.has(`${r}_${c}`)) continue;
      const cell = ws.getRow(r).getCell(c);
      const style =
        fontCss(cell.font as Partial<ExcelJS.Font> | undefined) +
        fillCss(cell.fill as { type?: string; pattern?: string; fgColor?: XlsxColor; bgColor?: XlsxColor } | undefined) +
        borderCss(cell.border as Parameters<typeof borderCss>[0] | undefined) +
        alignCss(cell.alignment as Parameters<typeof alignCss>[0] | undefined);
      const m = masters.get(`${r}_${c}`);
      const span = m ? ` rowspan="${m.rs}" colspan="${m.cs}"` : "";
      rowHtml += `<td${span} style="${style}">${cellText(cell)}</td>`;
    }
    rowHtml += "</tr>";
    html += rowHtml;
  }
  html += "</tbody></table>";
  return html;
}
