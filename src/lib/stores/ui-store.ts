import { create } from "zustand";
import { getCurrentWeekKey } from "@/lib/utils/week-key";

/** 主内容区正在预览的文件（来自任务正文链接 / 侧栏最近预览） */
export interface ActivePreview {
  url: string;
  name: string;
  ext: string;
}

interface UIStore {
  /** 当前选中的周次（ISO key，如 2026-W27） */
  selectedWeek: string;
  setSelectedWeek: (w: string) => void;
  /** 当前选中的笔记 id（M3 笔记用） */
  selectedNoteId: number | null;
  setSelectedNoteId: (id: number | null) => void;
  /** 笔记文件夹过滤：null=全部 / number=某文件夹 / "uncat"=未分类 */
  noteFolderFilter: number | null | "uncat";
  setNoteFolderFilter: (f: number | null | "uncat") => void;
  /** 主内容区正在预览的文件 */
  activePreview: ActivePreview | null;
  setActivePreview: (p: ActivePreview) => void;
  clearActivePreview: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedWeek: getCurrentWeekKey(),
  setSelectedWeek: (w) => set({ selectedWeek: w }),
  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  noteFolderFilter: null,
  setNoteFolderFilter: (f) => set({ noteFolderFilter: f }),
  activePreview: null,
  setActivePreview: (p) => set({ activePreview: p }),
  clearActivePreview: () => set({ activePreview: null }),
}));
