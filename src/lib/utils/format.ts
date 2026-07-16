// 通用格式化工具

/** 把 ISO/Jira 时间字符串格式化为「YYYY-MM-DD HH:mm」本地时间，解析失败原样返回 */
export function formatDateTime(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}
