import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-shell";
import { proxyImage, needsProxy, isPreviewableFile, fileExt } from "@/api/proxy";
import { autolinkBareUrls } from "@/lib/autolink";
import { useUIStore } from "@/lib/stores/ui-store";

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** 点文件链接开预览：任务详情传（开 tab）；不传则回退到 /preview 路由（笔记用） */
  onPreviewLink?: (url: string, name: string, ext: string) => void;
}

/**
 * Markdown 渲染：
 * - 图片：fastfish 内网图走凭据代理 → data URI 内嵌
 * - 链接：文件链接（xlsx/docx/pdf/图/svn）→ 预览；其他 → 默认浏览器
 *   （永远不让 webview 跳转，避免挂死退不出来）
 */
export function MarkdownContent({ content, className, onPreviewLink }: MarkdownContentProps) {
  const navigate = useNavigate();
  const setActivePreview = useUIStore((s) => s.setActivePreview);
  // 裸 URL（含 SVN 文件地址）自动成链接 → 点击可预览；已有的 [text](url) 不动
  const linked = useMemo(() => autolinkBareUrls(content), [content]);

  const openPreview = (url: string) => {
    const nameRaw = url.split("/").pop() || url;
    let name = nameRaw;
    try {
      name = decodeURIComponent(nameRaw);
    } catch {
      /* 原样 */
    }
    const ext = fileExt(url);
    if (onPreviewLink) {
      onPreviewLink(url, name, ext);
    } else {
      setActivePreview({ url, name, ext });
      navigate("/preview");
    }
  };

  return (
    <div className={className ?? "markdown-body"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          img: ({ src, alt, title }) => (
            <ProxyImg src={src} alt={alt} title={title} />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                const h = String(href ?? "");
                if (!h) return;
                if (isPreviewableFile(h)) openPreview(h);
                else void open(h);
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {linked}
      </ReactMarkdown>
    </div>
  );
}

function ProxyImg({
  src,
  alt,
  title,
}: {
  src?: string;
  alt?: string;
  title?: string;
}) {
  const s = String(src ?? "");
  const [uri, setUri] = useState<string | undefined>(needsProxy(s) ? undefined : s);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setErr(false);
    if (!s) return;
    if (needsProxy(s)) {
      proxyImage(s)
        .then((d) => {
          if (alive) setUri(d);
        })
        .catch(() => {
          if (alive) setErr(true);
        });
    } else {
      setUri(s);
    }
    return () => {
      alive = false;
    };
  }, [s]);

  if (err) {
    return (
      <span className="mx-1 inline-block rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
        [图片加载失败，多半是凭据未填]
      </span>
    );
  }
  return <img src={uri} alt={alt} title={title} loading="lazy" />;
}
