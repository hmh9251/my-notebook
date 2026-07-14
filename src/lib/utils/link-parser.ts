// URL → 任务号解析

/**
 * 从任务链接解析任务号：取 URL path 最后一段。
 * 如 https://code.fastfish.com/browse/XXZX-29986 → "XXZX-29986"
 * 解析失败返回空串。
 */
export function parseTaskNo(link: string): string {
  if (!link) return "";
  const trimmed = link.trim();
  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : "";
  } catch {
    // 非 URL：取最后一段非空白 token
    const parts = trimmed.split(/[\/\s]+/).filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }
}
