import type { RecentWeek } from "@/types/week_task";

export interface TaskSearchResult {
  kind: "task";
  id: number;
  name: string;
  task_no: string;
  week_key: string;
}

export interface NoteSearchResult {
  kind: "note";
  id: number;
  title: string;
  preview: string;
}

export type SearchResult = TaskSearchResult | NoteSearchResult;

export type { RecentWeek };
