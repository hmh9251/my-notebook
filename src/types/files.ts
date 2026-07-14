export interface CachedFile {
  url: string;
  name: string;
  ext: string;
  size: number;
  created_at: string;
}

/** cache_file 返回：含 base64 字节 */
export interface CachedFileWithBytes {
  url: string;
  name: string;
  ext: string;
  b64: string;
}
