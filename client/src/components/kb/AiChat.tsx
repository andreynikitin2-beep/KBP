import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Send, Sparkles, User as UserIcon, X } from "lucide-react";
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

export function AiChat() {
  const { me } = useKB();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAiStatus().then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      const result = await api.aiChat({ userId: me.id, message: msg, history });
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

  if (!enabled) return null;

  return (
    <>
      <Button
        data-testid="button-ai-chat"
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="AI-помощник"
      >
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="hidden sm:inline text-xs font-medium">AI</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] p-0 flex flex-col gap-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="font-semibold text-sm">AI-помощник</div>
            <div className="text-xs text-muted-foreground">по базе знаний</div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 rounded-lg"
              onClick={() => setOpen(false)}
              data-testid="button-ai-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 pb-2">
              {messages.length === 0 && (
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

          {messages.length > 0 && (
            <>
              <Separator />
              <div className="px-4 py-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground w-full rounded-xl"
                  onClick={() => setMessages([])}
                  data-testid="button-ai-clear"
                >
                  Очистить историю
                </Button>
              </div>
            </>
          )}

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
        </SheetContent>
      </Sheet>
    </>
  );
}
