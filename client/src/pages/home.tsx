import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Clock, FileText, Flame, Sparkles, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useKB } from "@/lib/kbStore";
import { demoUsers, materials as seedMaterials } from "@/lib/mockData";
import { computeKpis, daysToNextReview, isOverdue, searchMaterials } from "@/lib/kbLogic";

function StatCard({
  title,
  value,
  hint,
  icon,
  testid,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  testid: string;
}) {
  return (
    <Card className="kb-noise">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold" data-testid={testid}>
            {title}
          </CardTitle>
          <div className="rounded-xl bg-accent/50 p-2 text-foreground/80">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-serif text-3xl" data-testid={`${testid}-value`}>
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function MaterialCard({ id }: { id: string }) {
  const { materials } = useKB();
  const m = materials.find((x) => x.materialId === id) || materials.find((x) => x.id === id);
  if (!m) return null;
  const overdue = isOverdue(m);
  const due = daysToNextReview(m);

  return (
    <Card className="group overflow-hidden transition hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="kb-chip" variant={m.status === "Опубликовано" ? "default" : "secondary"}>
                {m.status}
              </Badge>
              {overdue ? (
                <Badge className="kb-chip" variant="destructive" data-testid={`status-overdue-${m.materialId}`}>
                  Просрочено
                </Badge>
              ) : due !== null && due <= 14 ? (
                <Badge className="kb-chip" variant="secondary" data-testid={`status-due-soon-${m.materialId}`}>
                  Пересмотр через {Math.max(0, due)} дн.
                </Badge>
              ) : null}
              <Badge className="kb-chip" variant="outline">
                {m.passport.criticality}
              </Badge>
              <Badge className="kb-chip" variant="outline">
                {m.content.kind === "file" ? (m.content.file?.type.toUpperCase() || "Файл") : "Страница"}
              </Badge>
            </div>
            <div className="mt-2 font-semibold leading-snug" data-testid={`text-material-title-${m.materialId}`}>
              {m.passport.title}
            </div>
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {m.passport.purpose || "—"}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.passport.tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="kb-chip" data-testid={`badge-tag-${m.materialId}-${t}`}>
                  {t}
                </Badge>
              ))}
              {m.passport.tags.length > 4 ? (
                <Badge variant="secondary" className="kb-chip">
                  +{m.passport.tags.length - 4}
                </Badge>
              ) : null}
            </div>
          </div>
          <Link href={`/materials/${m.materialId}`}>
            <Button data-testid={`button-open-material-${m.materialId}`} variant="secondary" className="rounded-xl">
              Открыть
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { me, materials, autoDailyCheck } = useKB();
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    return materials.filter((m) => m.passport.legalEntity === me.legalEntity && m.passport.branch === me.branch);
  }, [materials, me]);

  const kpis = useMemo(() => computeKpis(visible, demoUsers), [visible]);

  const results = useMemo(() => searchMaterials(visible, q), [visible, q]);

  const popular = useMemo(() => [...visible].sort((a, b) => b.stats.views - a.stats.views).slice(0, 3), [visible]);
  const newest = useMemo(() => [...visible].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3), [visible]);
  const overdue = useMemo(() => visible.filter(isOverdue).slice(0, 6), [visible]);
  const soon = useMemo(
    () => visible.filter((m) => {
      const d = daysToNextReview(m);
      return d !== null && d >= 0 && d <= 14 && !isOverdue(m);
    }),
    [visible],
  );

  return (
    <AppShell
      title="Главная"
      search={q}
      onSearch={setQ}
      actions={
        <Button
          data-testid="button-run-daily-check"
          variant="outline"
          className="rounded-xl"
          onClick={() => autoDailyCheck()}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Запустить ежедневную проверку
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              title="Активных материалов"
              value={`${kpis.totalActive}`}
              hint="В вашем юр.лице и филиале"
              icon={<FileText className="h-4 w-4" />}
              testid="kpi-active"
            />
            <StatCard
              title="Просрочено"
              value={`${kpis.overdueCount}`}
              hint={`Доля: ${(kpis.overdueShare * 100).toFixed(0)}%`}
              icon={<TriangleAlert className="h-4 w-4" />}
              testid="kpi-overdue"
            />
            <StatCard
              title="Без владельца"
              value={`${kpis.withoutOwnerCount}`}
              hint="Нужна корректировка паспорта"
              icon={<Flame className="h-4 w-4" />}
              testid="kpi-no-owner"
            />
            <StatCard
              title="Без заместителя"
              value={`${kpis.withoutDeputyCount}`}
              hint="Риск эскалаций и автопереводов"
              icon={<Clock className="h-4 w-4" />}
              testid="kpi-no-deputy"
            />
          </div>

          <Card className="mt-4 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Витрины</CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Новое, популярное, просроченное и скоро на пересмотр.
                  </div>
                </div>
                <div className="relative w-full md:w-[360px]">
                  <Input
                    data-testid="input-showcase-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Быстрый поиск по витринам…"
                    className="rounded-2xl"
                  />
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <Tabs defaultValue="new" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger data-testid="tab-new" value="new">
                    Новое
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-popular" value="popular">
                    Популярное
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-overdue" value="overdue">
                    Просрочено
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-soon" value="soon">
                    Скоро пересмотр
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-4 space-y-3">
                  {(q ? results : newest).map((m) => (
                    <MaterialCard key={m.id} id={m.id} />
                  ))}
                </TabsContent>
                <TabsContent value="popular" className="mt-4 space-y-3">
                  {(q ? results : popular).map((m) => (
                    <MaterialCard key={m.id} id={m.id} />
                  ))}
                </TabsContent>
                <TabsContent value="overdue" className="mt-4 space-y-3">
                  {(q ? results.filter(isOverdue) : overdue).length ? (
                    (q ? results.filter(isOverdue) : overdue).map((m) => <MaterialCard key={m.id} id={m.id} />)
                  ) : (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-overdue">
                      Просроченных материалов нет.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="soon" className="mt-4 space-y-3">
                  {(q ? results : soon).length ? (
                    (q ? results : soon).map((m) => <MaterialCard key={m.id} id={m.id} />)
                  ) : (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-soon">
                      Нет материалов со скорым пересмотром.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4">
          <Card className="sticky top-[92px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Мой доступ</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                Ограничения по юр.лицу/филиалу и роли.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Текущий пользователь</div>
                <div className="mt-1 text-sm font-semibold" data-testid="text-me">
                  {me.displayName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-me-scope">
                  {me.legalEntity} · {me.branch}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {me.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="kb-chip">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Быстрые действия</div>
                <div className="mt-3 grid gap-2">
                  <Link href="/catalog">
                    <Button data-testid="button-quick-catalog" variant="secondary" className="w-full justify-between rounded-xl">
                      Каталог
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/materials/new">
                    <Button data-testid="button-quick-create" className="w-full justify-between rounded-xl">
                      Создать материал
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/admin">
                    <Button data-testid="button-quick-admin" variant="outline" className="w-full justify-between rounded-xl">
                      Админ‑раздел
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Подсказка для MVP</div>
                <div className="mt-2 text-sm">
                  Поиск индексирует название/паспорт/теги и извлечённый текст файла при загрузке.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
