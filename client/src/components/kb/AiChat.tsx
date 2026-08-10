import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ChevronLeft, Clock, Loader2, Plus, Send, Sparkles, Trash2, User as UserIcon, X, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { isOverdue } from "@/lib/kbLogic";
import { useKB } from "@/lib/kbStore";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ materialId: string; title: string; relatedLinks?: unknown }>;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    sources: Array<{ materialId: string; title: string; relatedLinks?: unknown }> | null;
    createdAt: string;
  }>;
};

type View = "chat" | "history";

function materialLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((link: any) => ({
      label: String(link?.label || link?.title || "Ссылка на инструкцию"),
      url: String(link?.url || ""),
    }))
    .filter((link) => /^https?:\/\//i.test(link.url));
}

function trimDanglingUserMessages(msgs: Message[]): Message[] {
  let end = msgs.length;
  while (end > 0 && msgs[end - 1].role === "user") end--;
  return msgs.slice(0, end);
}

export function AiChat() {
  const { me, visibleMaterials } = useKB();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = Number(localStorage.getItem("ai-chat-width"));
    return Number.isFinite(saved) && saved >= 360 && saved <= 960 ? saved : 560;
  });
  const [resizing, setResizing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef({ x: 0, width: 560 });

  useEffect(() => {
    api.getAiStatus().then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem("ai-chat-width", String(chatWidth));
  }, [chatWidth]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: PointerEvent) => {
      const next = Math.min(960, Math.max(360, resizeStartRef.current.width + resizeStartRef.current.x - event.clientX));
      setChatWidth(next);
    };
    const onUp = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getAiHistory();
      setSessions(data);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  };

  const onOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && messages.length === 0 && !sessionId) {
      setHistoryLoading(true);
      try {
        const data = await api.getAiHistory();
        setSessions(data);
        if (data.length > 0) {
          const latest = data[0];
          setSessionId(latest.id);
          const mapped: Message[] = latest.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            sources: m.sources ?? undefined,
          }));
          setMessages(trimDanglingUserMessages(mapped));
        }
      } catch {
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await api.aiChat({ message: msg, history, sessionId });
      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
      }
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Произошла ошибка при обращении к AI-помощнику. Попробуйте ещё раз или обратитесь к администратору.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setView("chat");
  };

  const openHistoryView = async () => {
    await loadHistory();
    setView("history");
  };

  const loadSession = (session: ChatSession) => {
    setSessionId(session.id);
    const mapped: Message[] = session.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      sources: m.sources ?? undefined,
    }));
    setMessages(trimDanglingUserMessages(mapped));
    setView("chat");
  };

  const deleteSession = async (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    try {
      await api.deleteAiSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      if (session.id === sessionId) {
        setMessages([]);
        setSessionId(undefined);
      }
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Сегодня";
    if (diffDays === 1) return "Вчера";
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  if (!enabled) return null;

  return (
    <>
      <Button
        data-testid="button-ai-chat"
        variant="default"
        size="sm"
        className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-white shadow-md shadow-orange-500/25 hover:from-amber-600 hover:to-orange-600"
        onClick={() => onOpen(true)}
        title="AI-помощник"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-semibold">AI-помощник</span>
      </Button>

      <Sheet open={open} onOpenChange={onOpen}>
        <SheetContent
          side="right"
          className="p-0 flex flex-col gap-0 [&>button:first-of-type]:hidden"
          style={{ width: `min(${chatWidth}px, 100vw)`, maxWidth: "100vw" }}
        >
          <div
            role="separator"
            tabIndex={0}
            aria-label="Изменить ширину чата"
            title="Потяните, чтобы изменить ширину чата"
            className="absolute left-0 top-0 z-50 flex h-full w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center group"
            onPointerDown={(event) => {
              event.preventDefault();
              resizeStartRef.current = { x: event.clientX, width: chatWidth };
              setResizing(true);
            }}
          >
            <span className="flex h-16 w-1 items-center justify-center rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            {view === "history" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setView("chat")}
                data-testid="button-ai-back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="font-semibold text-sm">
              {view === "history" ? "История чатов" : "AI-помощник"}
            </div>
            {view === "chat" && (
              <div className="text-xs text-muted-foreground">по базе знаний</div>
            )}
            <div className="ml-auto flex items-center gap-1">
              {view === "chat" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={openHistoryView}
                    title="История чатов"
                    data-testid="button-ai-history"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={startNewChat}
                    title="Новый чат"
                    data-testid="button-ai-new-chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setOpen(false)}
                data-testid="button-ai-close"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setChatWidth((width) => width >= 900 ? 560 : 960)}
                title={chatWidth >= 900 ? "Сузить чат" : "Расширить чат"}
                data-testid="button-ai-resize"
              >
                {chatWidth >= 900 ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {view === "history" ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {historyLoading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!historyLoading && sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="text-sm text-muted-foreground">История чатов пуста</div>
                  </div>
                )}
                {!historyLoading && sessions.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left rounded-xl border p-3 hover:bg-accent transition-colors group"
                    onClick={() => loadSession(s)}
                    data-testid={`ai-session-${s.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.messages.length} сообщ. · {formatDate(s.updatedAt)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => deleteSession(e, s)}
                        data-testid={`button-delete-session-${s.id}`}
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4 pb-2">
                  {historyLoading && (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {!historyLoading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                        <Sparkles className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="text-sm font-medium">Задайте вопрос</div>
                      <div className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                        Я отвечу на основе материалов базы знаний, доступных вам.
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => {
                    const outdatedSources = msg.role === "assistant" && msg.sources
                      ? msg.sources.filter((s) => {
                          const mat = visibleMaterials.find((m) => m.materialId === s.materialId);
                          if (!mat) return false;
                          return mat.status === "На пересмотре" || isOverdue(mat);
                        })
                      : [];
                    return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                          msg.role === "user" ? "bg-primary/10" : "bg-amber-100"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <UserIcon className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </div>
                      <div
                        className={`flex flex-col flex-1 max-w-[85%] ${
                          msg.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        {outdatedSources.length > 0 && (
                          <div className="mb-2 w-full rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 flex items-start gap-2" data-testid="ai-outdated-warning">
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <div className="text-sm font-bold text-destructive leading-snug">
                                Внимание: источник может быть устаревшим
                              </div>
                              <div className="text-xs text-destructive/80 mt-0.5">
                                {outdatedSources.map((s) => `«${s.title}»`).join(", ")} — на пересмотре или просрочен
                              </div>
                            </div>
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-muted rounded-tl-sm"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Источники:</span>
                            {msg.sources.map((s) => (
                              <span key={s.materialId} className="inline-flex flex-wrap items-center gap-1">
                                <Link href={`/materials/${s.materialId}`}>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] cursor-pointer hover:bg-accent transition-colors"
                                    onClick={() => setOpen(false)}
                                    data-testid={`ai-source-${s.materialId}`}
                                  >
                                    {s.title}
                                  </Badge>
                                </Link>
                                {materialLinks(s.relatedLinks).map((link) => (
                                  <a
                                    key={`${s.materialId}-${link.url}`}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-primary underline underline-offset-2 hover:text-primary/80"
                                    title={link.label}
                                  >
                                    {link.label}
                                  </a>
                                ))}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}

                  {loading && (
                    <div className="flex gap-2.5">
                      <div className="shrink-0 h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-muted text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Генерирую ответ…
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <Separator />
              <div className="border-t px-4 py-3 shrink-0">
                <div className="flex gap-2">
                  <Input
                    data-testid="input-ai-message"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Задайте вопрос по базе знаний…"
                    className="rounded-xl text-sm"
                    disabled={loading}
                  />
                  <Button
                    data-testid="button-ai-send"
                    size="icon"
                    className="rounded-xl shrink-0"
                    onClick={send}
                    disabled={!input.trim() || loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Ответ формируется только из материалов, доступных вам
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
