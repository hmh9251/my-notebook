import { invoke } from "@tauri-apps/api/core";

/** 代理下载图片 → data URI（Jira 附件等需登录的图） */
export async function proxyImage(url: string): Promise<string> {
  return invoke("proxy_image", { url });
}

/** 是否需要走代理（fastfish 内网需凭据） */
export function needsProxy(url: string): boolean {
  return /fastfish\.com/i.test(url);
}

/** URL 是否为可软件内预览的文件链接 */
export function isPreviewableFile(url: string): boolean {
  const u = url.toLowerCase().split(/[?#]/)[0];
  // SVN 主机一律进软件内预览（不再跳默认浏览器）；其余按文件扩展名判定
  return (
    /svn\.fastfish\.com/i.test(u) ||
    /\.(xlsx|xls|docx|doc|pdf|png|jpe?g|gif|webp|bmp)(\/|$)/i.test(u)
  );
}

/** 取 URL 末段扩展名（小写，无点） */
export function fileExt(url: string): string {
  const path = url.split(/[?#]/)[0];
  const last = path.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  if (dot < 0) return "";
  return last.slice(dot + 1).toLowerCase();
}

/** base64 → Uint8Array */
export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
