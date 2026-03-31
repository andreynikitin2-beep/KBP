import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  GitPullRequest,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKB } from "@/lib/kbStore";
import { computeHelpfulnessScore, computeKpis, computePopularityScore, daysToNextReview, isOverdue, MIN_RATINGS_FOR_HELPFUL, searchMaterials } from "@/lib/kbLogic";

const critOrder: Record<string, number> = { "Критическая": 0, "Высокая": 1, "Средняя": 2, "Низкая": 3 };
const statusOrder: Record<string, number> = { "Опубликовано": 0, "На пересмотре": 1, "На согласовании": 2, "Черновик": 3, "Архив": 4 };

function MaterialCard({ id }: { id: string }) {
  const { visibleMaterials: materials } = useKB();
  const m = materials.find((x) => x.materialId === id) || materials.find((x) => x.id === id);
  if (!m) return null;
  const due = daysToNextReview(m);

  return (
    <Link href={`/materials/${m.materialId}`} className="block">
    <Card className="group relative overflow-hidden kb-card-interactive border-muted/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="rounded-md px-2 py-0 text-[10px] font-bold uppercase tracking-wider" variant={m.status === "Опубликовано" ? "default" : m.status === "Черновик" ? "secondary" : "outline"}>
                {m.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">• {m.passport.criticality} • {m.content.kind === "file" ? (m.content.file?.type.toUpperCase() || "Файл") : "Страница"}</span>
            </div>
            <div className="font-bold text-base leading-tight group-hover:text-primary transition-colors" data-testid={`text-material-title-${m.materialId}`}>
              {m.passport.title}
            </div>
            <div className="mt-1 text-sm text-muted-foreground/80 line-clamp-1">
              {m.passport.purpose || "Без описания"}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
               <Clock className="h-3 w-3" />
               Обновлено: {new Date(m.createdAt).toLocaleDateString("ru-RU")}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.passport.tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="bg-muted/50 text-muted-foreground border-none text-[10px] px-2 py-0 rounded-lg">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <div className="rounded-full h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

function CompactMaterialRow({ id, label }: { id: string; label?: string }) {
  const { materials } = useKB();
  const m = materials.find((x) => x.materialId === id) || materials.find((x) => x.id === id);
  if (!m) return null;

  return (
    <Link href={`/materials/${m.materialId}`}>
      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer group kb-row-hover" data-testid={`row-material-${m.materialId}`}>
        <div className="h-8 w-8 rounded flex items-center justify-center bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight line-clamp-1">{m.passport.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {label || m.status} · {m.passport.criticality}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}

export default function Home() {
  const { me, users, visibleMaterials, materials: allMaterials, rfcs, notifications, autoDailyCheck, visibilityGroups } = useKB();
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "popularity" | "criticality" | "status">("date");

  const isAuthor = me.roles.includes("Автор");
  const isOwner = me.roles.includes("Владелец");
  const isDeputy = me.roles.includes("Заместитель владельца");
  const isAdmin = me.roles.includes("Администратор");
  const isOwnerOrDeputy = isOwner || isDeputy;

  const kpis = useMemo(() => computeKpis(visibleMaterials, users), [visibleMaterials, users]);

  const myDrafts = useMemo(() =>
    allMaterials.filter((m) => m.createdBy === me.id && m.status === "Черновик"),
    [allMaterials, me.id],
  );

  const awaitingApproval = useMemo(() =>
    allMaterials.filter((m) =>
      m.status === "На согласовании" && (m.passport.ownerId === me.id || m.passport.deputyId === me.id),
    ),
    [allMaterials, me.id],
  );

  const myOnReview = useMemo(() =>
    allMaterials.filter((m) =>
      m.status === "На пересмотре" && (m.passport.ownerId === me.id || m.passport.deputyId === me.id),
    ),
    [allMaterials, me.id],
  );

  const roleModuleIds = useMemo(() => {
    const ids = new Set<string>();
    myDrafts.forEach((m) => ids.add(m.id));
    awaitingApproval.forEach((m) => ids.add(m.id));
    myOnReview.forEach((m) => ids.add(m.id));
    return ids;
  }, [myDrafts, awaitingApproval, myOnReview]);

  const showcaseMaterials = useMemo(() =>
    visibleMaterials.filter((m) => !roleModuleIds.has(m.id)),
    [visibleMaterials, roleModuleIds],
  );

  const results = useMemo(() => searchMaterials(showcaseMaterials, q), [showcaseMaterials, q]);

  const sortedResults = useMemo(() => {
    const list = [...results];
    switch (sortBy) {
      case "date": return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "popularity": return list.sort((a, b) => b.stats.views - a.stats.views);
      case "criticality": return list.sort((a, b) => (critOrder[a.passport.criticality] ?? 9) - (critOrder[b.passport.criticality] ?? 9));
      case "status": return list.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
      default: return list;
    }
  }, [results, sortBy]);

  const avgHelpfulness = useMemo(() => {
    const published = showcaseMaterials.filter(m => m.status === "Опубликовано");
    const totalH = published.reduce((s, m) => s + m.stats.helpfulYes, 0);
    const totalR = published.reduce((s, m) => s + m.stats.helpfulYes + m.stats.helpfulNo, 0);
    return totalR > 0 ? totalH / totalR : 0.5;
  }, [showcaseMaterials]);

  const popular = useMemo(() =>
    [...showcaseMaterials]
      .filter(m => m.status === "Опубликовано")
      .map(m => {
        const total = m.stats.helpfulYes + m.stats.helpfulNo;
        const hs = computeHelpfulnessScore(m.stats.helpfulYes, total, avgHelpfulness);
        const ps = computePopularityScore(m.stats.views, hs);
        return { ...m, _ps: ps };
      })
      .sort((a, b) => b._ps - a._ps)
      .slice(0, 4),
    [showcaseMaterials, avgHelpfulness],
  );

  const mostHelpful = useMemo(() =>
    [...showcaseMaterials]
      .filter(m => m.status === "Опубликовано" && (m.stats.helpfulYes + m.stats.helpfulNo) >= MIN_RATINGS_FOR_HELPFUL)
      .map(m => {
        const total = m.stats.helpfulYes + m.stats.helpfulNo;
        const hs = computeHelpfulnessScore(m.stats.helpfulYes, total, avgHelpfulness);
        return { ...m, _hs: hs };
      })
      .sort((a, b) => b._hs - a._hs)
      .slice(0, 4),
    [showcaseMaterials, avgHelpfulness],
  );

  const newest = useMemo(() =>
    [...showcaseMaterials].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4),
    [showcaseMaterials],
  );

  const myRfcs = useMemo(() =>
    rfcs.filter((r) => r.assignedTo === me.id && (r.status === "Новый" || r.status === "В работе")),
    [rfcs, me.id],
  );

  const overdueAll = useMemo(() => allMaterials.filter(isOverdue), [allMaterials]);

  const failedNotifications = useMemo(() =>
    notifications.filter((n) => n.status === "FAILED"),
    [notifications],
  );

  const withoutOwner = useMemo(() =>
    allMaterials.filter((m) => m.status !== "Архив" && !m.passport.ownerId),
    [allMaterials],
  );

  return (
    <AppShell
      title="Главная"
      breadcrumbs={[{ label: "Центр знаний ЦОС", href: "/" }, { label: "Главная" }]}
      search={q}
      onSearch={setQ}
      actions={
        <div className="flex items-center gap-2">
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">

          {isOwnerOrDeputy && (
            <Card data-testid="card-owner-module">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Мои задачи (владелец / заместитель)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">{awaitingApproval.length}</Badge>
                    <span className="text-sm font-semibold">Ждут согласования</span>
                  </div>
                  {awaitingApproval.length ? (
                    <div className="space-y-1">
                      {awaitingApproval.map((m) => (
                        <CompactMaterialRow key={m.id} id={m.id} label="На согласовании" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pl-1" data-testid="empty-awaiting">Нет материалов на согласовании.</div>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={myOnReview.length ? "destructive" : "secondary"} className="text-[10px]">{myOnReview.length}</Badge>
                    <span className="text-sm font-semibold">На пересмотре</span>
                  </div>
                  {myOnReview.length ? (
                    <div className="space-y-1">
                      {myOnReview.map((m) => (
                        <CompactMaterialRow key={m.id} id={m.id} label="Требует пересмотра" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pl-1" data-testid="empty-review">Нет материалов на пересмотре.</div>
                  )}
                </div>

                {isAdmin && (
                <>
                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px]">{myRfcs.length}</Badge>
                    <span className="text-sm font-semibold">Мои RFC (запросы на изменение)</span>
                  </div>
                  {myRfcs.length ? (
                    <div className="space-y-1">
                      {myRfcs.map((r) => {
                        const mat = allMaterials.find((m) => m.materialId === r.materialId);
                        return (
                          <Link key={r.id} href={`/materials/${r.materialId}`}>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-rfc-${r.id}`}>
                              <div className="h-8 w-8 rounded flex items-center justify-center bg-orange-100 text-orange-600 group-hover:bg-orange-200 transition-colors shrink-0">
                                <GitPullRequest className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold leading-tight line-clamp-1">{r.title}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {r.type} · {r.status} · {mat?.passport.title || r.materialId}
                                </div>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pl-1" data-testid="empty-rfcs">Нет активных RFC.</div>
                  )}
                </div>
                </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden" data-testid="card-showcase">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Витрина материалов
                  </CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Новое и популярное из доступных вам материалов.
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-showcase-search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Поиск по материалам…"
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-[180px] rounded-xl" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">По дате</SelectItem>
                      <SelectItem value="popularity">По популярности</SelectItem>
                      <SelectItem value="criticality">По критичности</SelectItem>
                      <SelectItem value="status">По статусу</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              {q ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground mb-2">
                    Найдено: {sortedResults.length}
                  </div>
                  {sortedResults.length ? sortedResults.slice(0, 6).map((m) => (
                    <MaterialCard key={m.id} id={m.id} />
                  )) : (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-search">
                      Ничего не найдено.
                    </div>
                  )}
                </div>
              ) : (
                <Tabs defaultValue="new" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger data-testid="tab-new" value="new">Новое</TabsTrigger>
                    <TabsTrigger data-testid="tab-popular" value="popular">Популярное</TabsTrigger>
                    <TabsTrigger data-testid="tab-helpful" value="helpful">Самые полезные</TabsTrigger>
                  </TabsList>
                  <TabsContent value="new" className="mt-4 space-y-3">
                    {newest.map((m) => (
                      <MaterialCard key={m.id} id={m.id} />
                    ))}
                  </TabsContent>
                  <TabsContent value="popular" className="mt-4 space-y-3">
                    {popular.map((m) => (
                      <MaterialCard key={m.id} id={m.id} />
                    ))}
                  </TabsContent>
                  <TabsContent value="helpful" className="mt-4 space-y-3">
                    {mostHelpful.length ? mostHelpful.map(m => (
                      <MaterialCard key={m.id} id={m.id} />
                    )) : (
                      <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-helpful">
                        Недостаточно оценок для формирования рейтинга (нужно минимум {MIN_RATINGS_FOR_HELPFUL}).
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {isAuthor && (
            <Card data-testid="card-author-module">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-blue-500" />
                    Мои черновики
                  </CardTitle>
                  <Link href="/materials/new">
                    <Button data-testid="button-create-material" size="sm" className="rounded-xl h-8 bg-blue-600 hover:bg-blue-700">
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      Создать
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {myDrafts.length ? (
                  <div className="space-y-1">
                    {myDrafts.map((m) => (
                      <CompactMaterialRow key={m.id} id={m.id} label="Черновик" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="empty-drafts">
                    У вас нет черновиков. Создайте новый материал.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card data-testid="card-admin-module">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    Здоровье базы знаний
                  </CardTitle>
                  <Link href="/admin">
                    <Button data-testid="button-admin-panel" size="sm" variant="outline" className="rounded-xl h-8">
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Админка
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Активных</div>
                    <div className="text-2xl font-bold mt-1" data-testid="kpi-active-value">{kpis.totalActive}</div>
                  </div>
                  <div className="rounded-xl border p-3 border-destructive/30">
                    <div className="text-xs text-destructive uppercase tracking-wider">Просрочено</div>
                    <div className="text-2xl font-bold mt-1 text-destructive" data-testid="kpi-overdue-value">{overdueAll.length}</div>
                  </div>
                  <div className="rounded-xl border p-3 border-orange-300">
                    <div className="text-xs text-orange-600 uppercase tracking-wider">Без владельца</div>
                    <div className="text-2xl font-bold mt-1 text-orange-600" data-testid="kpi-no-owner-value">{withoutOwner.length}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Без заместителя</div>
                    <div className="text-2xl font-bold mt-1" data-testid="kpi-no-deputy-value">{kpis.withoutDeputyCount}</div>
                  </div>
                </div>

                {(overdueAll.length > 0 || failedNotifications.length > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {overdueAll.length > 0 && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <TriangleAlert className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-semibold text-destructive">Просроченные материалы ({overdueAll.length})</span>
                          </div>
                          <div className="space-y-1">
                            {overdueAll.slice(0, 3).map((m) => (
                              <CompactMaterialRow key={m.id} id={m.id} label={`Просрочен на ${Math.abs(daysToNextReview(m) || 0)} дн.`} />
                            ))}
                          </div>
                        </div>
                      )}

                      {failedNotifications.length > 0 && (
                        <div className="rounded-xl border border-orange-300 bg-orange-50/50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-semibold text-orange-700">Ошибки уведомлений ({failedNotifications.length})</span>
                          </div>
                          <div className="space-y-1.5">
                            {failedNotifications.slice(0, 3).map((n) => (
                              <div key={n.id} className="text-xs text-muted-foreground flex items-start gap-2">
                                <Bell className="h-3 w-3 mt-0.5 text-orange-500 shrink-0" />
                                <span className="line-clamp-1">{n.subject}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Последние уведомления</div>
                  <div className="space-y-1.5">
                    {notifications.slice(0, 4).map((n) => (
                      <div key={n.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Badge variant={n.status === "FAILED" ? "destructive" : "secondary"} className="text-[9px] px-1.5 py-0 shrink-0 mt-0.5">
                          {n.status}
                        </Badge>
                        <span className="line-clamp-1 flex-1">{n.subject}</span>
                        <span className="text-[10px] shrink-0">{new Date(n.at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-[92px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Мой профиль</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Текущий пользователь</div>
                <div className="mt-1 text-sm font-semibold" data-testid="text-me">
                  {me.displayName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-me-scope">
                  {me.legalEntity}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {me.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="kb-chip">
                      {r}
                    </Badge>
                  ))}
                </div>
                {(() => {
                  const myGroups = visibilityGroups.filter(g => !g.isSystem && g.memberIds.includes(me.id));
                  return myGroups.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground mb-1.5">Группы видимости</div>
                      <div className="flex flex-wrap gap-1.5">
                        {myGroups.map(g => (
                          <Badge key={g.id} variant="outline" className="kb-chip">
                            {g.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Быстрые действия</div>
                <div className="mt-3 grid gap-2">
                  <Link href="/catalog">
                    <Button data-testid="button-quick-catalog" variant="secondary" className="w-full justify-between rounded-xl">
                      <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Каталог</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {(isAuthor || isOwner || isAdmin) && (
                    <Link href="/materials/new">
                      <Button data-testid="button-quick-create" className="w-full justify-between rounded-lg bg-[#0891b2] hover:bg-[#0e7490] text-white font-bold h-10">
                        <span className="flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Создать материал</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/admin">
                      <Button data-testid="button-quick-admin" variant="outline" className="w-full justify-between rounded-xl">
                        <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Админ‑раздел</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {isOwnerOrDeputy && (
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs font-medium text-muted-foreground mb-3">Сводка задач</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">На согласовании</span>
                      <Badge variant={awaitingApproval.length ? "default" : "secondary"} className="text-[10px]">{awaitingApproval.length}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">На пересмотре</span>
                      <Badge variant={myOnReview.length ? "destructive" : "secondary"} className="text-[10px]">{myOnReview.length}</Badge>
                    </div>
                    {isAdmin && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Активные RFC</span>
                      <Badge variant="secondary" className="text-[10px]">{myRfcs.length}</Badge>
                    </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Подсказка</div>
                <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {isAdmin
                    ? "Вы видите все модули. Используйте «Ежедневную проверку» для обнаружения просроченных материалов."
                    : isOwnerOrDeputy
                    ? "Следите за задачами: согласуйте черновики и пересмотрите просроченные материалы."
                    : isAuthor
                    ? "Создавайте материалы и отправляйте на согласование владельцу раздела."
                    : "Используйте поиск и каталог для навигации по базе знаний."}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
