import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface AiHtmlGeneratorProps {
  onPublish: (html: string) => void;
  onClose: () => void;
}

interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  detail?: string;
}

const MAX_FILE_MB = 20;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Compress an image file to base64. Max 1200px on the longest side.
// PNG preserves transparency; everything else becomes JPEG.
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas не поддерживается"));
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const dataUrl = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.78);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function approxBytesOfBase64(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function buildPreviewDoc(code: string): string {
  let body = code;
  try {
    const doc = new DOMParser().parseFromString(code, "text/html");
    doc.querySelectorAll("[data-placeholder]").forEach((el, i) => {
      el.setAttribute("data-ph-idx", String(i));
    });
    body = doc.body.innerHTML;
  } catch {
    body = code;
  }
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 24px; max-width: 880px; margin: 0 auto; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #d4d4d8; padding: 6px 10px; text-align: left; }
  blockquote { border-left: 4px solid #f59e0b; background: #fffbeb; margin: 12px 0; padding: 8px 16px; border-radius: 4px; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.3rem; margin-top: 1.4em; } h3 { font-size: 1.1rem; }
  .screenshot-placeholder, [data-placeholder] {
    display: block; border: 2px dashed #f59e0b; background: #fffbeb; color: #92400e;
    border-radius: 10px; padding: 18px; margin: 14px 0; text-align: center; cursor: pointer;
    font-size: 0.9rem; transition: background .15s;
  }
  [data-placeholder]:hover { background: #fef3c7; }
  [data-placeholder]::before { content: "🖼 "; }
</style></head><body>${body}
<script>
  document.querySelectorAll('[data-placeholder]').forEach(function(el){
    el.addEventListener('click', function(){
      var idx = el.getAttribute('data-ph-idx');
      parent.postMessage({ type: 'kb-placeholder-click', idx: Number(idx) }, '*');
    });
  });
</script>
</body></html>`;
}

export function AiHtmlGenerator({ onPublish, onClose }: AiHtmlGeneratorProps) {
  const { toast } = useToast();

  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [code, setCode] = useState("");
  const [previewDoc, setPreviewDoc] = useState("");
  const [checks, setChecks] = useState<CheckItem[] | null>(null);

  // Follow-up refinement
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  // Stack of earlier drafts so the author can roll back an unwanted refinement
  const [history, setHistory] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  // Index of the placeholder being replaced via preview click; null => insert at cursor
  const pendingPlaceholderIdx = useRef<number | null>(null);

  const hasSource = Boolean(sourceText.trim()) || Boolean(file);

  // Debounced preview
  useEffect(() => {
    if (!code) {
      setPreviewDoc("");
      return;
    }
    const t = setTimeout(() => setPreviewDoc(buildPreviewDoc(code)), 300);
    return () => clearTimeout(t);
  }, [code]);

  // Listen for placeholder clicks coming from the iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data && e.data.type === "kb-placeholder-click") {
        pendingPlaceholderIdx.current = Number(e.data.idx);
        imageInputRef.current?.click();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleFilePick = (f: File | undefined | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      toast({ title: "Неподдерживаемый формат", description: "Загрузите PDF или DOCX", variant: "destructive" });
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: `Максимум ${MAX_FILE_MB} МБ`, variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const generate = useCallback(async () => {
    if (!hasSource) return;
    if (code.trim()) {
      const proceed = window.confirm(
        "Текущий HTML-код будет перезаписан. Рекомендуем сначала скачать резервную копию (кнопка «Скачать копию»). Продолжить генерацию?"
      );
      if (!proceed) return;
    }
    setGenerating(true);
    setChecks(null);
    try {
      let payload: { text?: string; fileBase64?: string; fileType?: "pdf" | "docx" };
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "docx";
        const b64 = await fileToBase64(file);
        payload = { fileBase64: b64, fileType: ext };
      } else {
        payload = { text: sourceText };
      }
      const res = await api.generateHtml(payload);
      setCode(res.html);
      if (res.warning) {
        toast({ title: "Готово, но обратите внимание", description: res.warning });
      } else {
        toast({ title: "Готово", description: "HTML сгенерирован. Проверьте результат справа." });
      }
    } catch (e: any) {
      toast({ title: "Ошибка генерации", description: e?.message || "Не удалось сгенерировать HTML", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [hasSource, code, file, sourceText, toast]);

  const refine = useCallback(async () => {
    if (!code.trim() || !instruction.trim() || refining || generating) return;
    const prevCode = code;
    const prevInstruction = instruction;
    setRefining(true);
    setChecks(null);
    try {
      const res = await api.generateHtml({ currentHtml: prevCode, instruction: prevInstruction });
      setHistory((h) => [...h, prevCode]);
      setCode(res.html);
      setInstruction("");
      if (res.warning) {
        toast({ title: "Готово, но обратите внимание", description: res.warning });
      } else {
        toast({ title: "Черновик обновлён", description: "Если результат не понравился — нажмите «Вернуть предыдущую версию»." });
      }
    } catch (e: any) {
      toast({ title: "Ошибка доработки", description: e?.message || "Не удалось доработать черновик", variant: "destructive" });
    } finally {
      setRefining(false);
    }
  }, [code, instruction, refining, generating, toast]);

  const recoverPrevious = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setCode(prev);
      setChecks(null);
      toast({ title: "Версия восстановлена", description: "Возвращён предыдущий вариант черновика." });
      return h.slice(0, -1);
    });
  }, [toast]);

  const insertImageAtCursor = (imgHtml: string) => {
    const ta = codeRef.current;
    if (!ta) {
      setCode((c) => c + imgHtml);
      return;
    }
    const start = ta.selectionStart ?? code.length;
    const end = ta.selectionEnd ?? code.length;
    const next = code.slice(0, start) + imgHtml + code.slice(end);
    setCode(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + imgHtml.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const replacePlaceholder = (idx: number, imgHtml: string) => {
    try {
      const doc = new DOMParser().parseFromString(code, "text/html");
      const phs = doc.querySelectorAll("[data-placeholder]");
      const target = phs[idx];
      if (!target) return;
      const tmp = doc.createElement("div");
      tmp.innerHTML = imgHtml;
      target.replaceWith(...Array.from(tmp.childNodes));
      setCode(doc.body.innerHTML);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось заменить плейсхолдер", variant: "destructive" });
    }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    const targetIdx = pendingPlaceholderIdx.current;
    pendingPlaceholderIdx.current = null;
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Это не изображение", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await compressImage(f);
      const bytes = approxBytesOfBase64(dataUrl);
      if (bytes > 400 * 1024) {
        toast({
          title: "Крупное изображение",
          description: `После сжатия ~${Math.round(bytes / 1024)} КБ. Это увеличит размер страницы.`,
        });
      }
      const imgHtml = `<img src="${dataUrl}" alt="" />`;
      if (targetIdx !== null && !Number.isNaN(targetIdx)) {
        replacePlaceholder(targetIdx, imgHtml);
      } else {
        insertImageAtCursor(imgHtml);
      }
    } catch {
      toast({ title: "Ошибка обработки изображения", variant: "destructive" });
    }
  };

  const runChecks = useCallback((): CheckItem[] => {
    const doc = new DOMParser().parseFromString(code, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img"));
    const imgsWithoutAlt = imgs.filter((im) => !(im.getAttribute("alt") || "").trim());
    const placeholders = doc.querySelectorAll("[data-placeholder]");
    const headings = Array.from(doc.querySelectorAll("h1, h2, h3")).map((h) =>
      (h.textContent || "").toLowerCase()
    );
    const hasStepSection = headings.some((h) => h.includes("пошаговая инструкция"));
    const unrecognizedSteps = doc.querySelectorAll('[data-unrecognized-step="true"], [data-unrecognized-step=""], [data-unrecognized-step]');
    const sectionOk = hasStepSection && unrecognizedSteps.length === 0;
    const sizeBytes = new Blob([code]).size;

    const result: CheckItem[] = [
      {
        id: "alt",
        label: "У всех изображений заполнен alt-текст",
        ok: imgsWithoutAlt.length === 0,
        required: true,
        detail:
          imgsWithoutAlt.length > 0
            ? `Без alt: ${imgsWithoutAlt.length} из ${imgs.length}`
            : imgs.length === 0
            ? "Изображений нет"
            : undefined,
      },
      {
        id: "placeholders",
        label: "Нет нерешённых плейсхолдеров скриншотов",
        ok: placeholders.length === 0,
        required: true,
        detail: placeholders.length > 0 ? `Осталось: ${placeholders.length}` : undefined,
      },
      {
        id: "section",
        label: "Есть раздел «Пошаговая инструкция» без нераспознанных шагов",
        ok: sectionOk,
        required: true,
        detail: !hasStepSection
          ? "Добавьте заголовок «Пошаговая инструкция»"
          : unrecognizedSteps.length > 0
          ? `Нераспознанных шагов: ${unrecognizedSteps.length} — исправьте их вручную`
          : undefined,
      },
      {
        id: "size",
        label: "Размер страницы не превышает 5 МБ",
        ok: sizeBytes <= 5 * 1024 * 1024,
        required: false,
        detail: `Текущий размер: ${(sizeBytes / 1024 / 1024).toFixed(2)} МБ`,
      },
    ];
    return result;
  }, [code]);

  const handleCheck = () => {
    const result = runChecks();
    setChecks(result);
    const failedRequired = result.filter((c) => c.required && !c.ok);
    if (failedRequired.length === 0) {
      toast({ title: "Проверка пройдена", description: "Можно экспортировать или опубликовать." });
    } else {
      toast({
        title: "Есть замечания",
        description: `Не выполнено обязательных пунктов: ${failedRequired.length}`,
        variant: "destructive",
      });
    }
  };

  const requiredBlocking = useMemo(() => {
    if (!checks) return false;
    return checks.some((c) => c.required && !c.ok);
  }, [checks]);

  const downloadHtml = (filename: string) => {
    const blob = new Blob([code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const result = runChecks();
    setChecks(result);
    const failedRequired = result.filter((c) => c.required && !c.ok);
    if (failedRequired.length > 0) {
      toast({
        title: "Экспорт заблокирован",
        description: "Сначала выполните обязательные пункты чек-листа.",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard?.writeText(code).catch(() => {});
    downloadHtml("instruction.html");
    toast({ title: "Экспортировано", description: "HTML скопирован в буфер и скачан файлом." });
  };

  const handlePublish = () => {
    if (!code.trim()) {
      toast({ title: "Нечего публиковать", description: "Сначала сгенерируйте HTML.", variant: "destructive" });
      return;
    }
    const result = runChecks();
    setChecks(result);
    const failedRequired = result.filter((c) => c.required && !c.ok);
    if (failedRequired.length > 0) {
      toast({
        title: "Публикация заблокирована",
        description: "Сначала выполните обязательные пункты чек-листа.",
        variant: "destructive",
      });
      return;
    }
    onPublish(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="ai-html-generator">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <div className="text-sm font-semibold">AI-генератор HTML из инструкции</div>
        </div>
        <Button
          data-testid="button-close-ai-generator"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!code ? (
        /* Source step */
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold">Загрузите инструкцию (PDF или DOCX)</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
              />
              <div
                data-testid="dropzone-ai-source"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFilePick(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <FileText className="h-7 w-7 text-muted-foreground" />
                {file ? (
                  <div className="text-sm font-medium" data-testid="text-selected-file">{file.name}</div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">Перетащите файл сюда или нажмите для выбора</div>
                    <div className="text-xs text-muted-foreground">PDF или DOCX, до {MAX_FILE_MB} МБ</div>
                  </>
                )}
              </div>
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  data-testid="button-clear-file"
                  onClick={() => setFile(null)}
                >
                  <X className="mr-1 h-3 w-3" /> Убрать файл
                </Button>
              )}
            </Card>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">или вставьте текст</span>
              <Separator className="flex-1" />
            </div>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-semibold">Текст инструкции</div>
              </div>
              <Textarea
                data-testid="textarea-ai-source-text"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Вставьте сюда текст инструкции…"
                className="min-h-[180px] rounded-xl text-sm"
              />
            </Card>

            <Button
              data-testid="button-generate-html"
              className="w-full rounded-xl"
              disabled={!hasSource || generating}
              onClick={generate}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Генерация…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Сгенерировать
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Editor step */
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            <Button
              data-testid="button-insert-image"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => {
                pendingPlaceholderIdx.current = null;
                imageInputRef.current?.click();
              }}
            >
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Вставить картинку
            </Button>
            <Button
              data-testid="button-run-checklist"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={handleCheck}
            >
              <ListChecks className="mr-1.5 h-3.5 w-3.5" /> Проверить
            </Button>
            <Button
              data-testid="button-download-backup"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => downloadHtml("instruction-backup.html")}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Скачать копию
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {history.length > 0 && (
                <Button
                  data-testid="button-recover-previous"
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs"
                  disabled={refining}
                  onClick={recoverPrevious}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Вернуть предыдущую версию
                </Button>
              )}
              <Button
                data-testid="button-regenerate"
                variant="ghost"
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => {
                  const proceed = window.confirm(
                    "Текущий HTML-код будет удалён, и вы вернётесь к шагу загрузки. Рекомендуем сначала скачать резервную копию (кнопка «Скачать копию»). Продолжить?"
                  );
                  if (!proceed) return;
                  setCode("");
                  setChecks(null);
                  setHistory([]);
                  setInstruction("");
                }}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Заново
              </Button>
              <Button
                data-testid="button-export-html"
                variant="outline"
                size="sm"
                className="rounded-lg text-xs"
                onClick={handleExport}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Экспортировать
              </Button>
              <Button
                data-testid="button-publish-html"
                size="sm"
                className="rounded-lg text-xs"
                onClick={handlePublish}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Опубликовать
              </Button>
            </div>
          </div>

          {/* Refine bar */}
          <div className="flex items-start gap-2 border-b bg-amber-50/50 px-4 py-2 dark:bg-amber-950/10">
            <Wand2 className="mt-2 h-4 w-4 shrink-0 text-amber-500" />
            <Textarea
              data-testid="textarea-refine-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  refine();
                }
              }}
              placeholder="Доработать черновик: например «сделай короче», «добавь раздел с предупреждениями», «раздели шаг 3 на два»…"
              className="min-h-[38px] flex-1 resize-none rounded-lg text-sm"
              disabled={refining}
            />
            <Button
              data-testid="button-refine-html"
              size="sm"
              className="mt-0.5 shrink-0 rounded-lg text-xs"
              disabled={!instruction.trim() || refining || generating}
              onClick={refine}
            >
              {refining ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Дорабатываю…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Доработать
                </>
              )}
            </Button>
          </div>

          {/* Split view */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex w-1/2 flex-col border-r">
              <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                HTML-код
              </div>
              <Textarea
                ref={codeRef}
                data-testid="textarea-html-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="flex-1 resize-none rounded-none border-0 font-mono text-xs focus-visible:ring-0"
              />
            </div>
            <div className="flex w-1/2 flex-col">
              <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Предпросмотр (кликните по плейсхолдеру, чтобы вставить скриншот)
              </div>
              <iframe
                data-testid="iframe-html-preview"
                title="Предпросмотр HTML"
                sandbox="allow-scripts"
                srcDoc={previewDoc}
                className="flex-1 border-0 bg-white"
              />
            </div>
          </div>

          {/* Checklist panel */}
          {checks && (
            <div className="border-t bg-muted/20 px-4 py-3" data-testid="panel-checklist">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <ListChecks className="h-3.5 w-3.5" /> Чек-лист готовности
                {requiredBlocking && (
                  <Badge variant="destructive" className="text-[10px]">Экспорт заблокирован</Badge>
                )}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 text-xs"
                    data-testid={`check-item-${c.id}`}
                  >
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : c.required ? (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    <div>
                      <span className={c.ok ? "" : c.required ? "text-red-700" : "text-amber-700"}>
                        {c.label}
                        {!c.required && <span className="text-muted-foreground"> (рекомендация)</span>}
                      </span>
                      {c.detail && <span className="block text-muted-foreground">{c.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
    </div>
  );
}
