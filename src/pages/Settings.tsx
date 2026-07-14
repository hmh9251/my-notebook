import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { confirm } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Folder, Check, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme, useSetting } from "@/hooks/useSettings";
import { useStoragePath, useChangeStoragePath } from "@/hooks/useStorage";
import { pickDirectory, openInExplorer } from "@/api/storage";
import { setSetting as setSettingApi } from "@/api/settings";
import { clearFileCache } from "@/api/files";
import { deleteOldTasks } from "@/api/week_tasks";
import { PALETTES } from "@/lib/theme/palettes";
import { cn } from "@/lib/utils";

export function Settings() {
  const { current, change } = useTheme();
  const { data: storagePath, isLoading: storageLoading } = useStoragePath();
  const changeStorage = useChangeStoragePath();
  const [migrating, setMigrating] = useState(false);

  const handlePickDir = async () => {
    try {
      const dir = await pickDirectory();
      if (!dir) return;
      if (
        !(await confirm(
          `确认将数据库迁移到：\n${dir}\n\n迁移将复制当前数据库到新位置并重启应用。`,
        ))
      ) {
        return;
      }
      setMigrating(true);
      await changeStorage.mutateAsync(dir);
      // 成功则进程会重启，下面不会执行
    } catch (e) {
      toast.error(`迁移失败：${e}`);
      setMigrating(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <h1 className="mb-6 text-xl font-semibold text-foreground">设置</h1>

        {/* 主题 */}
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-medium text-foreground">主题</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            切换即生效，纯 CSS 变量替换。
          </p>
          <div className="grid grid-cols-5 gap-2">
            {PALETTES.map((p) => {
              const selected = current === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => change(p.id)}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all",
                    selected
                      ? "border-accent ring-1 ring-accent"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <span
                    className="flex h-10 w-full items-center justify-center rounded"
                    style={{ background: p.background }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p.accent }}
                    />
                    {selected && (
                      <Check
                        className="ml-1 h-3.5 w-3.5"
                        style={{ color: p.accent }}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px]",
                      selected ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 存储 */}
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-medium text-foreground">存储</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            数据库位置可配置。迁移会复制数据库并重启。
          </p>
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Folder className="h-3.5 w-3.5" />
              <span>当前目录</span>
            </div>
            <div className="mb-3 break-all rounded bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-foreground">
              {storageLoading ? "加载中…" : storagePath ?? "—"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => storagePath && openInExplorer(storagePath)}
                disabled={!storagePath}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4" />
                打开
              </button>
              <button
                onClick={handlePickDir}
                disabled={migrating}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                更改…
              </button>
            </div>
          </div>
        </section>

        {/* 数据清理 */}
        <CleanupSection />

        {/* 凭据（图片/文件代理下载用）*/}
        <CredentialsSection />

        {/* 关于 */}
        <section>
          <h2 className="mb-1 text-sm font-medium text-foreground">关于</h2>
          <p className="text-xs text-muted-foreground">
            记录 — 本地笔记工具 · 数据完全离线存储于本机。
          </p>
        </section>
      </div>
    </div>
  );
}

const CRED_FIELDS = [
  { group: "jira", key: "jira_token", label: "Jira 访问令牌", type: "password", placeholder: "Personal Access Token（SSO 走令牌）" },
  { group: "svn", key: "svn_user", label: "SVN 用户名", type: "text", placeholder: "SVN 账号" },
  { group: "svn", key: "svn_pass", label: "SVN 密码", type: "password", placeholder: "SVN 密码" },
] as const;

function CredentialsSection() {
  const jiraToken = useSetting("jira_token");
  const svnUser = useSetting("svn_user");
  const svnPass = useSetting("svn_pass");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const inited = useRef(false);
  const loaded = jiraToken.isSuccess && svnUser.isSuccess && svnPass.isSuccess;

  // 初始值到位后灌进本地表单（仅一次）
  useEffect(() => {
    if (!loaded || inited.current) return;
    inited.current = true;
    setVals({
      jira_token: jiraToken.data ?? "",
      svn_user: svnUser.data ?? "",
      svn_pass: svnPass.data ?? "",
    });
  }, [loaded, jiraToken.data, svnUser.data, svnPass.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(CRED_FIELDS.map((f) => setSettingApi(f.key, vals[f.key] ?? "")));
      toast.success("凭据已保存");
    } catch (e) {
      toast.error(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-foreground">凭据 · 图片/文件代理</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        正文里 Jira 附件图片（code.fastfish.com）、SVN 上的 Word/Excel（svn.fastfish.com）需登录才能下。
        Jira 用 SSO，填访问令牌（Bearer）；SVN 填账号密码（Basic）。
        下载走 Rust 后端、忽略自签证书（Firefox 同款宽容），不经 webview。
      </p>
      <div className="space-y-4 rounded-md border border-border p-3">
        {/* Jira */}
        <div>
          <div className="mb-2 text-xs font-medium text-foreground">Jira（code.fastfish.com）</div>
          {CRED_FIELDS.filter((f) => f.group === "jira").map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
              <input
                type={f.type}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
          ))}
        </div>
        {/* SVN */}
        <div>
          <div className="mb-2 text-xs font-medium text-foreground">SVN（svn.fastfish.com）</div>
          <div className="grid grid-cols-2 gap-3">
            {CRED_FIELDS.filter((f) => f.group === "svn").map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                <input
                  type={f.type}
                  value={vals[f.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CleanupSection() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleClearCache = async () => {
    const ok = await confirm("清空全部预览缓存（下载过的 Word/Excel 文件）？任务不会被删。");
    if (!ok) return;
    setBusy(true);
    try {
      const n = await clearFileCache();
      queryClient.invalidateQueries({ queryKey: ["cachedFiles"] });
      toast.success(`已清空 ${n} 个缓存文件`);
    } catch (e) {
      toast.error(`清空失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleClearOldTasks = async () => {
    const ok = await confirm("删除 3 个月以前创建的任务？此操作不可恢复。");
    if (!ok) return;
    setBusy(true);
    try {
      const n = await deleteOldTasks(3);
      queryClient.invalidateQueries();
      toast.success(`已删除 ${n} 条旧任务`);
    } catch (e) {
      toast.error(`删除失败：${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-foreground">数据清理</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        缓存会随使用增长，定期清理。删任务不可恢复，谨慎。
      </p>
      <div className="flex flex-wrap gap-2 rounded-md border border-border p-3">
        <button
          onClick={handleClearCache}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          清空预览缓存
        </button>
        <button
          onClick={handleClearOldTasks}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          清空 3 个月前任务
        </button>
      </div>
    </section>
  );
}
