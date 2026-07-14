import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { renderAsync } from "docx-preview";
import { Minus, Plus } from "lucide-react";
import { useCacheFile } from "@/hooks/useFiles";
import { b64ToBytes } from "@/api/proxy";
import { renderXlsx } from "@/lib/excel-render";

type State =
  | { kind: "loading" }
  | { kind: "error"; msg: string }
  | { kind: "xlsx"; sheets: { name: string; html: string }[] }
  | { kind: "docx"; b64: string }
  | { kind: "image"; dataUri: string }
  | { kind: "pdf"; dataUri: string }
  | { kind: "unsupported"; ext: string };

interface Heading {
  text: string;
  level: number;
}

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};

function styleLevel(val: string): number | null {
  let m = /^heading(\d)$/i.exec(val) || /^标题(\d)$/.exec(val);
  if (m) return Number(m[1]);
  if (/^title$/i.test(val)) return 1;
  if (/^subtitle$/i.test(val)) return 2;
  if (/^heading/i.test(val)) return 1;
  const cm = /^([一二三四五六])级?标题$/.exec(val);
  if (cm) return CN_NUM[cm[1]];
  return null;
}

function parseStyleOutline(stylesXml: string): Record<string, number> {
  const map: Record<string, number> = {};
  try {
    const dom = new DOMParser().parseFromString(stylesXml, "text/xml");
    for (const s of Array.from(dom.getElementsByTagName("w:style"))) {
      const sid = s.getAttribute("w:styleId") ?? "";
      const ol = s.getElementsByTagName("w:outlineLvl")[0];
      const v = ol?.getAttribute("w:val");
      if (sid && v != null) {
        const lv = Number(v) + 1;
        if (lv >= 1 && lv <= 9) map[sid] = lv;
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

function parseHeadings(docXml: string, styleOutline: Record<string, number>): Heading[] {
  try {
    const dom = new DOMParser().parseFromString(docXml, "text/xml");
    const paras = Array.from(dom.getElementsByTagName("w:p"));
    const out: Heading[] = [];
    for (const p of paras) {
      let level: number | null = null;
      const ol = p.getElementsByTagName("w:outlineLvl")[0];
      if (ol) {
        const v = ol.getAttribute("w:val");
        if (v != null) level = Number(v) + 1;
      }
      if (level == null) {
        const ps = p.getElementsByTagName("w:pStyle")[0];
        const v = ps?.getAttribute("w:val") ?? "";
        if (v) level = styleOutline[v] ?? styleLevel(v);
      }
      if (level == null || level < 1 || level > 9) continue;
      const text = Array.from(p.getElementsByTagName("w:t"))
        .map((t) => t.textContent ?? "")
        .join("")
        .trim();
      if (text) out.push({ text, level });
    }
    return out;
  } catch {
    return [];
  }
}

// 按 url 记忆滚动位置 + 工作表
const mem = new Map<string, { top: number; sheet: number; zoom: number }>();

interface FilePreviewPanelProps {
  url: string;
  name: string;
  ext: string;
}

/** 可复用预览面板：fetch + 渲染 docx/xlsx/图/pdf + 目录 + 缩放 + 滚动记忆。填满父容器。 */
export function FilePreviewPanel({ url, name, ext }: FilePreviewPanelProps) {
  const cacheFile = useCacheFile();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [activeSheet, setActiveSheet] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [docxErr, setDocxErr] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const xlsxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const m = mem.get(url);
    setActiveSheet(m?.sheet ?? 0);
    setZoom(m?.zoom ?? 1);
    setState({ kind: "loading" });
    setHeadings([]);
    setDocxErr(null);
    (async () => {
      try {
        const cached = await cacheFile.mutateAsync(url);
        if (!alive) return;
        const bytes = b64ToBytes(cached.b64);
        switch (ext) {
          case "xlsx":
          case "xls": {
            const sheets = await renderXlsx(bytes);
            setState({ kind: "xlsx", sheets });
            break;
          }
          case "docx": {
            try {
              const zip = await JSZip.loadAsync(bytes);
              const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
              const stylesXml = (await zip.file("word/styles.xml")?.async("string")) ?? "";
              setHeadings(parseHeadings(docXml, parseStyleOutline(stylesXml)));
            } catch {
              /* 无目录则侧栏空 */
            }
            setState({ kind: "docx", b64: cached.b64 });
            break;
          }
          case "png":
          case "jpg":
          case "jpeg":
          case "gif":
          case "webp":
          case "bmp": {
            const mime =
              ext === "png" ? "image/png"
                : ext === "gif" ? "image/gif"
                : ext === "webp" ? "image/webp"
                : "image/jpeg";
            setState({ kind: "image", dataUri: `data:${mime};base64,${cached.b64}` });
            break;
          }
          case "pdf": {
            setState({ kind: "pdf", dataUri: `data:application/pdf;base64,${cached.b64}` });
            break;
          }
          default:
            setState({ kind: "unsupported", ext });
        }
      } catch (e) {
        if (alive) {
          setState({ kind: "error", msg: String(e) });
          toast.error(`预览失败：${e}`);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (state.kind !== "docx" || !docxRef.current) return;
    let alive = true;
    setDocxErr(null);
    const blob = new Blob([b64ToBytes(state.b64).buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    renderAsync(blob, docxRef.current, undefined, {
      className: "docx",
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      experimental: true,
      renderHeaders: true,
      renderFooters: true,
    })
      .then(() => {
        if (alive) restoreScroll();
      })
      .catch((e: unknown) => {
        if (alive) {
          setDocxErr(String(e));
          toast.error(`Word 渲染失败：${e}`);
        }
      });
    return () => {
      alive = false;
      if (docxRef.current) docxRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state.kind !== "xlsx" || !xlsxRef.current) return;
    xlsxRef.current.innerHTML = state.sheets[activeSheet]?.html ?? "";
    restoreScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, activeSheet]);

  useEffect(() => {
    if (url)
      mem.set(url, { ...(mem.get(url) ?? { top: 0, sheet: 0, zoom: 1 }), sheet: activeSheet });
  }, [activeSheet, url]);

  useEffect(() => {
    if (url)
      mem.set(url, { ...(mem.get(url) ?? { top: 0, sheet: 0, zoom: 1 }), zoom });
  }, [zoom, url]);

  const getScrollEl = (): HTMLDivElement | null =>
    state.kind === "xlsx" ? xlsxRef.current : contentRef.current;

  const restoreScroll = () => {
    const el = getScrollEl();
    if (!el) return;
    const top = mem.get(url)?.top ?? 0;
    requestAnimationFrame(() => {
      el.scrollTop = top;
    });
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!url) return;
    const top = e.currentTarget.scrollTop;
    mem.set(url, { ...(mem.get(url) ?? { top: 0, sheet: 0, zoom: 1 }), top });
  };

  const scrollToHeading = (text: string) => {
    const root = docxRef.current;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = (node.textContent ?? "").trim();
      if (t && (t === text || t.startsWith(text) || text.startsWith(t))) {
        node.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  };

  const showSidebar = state.kind === "docx" && headings.length > 0;

  return (
    <div className="flex min-h-0 flex-1">
      {showSidebar && (
        <nav className="w-56 shrink-0 overflow-auto border-r border-border bg-muted/30 p-2">
          <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            目录
          </div>
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => scrollToHeading(h.text)}
              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
              className="block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={contentRef} onScroll={onScroll} className="min-w-0 flex-1 overflow-auto">
          {state.kind === "loading" && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              正在下载并解析…
            </div>
          )}
          {state.kind === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-destructive">
              <span>{state.msg}</span>
              <span className="text-xs text-muted-foreground">去设置填令牌/账密。</span>
            </div>
          )}
          {state.kind === "unsupported" && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              暂不支持 .{state.ext} 软件内预览
            </div>
          )}
          {state.kind === "xlsx" && (
            <div className="flex h-full flex-col">
              {state.sheets.length > 1 && (
                <div className="flex shrink-0 flex-wrap gap-1 border-b border-border p-2">
                  {state.sheets.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSheet(i)}
                      className={
                        "rounded px-2 py-1 text-xs transition-colors " +
                        (i === activeSheet
                          ? "bg-accent/10 text-accent"
                          : "text-muted-foreground hover:bg-muted")
                      }
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={xlsxRef}
                onScroll={onScroll}
                className="flex-1 overflow-auto p-2 [&_.xlsx-tbl]:border-collapse [&_.xlsx-tbl_td]:border [&_.xlsx-tbl_td]:border-border [&_.xlsx-tbl_td]:px-1.5 [&_.xlsx-tbl_td]:py-0.5 [&_.xlsx-tbl_td]:text-xs [&_.xlsx-tbl_td]:overflow-hidden [&_.xlsx-tbl_td]:max-w-[240px] [&_.xlsx-tbl_td]:whitespace-nowrap"
              />
            </div>
          )}
          {state.kind === "docx" && (
            <div className="bg-muted/40 p-4" style={{ zoom }}>
              {docxErr ? (
                <div className="text-center text-sm text-destructive">
                  Word 渲染失败：{docxErr}
                </div>
              ) : (
                <div ref={docxRef} className="mx-auto bg-background shadow-lg" />
              )}
            </div>
          )}
          {state.kind === "image" && (
            <div className="flex h-full items-center justify-center">
              <img
                src={state.dataUri}
                alt={name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {state.kind === "pdf" && (
            <embed src={state.dataUri} type="application/pdf" className="h-full w-full" />
          )}
        </div>

        {state.kind === "docx" && !docxErr && (
          <div className="flex h-9 shrink-0 items-center justify-center gap-3 border-t border-border bg-background px-3">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="缩小"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="min-w-12 rounded px-2 py-0.5 text-xs tabular-nums text-foreground hover:bg-muted"
              title="重置 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="放大"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
