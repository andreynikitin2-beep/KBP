import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  Mail,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Table2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import { visibilityGroups } from "@/lib/mockData";
import type { Role } from "@/lib/mockData";
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

const ALL_ROLES: Role[] = ["Читатель", "Автор", "Владелец", "Заместитель владельца", "Администратор"];

function SyncStatusBadge({ status }: { status: string }) {
  if (status === "success")
    return <Badge className="bg-green-600 text-white text-[10px]"><CheckCircle2 className="mr-1 h-3 w-3" />Успешно</Badge>;
  if (status === "error")
    return <Badge className="bg-red-600 text-white text-[10px]"><XCircle className="mr-1 h-3 w-3" />Ошибка</Badge>;
  if (status === "in_progress")
    return <Badge className="bg-yellow-500 text-white text-[10px]"><Activity className="mr-1 h-3 w-3" />В процессе</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Нет данных</Badge>;
}

export default function Admin() {
  const { toast } = useToast();
  const { me, materials, notifications, policy, users, syncADUsers, createLocalUser, deactivateUser, reactivateUser } = useKB();
  const [q, setQ] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newEntity, setNewEntity] = useState("");
  const [newRoles, setNewRoles] = useState<Role[]>(["Читатель"]);

  const scoped = useMemo(
    () => materials.filter((m) => m.passport.legalEntity === me.legalEntity),
    [materials, me],
  );

  const kpis = useMemo(() => computeKpis(scoped, users), [scoped, users]);

  const notificationsFiltered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return notifications;
    return notifications.filter((n) => (n.subject + " " + n.to).toLowerCase().includes(query));
  }, [notifications, q]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      (u.displayName + " " + u.email + " " + u.department + " " + u.legalEntity)
        .toLowerCase()
        .includes(query),
    );
  }, [users, userSearch]);

  const ad = policy.adIntegration;

  function handleSync() {
    setSyncing(true);
    setTimeout(() => {
      const res = syncADUsers();
      setSyncing(false);
      toast({
        title: res.ok ? "Синхронизация завершена" : "Ошибка синхронизации",
        description: res.message,
      });
    }, 600);
  }

  function handleCreateUser() {
    if (!newName.trim() || !newEmail.trim()) {
      toast({ title: "Ошибка", description: "Имя и email обязательны" });
      return;
    }
    const res = createLocalUser({
      displayName: newName.trim(),
      email: newEmail.trim(),
      department: newDept.trim(),
      legalEntity: newEntity.trim(),
      roles: newRoles.length ? newRoles : ["Читатель"],
    });
    if (res.ok) {
      toast({ title: "Пользователь создан", description: `${res.user?.displayName} добавлен` });
      setDlgOpen(false);
      setNewName("");
      setNewEmail("");
      setNewDept("");
      setNewEntity("");
      setNewRoles(["Читатель"]);
    } else {
      toast({ title: "Ошибка", description: res.message });
    }
  }

  function toggleRole(role: Role) {
    setNewRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  return (
    <AppShell
      title="Администрирование"
      breadcrumbs={[{ label: "Портал инструкций", href: "/" }, { label: "Администрирование" }]}
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
                  users.find((u) => u.id === m.passport.ownerId)?.displayName || "",
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
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger data-testid="tab-admin-policies" value="policies">
                  Политики
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-ad" value="ad">
                  AD / SSO
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-users" value="users">
                  Пользователи
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

              {/* ── Политики ── */}
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
                      <div className="text-sm font-semibold">RBAC по умолчанию</div>
                    </div>
                    <div className="mt-3 space-y-2" data-testid="list-rbac-defaults">
                      {Object.entries(policy.rbacDefaults).map(([key, roles]) => {
                        const labels: Record<string, string> = {
                          canPublish: "Могут публиковать",
                          canApprove: "Могут согласовывать",
                          canEditDraft: "Могут редактировать черновик",
                          canManagePolicies: "Управление политиками",
                          canViewAudit: "Просмотр аудита",
                        };
                        return (
                          <div key={key} className="rounded-2xl border bg-muted/20 p-3" data-testid={`row-rbac-${key}`}>
                            <div className="text-sm font-medium">{labels[key] || key}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(roles as string[]).map((r) => (
                                <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* ── AD / SSO ── */}
              <TabsContent value="ad" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center gap-2">
                      {ad.enabled ? <Cloud className="h-4 w-4 text-green-600" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
                      <div className="text-sm font-semibold">Конфигурация AD/SSO</div>
                    </div>
                    <div className="mt-3 space-y-3" data-testid="card-ad-config">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Статус</span>
                        {ad.enabled
                          ? <Badge className="bg-green-600 text-white text-[10px]">Включено</Badge>
                          : <Badge variant="destructive" className="text-[10px]">Выключено</Badge>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Режим</span>
                        <Badge variant="outline" className="text-[10px]">{ad.mode}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">SSO URL</span>
                        <span className="text-xs font-mono truncate max-w-[200px]" data-testid="text-sso-url">{ad.ssoUrl}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Частота синхронизации</span>
                        <span className="text-xs">Каждые {ad.syncFrequencyMinutes} минут</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Последняя синхронизация</span>
                        <span className="text-xs" data-testid="text-last-sync">
                          {ad.lastSyncAt
                            ? formatDistanceToNow(new Date(ad.lastSyncAt), { addSuffix: true, locale: ru })
                            : "Нет данных"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Статус синхронизации</span>
                        <SyncStatusBadge status={ad.syncStatus} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Синхронизировано</span>
                        <span className="text-xs" data-testid="text-synced-count">{ad.syncedUsersCount} пользователей</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Деактивировано</span>
                        <span className="text-xs" data-testid="text-deactivated-count">{ad.deactivatedCount}</span>
                      </div>

                      <Separator />
                      <div className="text-xs font-medium text-muted-foreground">Маппинг атрибутов</div>
                      <div className="grid gap-2 text-sm" data-testid="list-ad-mapping">
                        {Object.entries(ad.mapping).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between" data-testid={`row-ad-map-${k}`}>
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-mono text-xs">{v === null ? "—" : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Журнал синхронизации</div>
                      <Button
                        data-testid="button-sync-ad"
                        size="sm"
                        className="rounded-xl"
                        disabled={syncing}
                        onClick={handleSync}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                        Синхронизировать сейчас
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2" data-testid="list-sync-log">
                      {ad.syncLog.map((entry, i) => (
                        <div key={i} className="rounded-2xl border bg-muted/20 p-3" data-testid={`row-sync-log-${i}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.at), { addSuffix: true, locale: ru })}
                            </span>
                            <SyncStatusBadge status={entry.status} />
                          </div>
                          <div className="mt-1 text-sm">{entry.message}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-[10px]">Всего: {entry.usersTotal}</Badge>
                            <Badge variant="outline" className="text-[10px]">Обновлено: {entry.usersUpdated}</Badge>
                            <Badge variant="outline" className="text-[10px]">Деактивировано: {entry.usersDeactivated}</Badge>
                          </div>
                        </div>
                      ))}
                      {ad.syncLog.length === 0 && (
                        <div className="text-sm text-muted-foreground p-4 text-center">Нет записей</div>
                      )}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Пользователи ── */}
              <TabsContent value="users" className="mt-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <Input
                    data-testid="input-user-search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Поиск по имени, email, отделу…"
                    className="rounded-2xl max-w-sm"
                  />
                  <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-user" className="rounded-xl">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Создать локального пользователя
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Новый локальный пользователь</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-3 mt-2">
                        <div>
                          <Label htmlFor="new-user-name">Имя</Label>
                          <Input data-testid="input-new-user-name" id="new-user-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ФИО" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="new-user-email">Email</Label>
                          <Input data-testid="input-new-user-email" id="new-user-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@company.local" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="new-user-dept">Отдел</Label>
                          <Input data-testid="input-new-user-dept" id="new-user-dept" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Отдел" className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="new-user-entity">Юридическое лицо</Label>
                          <Input data-testid="input-new-user-entity" id="new-user-entity" value={newEntity} onChange={(e) => setNewEntity(e.target.value)} placeholder="ООО «…»" className="mt-1" />
                        </div>
                        <div>
                          <Label>Роли</Label>
                          <div className="mt-1 space-y-2">
                            {ALL_ROLES.map((role) => (
                              <div key={role} className="flex items-center gap-2">
                                <Checkbox
                                  data-testid={`checkbox-role-${role}`}
                                  id={`role-${role}`}
                                  checked={newRoles.includes(role)}
                                  onCheckedChange={() => toggleRole(role)}
                                />
                                <Label htmlFor={`role-${role}`} className="text-sm font-normal">{role}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button data-testid="button-submit-create-user" className="w-full rounded-xl mt-2" onClick={handleCreateUser}>
                          Создать
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid gap-2" data-testid="list-users">
                  {filteredUsers.map((u) => (
                    <Card key={u.id} className="p-3" data-testid={`card-user-${u.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{u.displayName}</span>
                            {u.source === "ad"
                              ? <Badge className="bg-blue-600 text-white text-[10px]">AD</Badge>
                              : <Badge className="bg-green-600 text-white text-[10px]">Локальный</Badge>}
                            {u.deactivatedAt
                              ? <Badge variant="destructive" className="text-[10px]">Деактивирован {new Date(u.deactivatedAt).toLocaleDateString("ru-RU")}</Badge>
                              : <Badge className="bg-green-600 text-white text-[10px]">Активен</Badge>}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{u.email}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {u.department} · {u.legalEntity}
                          </div>
                          {u.source === "ad" && u.adAccountName && (
                            <div className="mt-1 text-xs text-muted-foreground">AD аккаунт: <span className="font-mono">{u.adAccountName}</span></div>
                          )}
                          {u.source === "ad" && u.lastSyncAt && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Последняя синхронизация: {formatDistanceToNow(new Date(u.lastSyncAt), { addSuffix: true, locale: ru })}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          {u.deactivatedAt ? (
                            <Button
                              data-testid={`button-reactivate-${u.id}`}
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs"
                              onClick={() => {
                                const res = reactivateUser(u.id);
                                toast({ title: res.ok ? "Пользователь активирован" : "Ошибка", description: res.message });
                              }}
                            >
                              Активировать
                            </Button>
                          ) : (
                            <Button
                              data-testid={`button-deactivate-${u.id}`}
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs text-destructive"
                              onClick={() => {
                                const res = deactivateUser(u.id);
                                toast({ title: res.ok ? "Пользователь деактивирован" : "Ошибка", description: res.message });
                              }}
                            >
                              Деактивировать
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground text-center" data-testid="empty-users">
                      Пользователи не найдены
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Права ── */}
              <TabsContent value="rights" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="text-sm font-semibold">Управление ролями пользователей</div>
                    <div className="mt-3 space-y-3" data-testid="list-users-roles">
                      {users.map((u) => (
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
                            {ALL_ROLES.map(role => (
                              <Button
                                key={role}
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] rounded-md px-2"
                                onClick={() => {
                                  toast({ title: "Роль обновлена", description: `Пользователю ${u.displayName} назначена роль ${role} (демо)` });
                                }}
                              >
                                {u.roles.includes(role) ? `- ${role}` : `+ ${role}`}
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
                      Роли назначаются только вручную администратором портала. AD-интеграция используется только для атрибутов (компания).
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

              {/* ── Группы ── */}
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

              {/* ── Отчёты ── */}
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

              {/* ── Email-журнал ── */}
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
