import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Bug, GitBranch, GripVertical, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TaskNoLink } from "@/components/task-no-link";
import { BranchChip } from "@/components/branch-chip";
import { StatusBadge } from "@/components/status-badge";
import { TYPE_LABEL } from "@/lib/utils/task-domain";
import type { TaskStatus, WeekTask } from "@/types/week_task";

const GRID = "grid items-center gap-2 overflow-hidden px-3 py-2";
const COLS = "28px 38px minmax(0,1fr) minmax(0,150px) minmax(0,170px) minmax(0,110px) 28px";

interface TaskTableViewProps {
  tasks: WeekTask[];
  childrenMap: Record<string, WeekTask[]>;
  onReorder: (orderedIds: number[]) => void;
  onStatusCycle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function TaskTableView({
  tasks,
  childrenMap,
  onReorder,
  onStatusCycle,
  onDelete,
}: TaskTableViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const topLevel = tasks.filter((t) => t.parent_id == null);
  const activeTask = topLevel.find((t) => t.id === activeId) ?? null;

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = topLevel.findIndex((t) => t.id === active.id);
    const newIndex = topLevel.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(topLevel, oldIndex, newIndex);
    onReorder(reordered.map((t) => t.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* 表头 */}
      <div
        className={cn(GRID, "border-b border-border text-xs font-medium text-muted-foreground")}
        style={{ gridTemplateColumns: COLS }}
      >
        <span />
        <span>序号</span>
        <span>任务名称</span>
        <span>任务号</span>
        <span>分支</span>
        <span>状态</span>
        <span />
      </div>

      <SortableContext
        items={topLevel.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {topLevel.map((task, idx) => (
            <TaskRowGroup
              key={task.id}
              task={task}
              index={idx + 1}
              children_={childrenMap[String(task.id)] ?? []}
              isExpanded={expanded.has(task.id)}
              onToggleExpand={() => toggleExpand(task.id)}
              onStatusCycle={onStatusCycle}
              onDelete={onDelete}
            />
          ))}
          {topLevel.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              本周暂无任务，点「新建任务」添加
            </div>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <div
            className={cn(GRID, "rounded-md border border-border bg-card shadow-lg")}
            style={{ gridTemplateColumns: COLS }}
          >
            <span />
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {activeTask.name}
            </span>
            <TaskNoLink taskNo={activeTask.task_no} />
            <BranchChip branch={activeTask.branch} />
            <StatusBadge status={activeTask.status as TaskStatus} />
            <span />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface TaskRowGroupProps {
  task: WeekTask;
  index: number;
  children_: WeekTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusCycle: (id: number) => void;
  onDelete: (id: number) => void;
}

function TaskRowGroup({
  task,
  index,
  children_,
  isExpanded,
  onToggleExpand,
  onStatusCycle,
  onDelete,
}: TaskRowGroupProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const hasChildren = children_.length > 0;

  return (
    <div ref={setNodeRef} style={style} className="group border-b border-border/60">
      {/* 主行 */}
      <div
        className={cn(GRID, "cursor-pointer transition-colors hover:bg-muted/40")}
        style={{ gridTemplateColumns: COLS }}
        onClick={() => navigate(`/tasks/${task.id}`)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-transform",
            !hasChildren && "invisible",
            isExpanded && "rotate-90",
          )}
          title={hasChildren ? (isExpanded ? "收起子项" : "展开子项") : undefined}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <div
          className="flex items-center gap-0.5 text-xs text-muted-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="拖拽排序"
        >
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing" />
          <span className="tabular-nums">{index}</span>
        </div>

        <span className="min-w-0 truncate text-sm font-medium text-foreground">{task.name}</span>
        <TaskNoLink taskNo={task.task_no} linkUrl={task.link_url} />
        <BranchChip branch={task.branch} />
        <StatusBadge
          status={task.status as TaskStatus}
          onCycle={() => onStatusCycle(task.id)}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 子行 */}
      {isExpanded &&
        children_.map((child, cidx) => (
          <div
            key={child.id}
            className={cn(GRID, "cursor-pointer bg-muted/20 transition-colors hover:bg-muted/50")}
            style={{ gridTemplateColumns: COLS }}
            onClick={() => navigate(`/tasks/${child.id}`)}
          >
            <span />
            <span className="pl-4 text-xs text-muted-foreground">
              {index}.{cidx + 1}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 truncate pl-4 text-sm text-foreground">
              {child.type === "bug" ? (
                <Bug className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{child.name}</span>
              <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                {TYPE_LABEL[child.type]}
              </span>
            </span>
            <TaskNoLink taskNo={child.task_no} linkUrl={child.link_url} />
            <BranchChip branch={child.branch} />
            <StatusBadge
              status={child.status as TaskStatus}
              onCycle={() => onStatusCycle(child.id)}
            />
            <span />
          </div>
        ))}
    </div>
  );
}
