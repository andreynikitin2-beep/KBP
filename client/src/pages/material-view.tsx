import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  FileDown,
  FileText,
  FileUp,
  GitBranch,
  MessageSquareText,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import { demoUsers } from "@/lib/mockData";
import { canConfirmActuality, canViewAudit, daysToNextReview, isOverdue, validatePassport } from "@/lib/kbLogic";

function fmt(iso?: string) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy", { locale: ru });
}

export default function MaterialView() {
  const [, params] = useRoute("/materials/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { me, materials, setMaterials, rfcs, setRfcs, notifications, setNotifications, confirmActuality } = useKB();

  const materialId = params?.id || "";
  const current = useMemo(() => materials.find((m) => m.materialId === materialId) || null, [materials, materialId]);

  const [rfcTitle, setRfcTitle] = useState("");
  const [rfcText, setRfcText] = useState("");
  const [rfcType, setRfcType] = useState<"Проблема" | "Предложение">("Проблема");

  useEffect(() => {
    if (!current) return;
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === current.id
          ? {
              ...m,
              stats: { ...m.stats, views: m.stats.views + 1 },
              auditViews: [{ userId: me.id, at: new Date().toISOString() }, ...m.auditViews].slice(0, 200),
            }
          : m,
      ),
    );
  }, [current?.id]);

  const overdue = current ? isOverdue(current) : false;
  const canConfirm = current ? canConfirmActuality(me, current) : false;
  const dueDays = current ? daysToNextReview(current) : null;
  const missing = current ? validatePassport(current.passport) : [];

  const owner = current ? demoUsers.find((u) => u.id === current.passport.ownerId) : null;
  const deputy = current ? demoUsers.find((u) => u.id === current.passport.deputyId) : null;

  const rfcList = useMemo(() => rfcs.filter((r) => r.materialId === materialId), [rfcs, materialId]);

  if (!current) {
    return (
      <AppShell title="Материал не найден">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Материал недоступен или отсутствует.</div>
            <div className="mt-4">
              <Button data-testid="button-back-catalog" variant="secondary" onClick={() => setLocation("/catalog")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                В каталог
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={current.passport.title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/catalog">
            <Button data-testid="button-back" variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Каталог
            </Button>
          </Link>
          <Button
            data-testid="button-confirm-actuality"
            disabled={!canConfirm}
            className="rounded-xl"
            onClick={() => {
              const res = confirmActuality(current.id);
              if (!res.ok) {
                toast({ title: "Не удалось", description: res.message || "", variant: "destructive" });
              } else {
                toast({ title: "Готово", description: "Актуальность подтверждена в 1 клик." });
              }
            }}
          >
            <BadgeCheck className="mr-2 h-4 w-4" />
            Подтвердить актуальность
          </Button>
          {me.roles.includes("Администратор") && (
            <Button
              data-testid="button-force-publish"
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                const comment = prompt("Введите обязательный комментарий для принудительной публикации:");
                if (!comment) {
                  toast({ title: "Ошибка", description: "Комментарий обязателен", variant: "destructive" });
                  return;
                }
                setMaterials((prev) =>
                  prev.map((m) =>
                    m.id === current.id
                      ? {
                          ...m,
                          status: "Опубликовано",
                          changelog: (m.changelog ? m.changelog + "\n" : "") + `[ADMIN FORCE PUBLISH] ${comment}`,
                          passport: {
                            ...m.passport,
                            lastReviewedAt: new Date().toISOString(),
                          },
                        }
                      : m
                  )
                );
                toast({ title: "Принудительно опубликовано", description: "Запись в аудит добавлена." });
              }}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Принудительно опубликовать
            </Button>
          )}
        </div>
      }
    >
      {overdue ? (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold" data-testid="status-overdue-warning">
                  Внимание: материал просрочен
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Дата пересмотра прошла. Материал автоматически переводится в «На пересмотре», а владельцу отправляются email‑уведомления.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="kb-chip" variant={current.status === "Опубликовано" ? "default" : "secondary"} data-testid="status-material">
                  {current.status}
                </Badge>
                <Badge className="kb-chip" variant="secondary" data-testid="badge-version">
                  Версия {current.version}
                </Badge>
                <Badge className="kb-chip" variant="outline" data-testid="badge-criticality">
                  {current.passport.criticality}
                </Badge>
                <Badge className="kb-chip" variant="outline" data-testid="badge-scope">
                  {current.passport.legalEntity} · {current.passport.branch}
                </Badge>
                {dueDays !== null ? (
                  <Badge className="kb-chip" variant={dueDays < 0 ? "destructive" : "secondary"} data-testid="badge-review-due">
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                    {dueDays < 0 ? `Просрочено на ${Math.abs(dueDays)} дн.` : `Пересмотр через ${dueDays} дн.`}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <Tabs defaultValue="passport" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger data-testid="tab-passport" value="passport">
                    Паспорт
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-content" value="content">
                    Контент
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-versions" value="versions">
                    Версии
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-rfc" value="rfc">
                    RFC
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-discussions" value="discussions">
                    Обсуждения
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-audit" value="audit">
                    Аудит
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="passport" className="mt-4">
                  {missing.length ? (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-800">
                          <CircleAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold" data-testid="status-passport-invalid">
                            Паспорт заполнен не полностью
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Перед публикацией нужно заполнить: {missing.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <Card className="p-4">
                      <div className="text-xs text-muted-foreground">Владелец</div>
                      <div className="mt-1 font-semibold" data-testid="text-owner">
                        {owner?.displayName || "—"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{owner?.email || ""}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-xs text-muted-foreground">Заместитель</div>
                      <div className="mt-1 font-semibold" data-testid="text-deputy">
                        {deputy?.displayName || "—"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{deputy?.email || ""}</div>
                    </Card>
                    <Card className="p-4 md:col-span-2">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Последний пересмотр</div>
                          <div className="mt-1 font-semibold" data-testid="text-last-review">
                            {fmt(current.passport.lastReviewedAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Следующий пересмотр</div>
                          <div className="mt-1 font-semibold" data-testid="text-next-review">
                            {fmt(current.passport.nextReviewAt)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Период (по критичности)</div>
                          <div className="mt-1 font-semibold" data-testid="text-review-period">
                            {current.passport.reviewPeriodDays ? `${current.passport.reviewPeriodDays} дн.` : "—"}
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 md:col-span-2">
                      <div className="text-xs text-muted-foreground">Теги</div>
                      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags">
                        {current.passport.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="kb-chip" data-testid={`badge-tag-${t}`}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <Separator className="my-3" />
                      <div className="text-xs text-muted-foreground">Группы тегов</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2" data-testid="list-tag-groups">
                        {current.passport.tagGroups.map((g) => (
                          <div key={g.group} className="rounded-2xl border bg-muted/30 p-3" data-testid={`card-tag-group-${g.group}`}>
                            <div className="text-sm font-semibold">{g.group}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {g.tags.map((t) => (
                                <Badge key={t} variant="secondary" className="kb-chip">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="mt-4">
                  {current.content.kind === "file" ? (
                    <div className="space-y-3">
                      <Card className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-xl bg-accent/50 p-2">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold" data-testid="text-file-name">
                                {current.content.file?.name}
                              </div>
                              <div className="text-xs text-muted-foreground">Полнотекстовый индекс: извлечённый текст</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button data-testid="button-download" variant="secondary" className="rounded-xl">
                              <FileDown className="mr-2 h-4 w-4" />
                              Скачать
                            </Button>
                            <Button
                              data-testid="button-deeplink-pdf"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => {
                                navigator.clipboard.writeText(`${location.origin}/materials/${current.materialId}?page=3`);
                                toast({ title: "Ссылка скопирована", description: "Глубокая ссылка на PDF (страница 3)" });
                              }}
                            >
                              Глубокая ссылка
                            </Button>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="text-xs font-medium text-muted-foreground">Извлечённый текст (MVP индекс)</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm" data-testid="text-extracted">
                          {current.content.file?.extractedText || "—"}
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Card className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" data-testid="text-page-mode">
                              Страница портала
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Поддерживаются якоря для глубоких ссылок (например, #obshchiy-poryadok).
                            </div>
                          </div>
                          <Button
                            data-testid="button-copy-anchor"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              const anchor = current.content.page?.blocks.find((b) => b.anchor)?.anchor || "";
                              navigator.clipboard.writeText(`${location.origin}/materials/${current.materialId}#${anchor}`);
                              toast({ title: "Ссылка скопирована", description: `Якорь: #${anchor}` });
                            }}
                          >
                            Скопировать якорь
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="space-y-3" data-testid="page-content">
                          {current.content.page?.blocks.map((b) => {
                            if (b.type === "heading") {
                              return (
                                <div key={b.id} id={b.anchor} data-testid={`block-heading-${b.id}`}>
                                  <div className="font-serif text-xl">{b.text}</div>
                                </div>
                              );
                            }
                            if (b.type === "list") {
                              return (
                                <div key={b.id} data-testid={`block-list-${b.id}`}>
                                  <div className="whitespace-pre-wrap text-sm">{b.text}</div>
                                </div>
                              );
                            }
                            return (
                              <div key={b.id} data-testid={`block-paragraph-${b.id}`}>
                                <div className="text-sm leading-relaxed text-muted-foreground">{b.text}</div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="mt-4">
                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                        <GitBranch className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold" data-testid="text-version-rule">
                          Правило версий
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Опубликованную версию нельзя редактировать напрямую. Создайте новую версию — история сохранится.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border p-4" data-testid="list-versions">
                    <div className="text-sm font-semibold">Текущая версия: {current.version}</div>
                    <div className="mt-2 text-sm text-muted-foreground">(В MVP демонстрируется как список. Полная история версий — в бэкенде.)</div>
                    <div className="mt-3">
                      <Button data-testid="button-create-new-version" variant="secondary" className="rounded-xl" disabled>
                        Создать новую версию
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rfc" className="mt-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="p-4">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-semibold">Сообщить о проблеме / предложить правку</div>
                      </div>
                      <div className="mt-3 grid gap-3">
                        <div>
                          <Label htmlFor="rfcTitle">Тема</Label>
                          <Input
                            id="rfcTitle"
                            data-testid="input-rfc-title"
                            value={rfcTitle}
                            onChange={(e) => setRfcTitle(e.target.value)}
                            placeholder="Коротко: что не так?"
                            className="mt-1 rounded-xl"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rfcType">Тип</Label>
                          <div className="mt-1 flex gap-2">
                            <Button
                              data-testid="button-rfc-type-problem"
                              type="button"
                              variant={rfcType === "Проблема" ? "default" : "outline"}
                              className="rounded-xl"
                              onClick={() => setRfcType("Проблема")}
                            >
                              Проблема
                            </Button>
                            <Button
                              data-testid="button-rfc-type-suggest"
                              type="button"
                              variant={rfcType === "Предложение" ? "default" : "outline"}
                              className="rounded-xl"
                              onClick={() => setRfcType("Предложение")}
                            >
                              Предложение
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="rfcText">Описание</Label>
                          <Textarea
                            id="rfcText"
                            data-testid="textarea-rfc-description"
                            value={rfcText}
                            onChange={(e) => setRfcText(e.target.value)}
                            placeholder="Опишите проблему и ожидаемый результат…"
                            className="mt-1 min-h-[120px] rounded-xl"
                          />
                        </div>
                        <Button
                          data-testid="button-create-rfc"
                          className="rounded-xl"
                          onClick={() => {
                            const assignedTo = current.passport.ownerId || me.id;
                            const newRfc = {
                              id: `rfc-${rfcs.length + 1}`,
                              materialId: current.materialId,
                              createdAt: new Date().toISOString(),
                              createdBy: me.id,
                              type: rfcType,
                              title: rfcTitle.trim() || "Без темы",
                              description: rfcText.trim(),
                              status: "Новый" as const,
                              assignedTo,
                              sla: {},
                              comments: [],
                            };
                            setRfcs((p) => [newRfc, ...p]);
                            setRfcTitle("");
                            setRfcText("");
                            toast({ title: "RFC создан", description: "Назначено владельцу материала." });

                            const to = demoUsers.find((u) => u.id === assignedTo)?.email || "unknown@demo.local";
                            setNotifications((p) => [
                              {
                                id: `n-${Math.random().toString(16).slice(2)}`,
                                at: new Date().toISOString(),
                                to,
                                subject: `Новый RFC по материалу: ${current.passport.title}`,
                                template: "auto_transition",
                                related: { materialId: current.materialId, rfcId: newRfc.id },
                                status: "LOGGED",
                              },
                              ...p,
                            ]);
                          }}
                        >
                          Создать RFC
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-semibold">RFC по материалу</div>
                        <Badge variant="secondary" className="kb-chip" data-testid="badge-rfc-count">
                          {rfcList.length}
                        </Badge>
                      </div>
                      <Separator className="my-3" />
                      <div className="space-y-3" data-testid="list-rfcs">
                        {rfcList.length ? (
                          rfcList.map((r) => {
                            const who = demoUsers.find((u) => u.id === r.createdBy)?.displayName || r.createdBy;
                            const ass = demoUsers.find((u) => u.id === r.assignedTo)?.displayName || r.assignedTo;
                            return (
                              <div key={r.id} className="rounded-2xl border p-3" data-testid={`card-rfc-${r.id}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-sm font-semibold">{r.title}</div>
                                  <Badge variant="secondary" className="kb-chip">
                                    {r.status}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {r.type} · {fmt(r.createdAt)} · автор: {who}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{r.description || "—"}</div>
                                <div className="mt-2 text-xs text-muted-foreground">Назначено: {ass}</div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-rfc">
                            RFC пока нет.
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="discussions" className="mt-4">
                  <Card className="p-4">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                        <MessageSquareText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold" data-testid="text-discussions">
                          Обсуждения
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Владелец включает обсуждения и выбирает видимость. В MVP — демонстрация режима.
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <div className="text-sm">
                        Статус: <span className="font-semibold">{current.discussionsEnabled ? "Включены" : "Выключены"}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground" data-testid="text-discussion-visibility">
                        Видимость: {current.discussionVisibility}
                      </div>
                      <div className="mt-3">
                        <Button data-testid="button-toggle-discussions" variant="secondary" className="rounded-xl" disabled>
                          Управлять
                        </Button>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  {!canViewAudit(me) ? (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-audit-no-access">
                      У вашей роли нет доступа к аудиту просмотров.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Card className="p-4">
                        <div className="flex items-center gap-2">
                          <FileUp className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm font-semibold">Аудит просмотров</div>
                          <Badge variant="secondary" className="kb-chip" data-testid="badge-audit-count">
                            {current.auditViews.length}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2" data-testid="list-audit">
                          {current.auditViews.slice(0, 20).map((v, idx) => {
                            const who = demoUsers.find((u) => u.id === v.userId)?.displayName || v.userId;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-2"
                                data-testid={`row-audit-${idx}`}
                              >
                                <div className="text-sm">{who}</div>
                                <div className="text-xs text-muted-foreground">{fmt(v.at)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-[92px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Полезность</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">Оценка «помогло/не помогло» и счётчик просмотров.</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Просмотры</div>
                <div className="mt-1 font-serif text-3xl" data-testid="text-views">
                  {current.stats.views}
                </div>
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">Оценка</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    data-testid="button-helpful-yes"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => {
                      setMaterials((prev) =>
                        prev.map((m) =>
                          m.id === current.id ? { ...m, stats: { ...m.stats, helpfulYes: m.stats.helpfulYes + 1 } } : m,
                        ),
                      );
                      toast({ title: "Спасибо", description: "Отметили: помогло" });
                    }}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Помогло
                  </Button>
                  <Button
                    data-testid="button-helpful-no"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setMaterials((prev) =>
                        prev.map((m) =>
                          m.id === current.id ? { ...m, stats: { ...m.stats, helpfulNo: m.stats.helpfulNo + 1 } } : m,
                        ),
                      );
                      toast({ title: "Принято", description: "Отметили: не помогло" });
                    }}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    Не помогло
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground" data-testid="text-helpful-stats">
                  Помогло: {current.stats.helpfulYes} · Не помогло: {current.stats.helpfulNo}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                    <CircleAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">RBAC и доступ</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Просмотр зависит от юр.лица/филиала. Кнопка «Подтвердить актуальность» — только для владельца/заместителя/модератора.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Уведомления по email</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      В MVP письма не отправляются, а логируются в журнале уведомлений (см. админ‑раздел).
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
