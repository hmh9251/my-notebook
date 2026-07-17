import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/week_tasks";
import type { NewTask, WeekTask } from "@/types/week_task";

export function useTasksByWeek(week_key: string) {
  return useQuery({
    queryKey: ["tasks", week_key],
    queryFn: () => api.getTasksByWeek(week_key),
  });
}

export function useWeekTaskChildren(week_key: string) {
  return useQuery({
    queryKey: ["weekTaskChildren", week_key],
    queryFn: () => api.getWeekTaskChildren(week_key),
  });
}

export function useWeekKeys() {
  return useQuery({
    queryKey: ["weekKeys"],
    queryFn: () => api.getAllWeekKeys(),
  });
}

export function useTaskById(id: number | undefined) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => (id == null ? null : api.getTaskById(id)),
    enabled: id != null,
  });
}

export function useTaskChildren(id: number | undefined) {
  return useQuery({
    queryKey: ["taskChildren", id],
    queryFn: () => (id == null ? [] : api.getTaskChildren(id)),
    enabled: id != null,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) => api.createTask(task),
    onSuccess: (_, task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.week_key] });
      queryClient.invalidateQueries({ queryKey: ["weekTaskChildren", task.week_key] });
      queryClient.invalidateQueries({ queryKey: ["weekKeys"] });
      queryClient.invalidateQueries({ queryKey: ["recentWeeks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, task }: { id: number; task: NewTask }) => api.updateTask(id, task),
    onSuccess: (_updated, { id, task }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.week_key] });
      queryClient.invalidateQueries({ queryKey: ["weekTaskChildren", task.week_key] });
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      queryClient.invalidateQueries({ queryKey: ["taskChildren"] });
      queryClient.invalidateQueries({ queryKey: ["recentWeeks"] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateTaskStatus(id, status),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", task.week_key] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ week_key, ordered_ids }: { week_key: string; ordered_ids: number[] }) =>
      api.reorderTasks(week_key, ordered_ids),
    onMutate: async ({ week_key, ordered_ids }) => {
      const queryKey = ["tasks", week_key] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WeekTask[]>(queryKey);

      queryClient.setQueryData<WeekTask[]>(queryKey, (current = []) => {
        const byId = new Map(current.map((task) => [task.id, task]));
        const orderedTopLevel = ordered_ids
          .map((id, sortOrder) => {
            const task = byId.get(id);
            return task ? { ...task, sort_order: sortOrder } : null;
          })
          .filter((task): task is WeekTask => task !== null);
        const orderedIdSet = new Set(ordered_ids);
        const remaining = current.filter((task) => !orderedIdSet.has(task.id));
        return [...orderedTopLevel, ...remaining];
      });

      return { previous, queryKey };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, { week_key }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", week_key] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["weekTaskChildren"] });
      queryClient.invalidateQueries({ queryKey: ["weekKeys"] });
      queryClient.invalidateQueries({ queryKey: ["taskChildren"] });
      queryClient.invalidateQueries({ queryKey: ["recentWeeks"] });
    },
  });
}

export async function generateWeeklyReport(week_key: string): Promise<string> {
  return api.generateWeeklyReport(week_key);
}

/** upsert 任务（Jira 导入用）：按 (week, taskNo) 刷新不重复 */
export function useUpsertTask(weekKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) => api.upsertTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", weekKey] });
      queryClient.invalidateQueries({ queryKey: ["weekTaskChildren", weekKey] });
      queryClient.invalidateQueries({ queryKey: ["recentWeeks"] });
    },
  });
}

export function useCopyWeekTasks(toWeek: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      from_week,
      task_ids,
    }: {
      from_week: string;
      task_ids: number[];
    }) => api.copyWeekTasks(from_week, toWeek, task_ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", toWeek] });
      queryClient.invalidateQueries({ queryKey: ["weekTaskChildren", toWeek] });
      queryClient.invalidateQueries({ queryKey: ["recentWeeks"] });
    },
  });
}
