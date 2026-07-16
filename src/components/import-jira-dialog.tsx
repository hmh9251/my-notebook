import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { fetchJiraIssue } from "@/api/jira";
import { useUpsertTask } from "@/hooks/useWeekTasks";
import { formatWeekRange } from "@/lib/utils/week-key";
import { buildContent } from "@/lib/jira-import";
import type { NewTask } from "@/types/week_task";

interface ImportJiraDialogProps {
  open: boolean;
  onClose: () => void;
  weekKey: string;
}

/** 输入 Jira 任务号 → 拉取 → 转 markdown → upsert 到当前周 */
export function ImportJiraDialog({ open, onClose, weekKey }: ImportJiraDialogProps) {
  const [taskNo, setTaskNo] = useState("");
  const [busy, setBusy] = useState(false);
  const upsert = useUpsertTask(weekKey);

  const handleImport = async () => {
    const no = taskNo.trim();
    if (!no) return;
    setBusy(true);
    try {
      const issue = await fetchJiraIssue(no);
      if (!issue.key) throw new Error("Jira 没返回该任务，检查任务号/令牌");
      const task: NewTask = {
        name: issue.summary || no,
        link_url: `https://code.fastfish.com/browse/${issue.key}`,
        task_no: issue.key,
        branch: issue.branch,
        status: "dev",
        type: "main",
        parent_id: null,
        content: buildContent(issue),
        week_key: weekKey,
        sort_order: 0,
      };
      await upsert.mutateAsync(task);
      setTaskNo("");
      onClose();
    } catch (e) {
      toast.error(`导入失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="从 Jira 导入任务"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={busy || !taskNo.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "导入中…" : "导入到本周"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Jira 任务号
          </label>
          <input
            value={taskNo}
            autoFocus
            onChange={(e) => setTaskNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleImport();
            }}
            placeholder="如 XXZX-26586"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          拉取后自动转成 markdown（描述/表格/附件图）导入到当前周{" "}
          <span className="font-mono">{weekKey}</span>（{formatWeekRange(weekKey)}），
          统一建为本周主任务、状态开发中。重复导入同任务号会刷新不重复。
        </p>
      </div>
    </Modal>
  );
}
