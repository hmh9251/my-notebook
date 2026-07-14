// ISO 周次工具：week_key 形如 "2026-W27"

/** 由日期生成 ISO 周次 key（YYYY-Www，周一为一周起始） */
export function getWeekKeyFromDate(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // 调到本周周四（ISO 规则：含周四的那周即所属周）
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + firstDayNum) / 7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 当前周的 ISO 周次 key */
export function getCurrentWeekKey(): string {
  return getWeekKeyFromDate(new Date());
}

/** 解析 week_key → { year, week }，失败返回 null */
export function parseWeekKey(weekKey: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

/** 由 week_key 求该周周一、周日 */
export function getWeekRange(weekKey: string): { start: Date; end: Date } | null {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return null;
  const { year, week } = parsed;
  // 1 月 4 日必在第 1 周内
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

/** 格式化为日期范围展示：「MM.dd – MM.dd」 */
export function formatWeekRange(weekKey: string): string {
  const range = getWeekRange(weekKey);
  if (!range) return weekKey;
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

/** 格式化为完整中文范围：「2026年MM月dd日 – MM月dd日」 */
export function formatWeekFull(weekKey: string): string {
  const range = getWeekRange(weekKey);
  if (!range) return weekKey;
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${range.start.getFullYear()}年${fmt(range.start)} – ${fmt(range.end)}`;
}

/** 周次偏移：weekKey ± n 周 */
export function addWeeks(weekKey: string, n: number): string {
  const range = getWeekRange(weekKey);
  if (!range) return weekKey;
  const base = new Date(range.start);
  base.setDate(base.getDate() + n * 7);
  return getWeekKeyFromDate(base);
}

/** 比较两个 week_key（按时间先后），a 早于 b 返回 -1 */
export function compareWeekKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
