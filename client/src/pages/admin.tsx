import { useMemo, useState } from "react";
import { Download, Mail, Shield, SlidersHorizontal, Table2, Users } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import { demoUsers, visibilityGroups } from "@/lib/mockData";
import { computeKpis, isOverdue } from "@/lib/kbLogic";

function csvEscape(v: string) {
  const s = String(v ?? "");
  if (/[\n\r,\"]/g.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const { toast } = useToast();
  const { me, materials, notifications, policy } = useKB();
  const [q, setQ] = useState("");

  const scoped = useMemo(
    () => materials.filter((m) => m.passport.legalEntity === me.legalEntity && m.passport.branch === me.branch),
    [materials, me],
  );

  const kpis = useMemo(() => computeKpis(scoped, demoUsers), [scoped]);

  const notificationsFiltered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return notifications;
    return notifications.filter((n) => (n.subject + " " + n.to).toLowerCase().includes(query));
  }, [notifications, q]);

  return (
    <AppShell
      title="Администрирование"
      search={q}
      onSearch={setQ}
      actions={
        <Button
          data-testid="button-export-registry"
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            downloadCsv(
              "registry.csv",
              [
                ["Материал", "Версия", "Статус", "Критичность", "Следующий пересмотр", "Владелец"],
                ...scoped.map((m) => [
                  m.passport.title,
                  m.version,
                  m.status,
                  m.passport.criticality,
                  m.passport.nextReviewAt ? new Date(m.passport.nextReviewAt).toLocaleDateString("ru-RU") : "",
                  demoUsers.find((u) => u.id === m.passport.ownerId)?.displayName || "",
                ]),
              ],
            );
            toast({ title: "Экспорт готов", description: "CSV открыт как Excel (демо)." });
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Экспорт в Excel
        </Button>
      }
    >
      <div className="grid gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Админ‑раздел (MVP прототип)</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Справочники/политики/права/отчёты/экспорт. В демо — управление отображением и журнал email.
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-4">
            <Tabs defaultValue="policies" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger data-testid="tab-admin-policies" value="policies">
                  Политики
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-rights" value="rights">
                  Права
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-groups" value="groups">
                  Группы
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-reports" value="reports">
                  Отчёты
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-mail" value="mail">
                  Email‑журнал
                </TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="text-sm font-semibold">Группы видимости</div>
                    <div className="mt-3 space-y-3">
                      {visibilityGroups.map(g => (
                        <div key={g.id} className="rounded-2xl border bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-bold text-sm">{g.title}</span>
                              {g.isSystem && <Badge variant="secondary" className="text-[10px]">Системная</Badge>}
                            </div>
                            <Badge variant="outline" className="text-[10px]">{g.memberIds.length} уч.</Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {g.isSystem ? "Нельзя удалить или изменить состав" : "Ручное управление составом"}
                          </div>
                          {!g.isSystem && (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg">Изменить состав</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] rounded-lg text-destructive">Удалить</Button>
                            </div>
                          )}
                        </div>
                      ))}
                      <Button className="w-full rounded-xl" variant="outline">
                        + Создать группу
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm font-semibold">Политика групп</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Группы используются для ограничения видимости разделов каталога и материалов.
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <div className="text-xs">
                          <span className="font-bold">Базовая:</span> всегда включает всех пользователей. Используется для общедоступного контента.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="mt-1 h-2 w-2 rounded-full bg-orange-500" />
                        <div className="text-xs">
                          <span className="font-bold">Изоляция:</span> группы полностью независимы от AD-групп и управляются только вручную.
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="policies" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">Периоды пересмотра по критичности</div>
                    </div>
                    <div className="mt-3 space-y-2" data-testid="list-review-periods">
                      {policy.reviewPeriods.map((p) => (
                        <div key={p.criticality} className="rounded-2xl border bg-muted/20 p-3" data-testid={`row-policy-${p.criticality}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">{p.criticality}</div>
                            <Badge variant="secondary" className="kb-chip">
                              {p.days} дн.
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Напомнить за: {p.remindBeforeDays.join(", ")} · Эскалации: {p.escalationAfterDays.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">Интеграция с AD (переключаемая)</div>
                    </div>
                    <div className="mt-3 rounded-2xl border bg-muted/20 p-3" data-testid="card-ad-config">
                      <div className="text-sm">Сейчас: <span className="font-semibold">{policy.adIntegration.enabled ? "Включено" : "Выключено"}</span></div>
                      <div className="mt-1 text-xs text-muted-foreground">Режим: {policy.adIntegration.mode}</div>
                      <Separator className="my-3" />
                      <div className="text-xs font-medium text-muted-foreground">Маппинг атрибутов</div>
                      <div className="mt-2 grid gap-2 text-sm">
                        {Object.entries(policy.adIntegration.mapping).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between" data-testid={`row-ad-map-${k}`}>
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-mono text-xs">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="rights" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="text-sm font-semibold">Управление ролями пользователей</div>
                    <div className="mt-3 space-y-3" data-testid="list-users-roles">
                      {demoUsers.map((u) => (
                        <div key={u.id} className="rounded-2xl border bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold">{u.displayName}</div>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map(r => (
                                <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {["Читатель", "Автор", "Владелец", "Заместитель владельца", "Администратор"].map(role => (
                              <Button 
                                key={role}
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-[10px] rounded-md px-2"
                                onClick={() => {
                                  toast({ title: "Роль обновлена", description: `Пользователю ${u.displayName} назначена роль ${role} (демо)` });
                                }}
                              >
                                {u.roles.includes(role as any) ? `- ${role}` : `+ ${role}`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm font-semibold">Политика RBAC</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Роли назначаются только вручную администратором портала. AD-интеграция используется только для атрибутов (филиал, компания).
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Дефолтная роль</span>
                        <Badge variant="outline">Читатель</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Назначение из AD</span>
                        <Badge variant="destructive">Запрещено</Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="reports" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">KPI по актуальности</div>
                    </div>
                    <div className="mt-3 grid gap-2" data-testid="list-kpis">
                      <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3">
                        <div className="text-sm text-muted-foreground">Доля просроченных</div>
                        <div className="font-semibold" data-testid="kpi-share-overdue">
                          {(kpis.overdueShare * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3">
                        <div className="text-sm text-muted-foreground">Без владельца</div>
                        <div className="font-semibold" data-testid="kpi-count-no-owner">
                          {kpis.withoutOwnerCount}
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3">
                        <div className="text-sm text-muted-foreground">Без заместителя</div>
                        <div className="font-semibold" data-testid="kpi-count-no-deputy">
                          {kpis.withoutDeputyCount}
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3">
                        <div className="text-sm text-muted-foreground">Просрочено</div>
                        <div className="font-semibold" data-testid="kpi-count-overdue">
                          {scoped.filter(isOverdue).length}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-sm font-semibold">Распределение по критичности</div>
                    <div className="mt-3 space-y-2" data-testid="list-criticality">
                      {Object.entries(kpis.byCriticality).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3" data-testid={`row-crit-${k}`}>
                          <div className="text-sm text-muted-foreground">{k}</div>
                          <Badge variant="secondary" className="kb-chip">
                            {v}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Card className="mt-4 p-4">
                  <div className="text-sm font-semibold">Нагрузка пересмотров по владельцам</div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="list-owner-load">
                    {kpis.owners.map((o) => (
                      <div key={o.ownerId} className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3" data-testid={`row-owner-${o.ownerId}`}>
                        <div className="text-sm">{o.ownerName}</div>
                        <Badge variant="secondary" className="kb-chip">
                          {o.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">SLA по RFC и аудит действий — в полной версии бэкенда.</div>
                </Card>
              </TabsContent>

              <TabsContent value="mail" className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">Журнал email‑уведомлений</div>
                      <Badge variant="secondary" className="kb-chip" data-testid="badge-mail-count">
                        {notificationsFiltered.length}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">Напоминания, просрочки, эскалации, публикации версий.</div>
                  </div>
                  <div className="w-[320px] max-w-full">
                    <Input
                      data-testid="input-mail-search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Фильтр по теме или адресу…"
                      className="rounded-2xl"
                    />
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="grid gap-2" data-testid="list-mails">
                  {notificationsFiltered.map((n) => (
                    <Card key={n.id} className="p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold" data-testid={`text-mail-subject-${n.id}`}>
                            {n.subject}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Кому: {n.to}</div>
                        </div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-mail-at-${n.id}`}>
                          {new Date(n.at).toLocaleString("ru-RU")}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="kb-chip">
                          {n.template}
                        </Badge>
                        <Badge variant="outline" className="kb-chip">
                          {n.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  {!notificationsFiltered.length ? (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-mails">
                      Ничего не найдено.
                    </div>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
