import { create } from "zustand";

export interface PreviewTab {
  url: string;
  name: string;
  ext: string;
}

interface TaskTabsState {
  /** 每个任务打开过的预览 tab 列表 */
  tabs: Record<number, PreviewTab[]>;
  /** 每个任务的当前激活 tab：null = 正文；url = 该预览 */
  active: Record<number, string | null>;
  openTab: (taskId: number, tab: PreviewTab) => void;
  closeTab: (taskId: number, url: string) => void;
  setActive: (taskId: number, url: string | null) => void;
  clearTask: (taskId: number) => void;
}

export const useTaskTabs = create<TaskTabsState>((set) => ({
  tabs: {},
  active: {},
  openTab: (taskId, tab) =>
    set((s) => {
      const cur = s.tabs[taskId] ?? [];
      if (!cur.some((t) => t.url === tab.url)) {
        return {
          tabs: { ...s.tabs, [taskId]: [...cur, tab] },
          active: { ...s.active, [taskId]: tab.url },
        };
      }
      return { active: { ...s.active, [taskId]: tab.url } };
    }),
  closeTab: (taskId, url) =>
    set((s) => {
      const cur = s.tabs[taskId] ?? [];
      const next = cur.filter((t) => t.url !== url);
      const wasActive = s.active[taskId] === url;
      const newTabs = { ...s.tabs, [taskId]: next };
      const newActive = { ...s.active };
      if (wasActive) newActive[taskId] = null; // 关掉激活的 → 回正文
      return { tabs: newTabs, active: newActive };
    }),
  setActive: (taskId, url) =>
    set((s) => ({ active: { ...s.active, [taskId]: url } })),
  clearTask: (taskId) =>
    set((s) => {
      const newTabs = { ...s.tabs };
      const newActive = { ...s.active };
      delete newTabs[taskId];
      delete newActive[taskId];
      return { tabs: newTabs, active: newActive };
    }),
}));
