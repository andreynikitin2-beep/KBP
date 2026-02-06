import { useEffect, useMemo, useState } from "react";
import { Link2, List, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(html: string): TocEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings: TocEntry[] = [];
  doc.querySelectorAll("h1, h2, h3").forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (!text) return;
    const level = parseInt(el.tagName[1], 10);
    const id = slugify(text);
    headings.push({ id, text, level });
  });
  return headings;
}

function addAnchorsToHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("h1, h2, h3").forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (!text) return;
    const id = slugify(text);
    el.setAttribute("id", id);
  });
  return doc.body.innerHTML;
}

interface PageViewerProps {
  html: string;
  materialId: string;
}

export function PageViewer({ html, materialId }: PageViewerProps) {
  const { toast } = useToast();
  const [tocOpen, setTocOpen] = useState(true);
  const headings = useMemo(() => extractHeadings(html), [html]);
  const processedHtml = useMemo(() => addAnchorsToHtml(html), [html]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
    }
  }, []);

  const copyLink = (headingId: string) => {
    const url = `${window.location.origin}/materials/${materialId}#${headingId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Ссылка скопирована", description: `#${headingId}` });
  };

  return (
    <div className="space-y-3" data-testid="page-viewer">
      {headings.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-3" data-testid="page-toc">
          <button
            type="button"
            data-testid="button-toggle-toc"
            className="flex w-full items-center gap-2 text-sm font-semibold text-foreground"
            onClick={() => setTocOpen(!tocOpen)}
          >
            <List className="h-4 w-4 text-muted-foreground" />
            Оглавление
            <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${tocOpen ? "rotate-90" : ""}`} />
          </button>
          {tocOpen && (
            <nav className="mt-2 space-y-0.5" aria-label="Оглавление">
              {headings.map((h, i) => (
                <div key={i} className="group flex items-center gap-1" style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                  <a
                    href={`#${h.id}`}
                    data-testid={`toc-link-${h.id}`}
                    className="flex-1 truncate rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(h.id);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        window.history.replaceState(null, "", `#${h.id}`);
                      }
                    }}
                  >
                    {h.text}
                  </a>
                  <button
                    type="button"
                    data-testid={`copy-link-${h.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                    title="Скопировать ссылку"
                    onClick={() => copyLink(h.id)}
                  >
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </nav>
          )}
        </div>
      )}

      <div
        className="tiptap-content prose prose-sm max-w-none rounded-xl border bg-background p-4"
        data-testid="page-content"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  );
}
