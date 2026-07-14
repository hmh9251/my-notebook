import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { WeekTasks } from "@/pages/WeekTasks";
import { TaskDetail } from "@/pages/TaskDetail";
import { Notes } from "@/pages/Notes";
import { Settings } from "@/pages/Settings";

// 预览页懒加载：xlsx-preview / docx-preview / jszip 体积大，独立分块
const FilePreview = lazy(() =>
  import("@/pages/FilePreview").then((m) => ({ default: m.FilePreview })),
);

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", element: <WeekTasks /> },
      { path: "/tasks/:id", element: <TaskDetail /> },
      { path: "/notes", element: <Notes /> },
      { path: "/settings", element: <Settings /> },
      {
        path: "/preview",
        element: (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                加载预览…
              </div>
            }
          >
            <FilePreview />
          </Suspense>
        ),
      },
    ],
  },
]);
