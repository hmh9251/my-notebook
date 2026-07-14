/** 修复被截断的链接：`[url](url)<尾巴>` → `[url+尾巴](url+尾巴)`
 *  仅当尾巴紧跟（无空白）且像 URL 路径（含 / 或以文件扩展名结尾）时合并，
 *  避免把 `[text](url)后续句子` 误并。 */
function repairTruncatedLinks(md: string): string {
  return md.replace(
    /(\[([^\]]*)\]\(([^)\s]+)\))([^\s<>\[\]()。，；：！？、．"']+)/g,
    (full, _g1, _text, url, tail: string | undefined) => {
      if (!tail) return full;
      if (
        !tail.includes("/") &&
        !/\.(xlsx|xls|docx|doc|pdf|png|jpe?g|gif|webp)$/i.test(tail)
      ) {
        return full;
      }
      const n = url + tail;
      return `[${n}](${n})`;
    },
  );
}

/** 把裸 URL 包成 [url](url) 链接（已在 markdown 链接 [text](url) 里的不动）。
 *  先修复旧导入里被截断的链接（尾巴合并回去），再 autolink 裸 URL。
 *  URL 遇句末标点（空白 <>[]() 。，；：！？、．）即截断，但保留 CJK 汉字与【】《》等文件名可用字符。 */
export function autolinkBareUrls(md: string): string {
  return repairTruncatedLinks(md).replace(
    /(\[[^\]]*\]\([^)\s]+\))|(https?:\/\/[^\s<>\[\]()。，；：！？、．"']+)/g,
    (_m, link: string | undefined, bare: string | undefined) => {
      if (link) return link;
      if (!bare) return _m;
      const url = bare.replace(/[.,;:!?)\]]+$/, "");
      return `[${url}](${url})`;
    },
  );
}
