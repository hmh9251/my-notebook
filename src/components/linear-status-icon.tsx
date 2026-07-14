import type { TaskStatus } from "@/types/week_task";

interface LinearStatusIconProps {
  status: TaskStatus;
  /** 16 进制颜色，默认取 CSS 变量计算值 */
  className?: string;
}

/**
 * Linear 风格自绘状态图标（SVG）：
 * - dev      圆环 + 左半圆填充
 * - testing  圆环 + 中心实心点
 * - released 实心圆 + 白色对勾
 *
 * 颜色由 status 决定，通过 currentColor + className 注入。
 */
export function LinearStatusIcon({ status, className }: LinearStatusIconProps) {
  const colorClass =
    status === "dev"
      ? "text-status-dev"
      : status === "testing"
        ? "text-status-testing"
        : "text-status-released";

  return (
    <span className={`${colorClass} ${className ?? ""}`} style={{ display: "inline-flex" }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {status === "dev" && (
          <>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M7 1.6 A5.4 5.4 0 0 0 7 12.4 Z" fill="currentColor" />
          </>
        )}
        {status === "testing" && (
          <>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <circle cx="7" cy="7" r="2.4" fill="currentColor" />
          </>
        )}
        {status === "released" && (
          <>
            <circle cx="7" cy="7" r="6" fill="currentColor" />
            <path
              d="M4.2 7.2 L6.1 9.1 L9.9 5.0"
              stroke="hsl(var(--background))"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
      </svg>
    </span>
  );
}
