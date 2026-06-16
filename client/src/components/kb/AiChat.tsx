import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Clock, Loader2, Plus, Send, Sparkles, Trash2, User as UserIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useKB } from "@/lib/kbStore";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ materialId: string; title: string }>;
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
    sources: Array<{ materialId: string; title: string }> | null;
    createdAt: string;
  }>;
};

type View = "chat" | "history";

export function AiChat() {
  const { me } = useKB();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAiStatus().then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          setMessages(
            latest.messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              sources: m.sources ?? undefined,
            }))
          );
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
    setMessages(
      session.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: m.sources ?? undefined,
      }))
    );
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
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
        onClick={() => onOpen(true)}
        title="AI-помощник"
      >
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="hidden sm:inline text-xs font-medium">AI</span>
      </Button>

      <Sheet open={open} onOpenChange={onOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] p-0 flex flex-col gap-0">
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

                  {messages.map((msg) => (
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
                              <Link key={s.materialId} href={`/materials/${s.materialId}`}>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] cursor-pointer hover:bg-accent transition-colors"
                                  onClick={() => setOpen(false)}
                                  data-testid={`ai-source-${s.materialId}`}
                                >
                                  {s.title}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

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
