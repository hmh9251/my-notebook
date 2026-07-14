import { invoke } from "@tauri-apps/api/core";
import type { CachedFile, CachedFileWithBytes } from "@/types/files";

/** 缓存文件并返回 base64（命中读盘、未命中下载） */
export async function cacheFile(url: string): Promise<CachedFileWithBytes> {
  return invoke("cache_file", { url });
}

export async function listCachedFiles(): Promise<CachedFile[]> {
  return invoke("list_cached_files");
}

export async function deleteCachedFile(url: string): Promise<void> {
  return invoke("delete_cached_file", { url });
}

/** 清空全部预览缓存 */
export async function clearFileCache(): Promise<number> {
  return invoke("clear_file_cache");
}
