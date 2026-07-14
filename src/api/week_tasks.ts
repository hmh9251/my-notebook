import { invoke } from "@tauri-apps/api/core";
import type { WeekTask, NewTask } from "@/types/week_task";

export async function getTasksByWeek(week_key: string): Promise<WeekTask[]> {
  return invoke("get_tasks_by_week", { weekKey: week_key });
}

export async function getAllWeekKeys(): Promise<string[]> {
  return invoke("get_all_week_keys");
}

export async function getTaskById(id: number): Promise<WeekTask | null> {
  return invoke("get_task_by_id", { id });
}

export async function getTaskChildren(id: number): Promise<WeekTask[]> {
  return invoke("get_task_children", { id });
}

export async function getWeekTaskChildren(
  week_key: string,
): Promise<Record<string, WeekTask[]>> {
  // Rust 端 HashMap<i64, Vec<WeekTask>> → JSON 对象，key 为字符串
  return invoke("get_week_task_children", { weekKey: week_key });
}

export async function reorderTasks(week_key: string, ordered_ids: number[]): Promise<void> {
  return invoke("reorder_tasks", { weekKey: week_key, orderedIds: ordered_ids });
}

export async function createTask(task: NewTask): Promise<WeekTask> {
  return invoke("create_task", { task });
}

/** upsert：按 (week_key, task_no) 存在则更新，不存在则新建（Jira 导入用） */
export async function upsertTask(task: NewTask): Promise<WeekTask> {
  return invoke("upsert_task", { task });
}

export async function updateTask(id: number, task: NewTask): Promise<WeekTask> {
  return invoke("update_task", { id, task });
}

export async function updateTaskStatus(id: number, status: string): Promise<WeekTask> {
  return invoke("update_task_status", { id, status });
}

export async function updateTaskSortOrder(id: number, sort_order: number): Promise<WeekTask> {
  return invoke("update_task_sort_order", { id, sortOrder: sort_order });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

export async function generateWeeklyReport(week_key: string): Promise<string> {
  return invoke("generate_weekly_report", { weekKey: week_key });
}

/** 复制任务：from_week 的 ids → to_week */
export async function copyWeekTasks(
  from_week: string,
  to_week: string,
  task_ids: number[],
): Promise<number> {
  return invoke("copy_week_tasks", {
    fromWeek: from_week,
    toWeek: to_week,
    taskIds: task_ids,
  });
}

/** 删除 N 个月前的任务 */
export async function deleteOldTasks(months: number): Promise<number> {
  return invoke("delete_old_tasks", { months });
}
