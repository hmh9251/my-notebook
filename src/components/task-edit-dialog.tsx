import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { parseTaskNo } from "@/lib/utils/link-parser";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/utils/task-domain";
import type { NewTask, TaskStatus, TaskType, WeekTask } from "@/types/week_task";

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  /** 提交（create 或 update 由父组件决定） */
  onSubmit: (task: NewTask) => Promise<void> | void;
  /** 编辑模式传入已有任务；新建模式传 null */
  initial: WeekTask | null;
  weekKey: string;
  mode: "create" | "edit";
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";
const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";

export function TaskEditDialog({
  open,
  onClose,
  onSubmit,
  initial,
  weekKey,
  mode,
}: TaskEditDialogProps) {
  const [form, setForm] = useState<NewTask>(emptyTask(weekKey));
  const [branchTouched, setBranchTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 记录上次由链接解析出的任务号，用于判断分支是否还跟随任务号
  const lastParsedNo = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      const t: NewTask = {
        name: initial.name,
        link_url: initial.link_url,
        task_no: initial.task_no,
        branch: initial.branch,
        status: initial.status,
        type: initial.type,
        parent_id: initial.parent_id,
        content: initial.content,
        week_key: initial.week_key,
        sort_order: initial.sort_order,
      };
      setForm(t);
      lastParsedNo.current = initial.task_no;
      setBranchTouched(initial.branch !== "" && initial.branch !== initial.task_no);
    } else {
      setForm(emptyTask(weekKey));
      lastParsedNo.current = "";
      setBranchTouched(false);
    }
  }, [open, mode, initial, weekKey]);

  // 粘贴 URL → 解析任务号；分支未手动改过则跟随任务号
  const handleLinkChange = (link: string) => {
    const parsed = parseTaskNo(link);
    const taskNo = parsed || link; // 解析失败回退为完整 URL
    setForm((f) => {
      const next = { ...f, link_url: link, task_no: taskNo };
      if (!branchTouched) {
        next.branch = parsed; // 解析失败则分支留空
      }
      return next;
    });
    lastParsedNo.current = parsed;
  };

  const handleBranchChange = (branch: string) => {
    setBranchTouched(true);
    setForm((f) => ({ ...f, branch }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        link_url: form.link_url.trim(),
        task_no: form.task_no.trim(),
        branch: form.branch.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "新建任务" : "编辑任务"}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "保存中…" : mode === "create" ? "新建" : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={labelCls}>任务名称 *</label>
          <input
            className={inputCls}
            value={form.name}
            autoFocus={mode === "create"}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="输入任务名称"
          />
        </div>
        <div>
          <label className={labelCls}>任务链接</label>
          <input
            className={inputCls}
            value={form.link_url}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder="粘贴 URL，自动解析任务号"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>任务号</label>
            <input
              className={`${inputCls} font-mono`}
              value={form.task_no}
              onChange={(e) =>
                setForm((f) => ({ ...f, task_no: e.target.value }))
              }
              placeholder="自动解析，可改"
            />
          </div>
          <div>
            <label className={labelCls}>代码分支</label>
            <input
              className={`${inputCls} font-mono`}
              value={form.branch}
              onChange={(e) => handleBranchChange(e.target.value)}
              placeholder="默认 = 任务号"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>类型</label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TaskType }))}
            >
              {(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>状态</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))
              }
            >
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {mode === "edit" && (
          <p className="text-xs text-muted-foreground">
            正文（Markdown）由 AI 从 Jira 导入，详情页查看，不可在此编辑。
          </p>
        )}
      </div>
    </Modal>
  );
}

function emptyTask(weekKey: string): NewTask {
  return {
    name: "",
    link_url: "",
    task_no: "",
    branch: "",
    status: "dev",
    type: "main",
    parent_id: null,
    content: "",
    week_key: weekKey,
    sort_order: 0,
  };
}
