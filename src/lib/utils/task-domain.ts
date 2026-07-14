import type { TaskStatus, TaskType } from "@/types/week_task";

export const STATUS_ORDER: TaskStatus[] = ["dev", "testing", "released"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  dev: "开发中",
  testing: "已提测",
  released: "已上线",
};

export const TYPE_LABEL: Record<TaskType, string> = {
  main: "主任务",
  sub: "子任务",
  bug: "缺陷",
};

/** 循环切换：dev → testing → released → dev */
export function nextStatus(status: TaskStatus): TaskStatus {
  const i = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}
