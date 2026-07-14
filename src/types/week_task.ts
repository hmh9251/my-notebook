export type TaskStatus = "dev" | "testing" | "released";
export type TaskType = "main" | "sub" | "bug";

export interface WeekTask {
  id: number;
  name: string;
  link_url: string;
  task_no: string;
  branch: string;
  status: TaskStatus;
  type: TaskType;
  parent_id: number | null;
  content: string;
  week_key: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NewTask {
  name: string;
  link_url: string;
  task_no: string;
  branch: string;
  status: TaskStatus;
  type: TaskType;
  parent_id: number | null;
  content: string;
  week_key: string;
  sort_order: number;
}

export interface RecentWeek {
  week_key: string;
  count: number;
  start_date: string;
  end_date: string;
}