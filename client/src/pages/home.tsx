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
  progress,
  color = "primary",
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  testid: string;
  progress: number;
  color?: "primary" | "destructive" | "warning" | "info";
}) {
  const colorMap = {
    primary: "bg-primary",
    destructive: "bg-destructive",
    warning: "bg-orange-500",
    info: "bg-blue-400",
  };

  return (
    <Card className="kb-noise border-none shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight" data-testid={`${testid}-value`}>
              {value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground">{icon}</div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={`h-full transition-all ${colorMap[color]}`} 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="mt-1 flex justify-end text-[10px] font-medium text-muted-foreground">
          {progress.toFixed(1)}%
        </div>
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
    <Card className="group relative overflow-hidden transition-all hover:shadow-md border-muted/60">
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
          <Link href={`/materials/${m.materialId}`}>
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/5">
              <ArrowRight className="h-4 w-4" />
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
        <div className="flex items-center gap-2">
           <Button
            data-testid="button-run-daily-check-outline"
            variant="outline"
            className="rounded-lg h-9 border-[#a3e635] text-[#65a30d] hover:bg-[#a3e635]/10 font-bold text-xs"
            onClick={() => autoDailyCheck()}
          >
            Запустить ежедневную проверку
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              title="Активных материалов"
              value={`${kpis.totalActive}`}
              hint="В базе 640 тыс. файлов"
              icon={<FileText className="h-4 w-4" />}
              testid="kpi-active"
              progress={100}
              color="primary"
            />
            <StatCard
              title="Просрочено"
              value={`${kpis.overdueCount}`}
              hint={`Доля ${(kpis.overdueShare * 100).toFixed(0)}%`}
              icon={<TriangleAlert className="h-4 w-4" />}
              testid="kpi-overdue"
              progress={kpis.overdueShare * 100}
              color="destructive"
            />
            <StatCard
              title="Без владельца"
              value={`${kpis.withoutOwnerCount}`}
              hint="Нулей кома‑первая паспорта"
              icon={<Flame className="h-4 w-4" />}
              testid="kpi-no-owner"
              progress={1.3}
              color="warning"
            />
            <StatCard
              title="Без заместителя"
              value={`${kpis.withoutDeputyCount}`}
              hint="Рост эскалации и автопроводов"
              icon={<Clock className="h-4 w-4" />}
              testid="kpi-no-deputy"
              progress={7.0}
              color="info"
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
                    <Button data-testid="button-quick-create" className="w-full justify-between rounded-lg bg-[#0891b2] hover:bg-[#0e7490] text-white font-bold h-10">
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

              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Недавно просмотренные</div>
                <div className="mt-3 space-y-2">
                   {[
                     { t: "Инструкция по работе с CRM", a: "2 часа назад" },
                     { t: "Политика безопасности данных", a: "5 часов назад" },
                     { t: "Регламент согласования документов", a: "Вчера" }
                   ].map((doc, i) => (
                     <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className="h-8 w-8 rounded flex items-center justify-center bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                           <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight line-clamp-1">{doc.t}</div>
                          <div className="text-[10px] text-muted-foreground">{doc.a}</div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Подсказка для МУР</div>
                <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Поиск индексирует название/паспорт/теги и извлечённый текст файла при загрузке
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
