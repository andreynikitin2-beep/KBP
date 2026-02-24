import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  Edit2,
  FileText,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Table2,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import type { Criticality, NewHireProfile, Role } from "@/lib/mockData";
import type { RbacDefaults, ReviewPeriod } from "@/lib/kbStore";
import { computeKpis, isOverdue, canViewMaterial } from "@/lib/kbLogic";

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

const RBAC_LABELS: Record<keyof RbacDefaults, string> = {
  canPublish: "Могут публиковать",
  canApprove: "Могут согласовывать",
  canEditDraft: "Могут редактировать черновик",
  canManagePolicies: "Управление политиками",
  canViewAudit: "Просмотр аудита",
};

const CRITICALITY_COLORS: Record<string, string> = {
  "Критическая": "border-red-300 bg-red-50",
  "Высокая": "border-orange-300 bg-orange-50",
  "Средняя": "border-yellow-300 bg-yellow-50",
  "Низкая": "border-blue-300 bg-blue-50",
};

function PoliciesTab() {
  const { toast } = useToast();
  const { policy, updateReviewPeriod, updateRbacDefaults } = useKB();

  const [editingPeriod, setEditingPeriod] = useState<Criticality | null>(null);
  const [editDays, setEditDays] = useState(0);
  const [editRemind, setEditRemind] = useState("");
  const [editEscalation, setEditEscalation] = useState("");

  const [editingRbac, setEditingRbac] = useState<keyof RbacDefaults | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const startEditPeriod = (p: ReviewPeriod) => {
    setEditingPeriod(p.criticality);
    setEditDays(p.days);
    setEditRemind(p.remindBeforeDays.join(", "));
    setEditEscalation(p.escalationAfterDays.join(", "));
  };

  const savePeriod = () => {
    if (!editingPeriod) return;
    const parseDays = (s: string) =>
      s.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    const remind = parseDays(editRemind);
    const escalation = parseDays(editEscalation);
    if (editDays < 1) {
      toast({ title: "Ошибка", description: "Период должен быть больше 0 дней", variant: "destructive" });
      return;
    }
    if (remind.length === 0) {
      toast({ title: "Ошибка", description: "Укажите хотя бы один день напоминания", variant: "destructive" });
      return;
    }
    const res = updateReviewPeriod(editingPeriod, {
      days: editDays,
      remindBeforeDays: remind.sort((a, b) => b - a),
      escalationAfterDays: escalation.sort((a, b) => a - b),
    });
    if (res.ok) {
      toast({ title: "Сохранено", description: `Период для «${editingPeriod}» обновлён` });
      setEditingPeriod(null);
    }
  };

  const startEditRbac = (key: keyof RbacDefaults) => {
    setEditingRbac(key);
    setEditRoles([...policy.rbacDefaults[key]]);
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const saveRbac = () => {
    if (!editingRbac) return;
    const res = updateRbacDefaults(editingRbac, editRoles);
    if (res.ok) {
      toast({ title: "Сохранено", description: `Роли для «${RBAC_LABELS[editingRbac]}» обновлены` });
      setEditingRbac(null);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold">Периоды пересмотра по критичности</div>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          Определяют, через сколько дней материал нужно пересмотреть в зависимости от уровня критичности.
        </div>
        <div className="space-y-2" data-testid="list-review-periods">
          {policy.reviewPeriods.map((p) => (
            <div
              key={p.criticality}
              className={`rounded-2xl border p-3 ${CRITICALITY_COLORS[p.criticality] || "bg-muted/20"}`}
              data-testid={`row-policy-${p.criticality}`}
            >
              {editingPeriod === p.criticality ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{p.criticality}</div>
                    <div className="flex gap-1">
                      <Button data-testid={`button-save-period-${p.criticality}`} variant="ghost" size="icon" className="h-7 w-7" onClick={savePeriod}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPeriod(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Период пересмотра (дней)</Label>
                    <Input
                      data-testid={`input-days-${p.criticality}`}
                      type="number"
                      min={1}
                      value={editDays}
                      onChange={(e) => setEditDays(parseInt(e.target.value, 10) || 0)}
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Напомнить за (дней, через запятую)</Label>
                    <Input
                      data-testid={`input-remind-${p.criticality}`}
                      value={editRemind}
                      onChange={(e) => setEditRemind(e.target.value)}
                      placeholder="14, 7, 1"
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Эскалация через (дней после просрочки, через запятую)</Label>
                    <Input
                      data-testid={`input-escalation-${p.criticality}`}
                      value={editEscalation}
                      onChange={(e) => setEditEscalation(e.target.value)}
                      placeholder="3, 7"
                      className="mt-1 h-8"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{p.criticality}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="kb-chip">{p.days} дн.</Badge>
                      <Button
                        data-testid={`button-edit-period-${p.criticality}`}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditPeriod(p)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Напомнить за: {p.remindBeforeDays.join(", ")} дн. · Эскалация через: {p.escalationAfterDays.join(", ")} дн.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold">RBAC по умолчанию</div>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          Роли, которым по умолчанию разрешены определённые действия в системе.
        </div>
        <div className="space-y-2" data-testid="list-rbac-defaults">
          {(Object.entries(policy.rbacDefaults) as [keyof RbacDefaults, string[]][]).filter(([key]) => !key.startsWith('_id_')).map(([key, roles]) => (
            <div key={key} className="rounded-2xl border bg-muted/20 p-3" data-testid={`row-rbac-${key}`}>
              {editingRbac === key ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{RBAC_LABELS[key]}</div>
                    <div className="flex gap-1">
                      <Button data-testid={`button-save-rbac-${key}`} variant="ghost" size="icon" className="h-7 w-7" onClick={saveRbac}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRbac(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/50">
                        <Checkbox
                          data-testid={`checkbox-rbac-${key}-${role}`}
                          checked={editRoles.includes(role)}
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <span className="text-sm">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{RBAC_LABELS[key]}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    data-testid={`button-edit-rbac-${key}`}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => startEditRbac(key)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NewHiresTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const {
    newHiresEnabled, setNewHiresEnabled,
    newHireProfiles, newHireAssignments,
    detectNewHires, assignMaterialsToNewHire, assignMaterialsToAllNewHires, updateNewHireStatus,
    users, materials, visibilityGroups, getAllVersions,
  } = useKB();

  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    return format(new Date(iso), "dd.MM.yyyy HH:mm", { locale: ru });
  };

  const handleDetect = async () => {
    const res = await detectNewHires();
    toast({ title: "Поиск завершён", description: `Обнаружено новых сотрудников: ${res.added}` });
  };

  const handleAssignAll = async () => {
    const res = await assignMaterialsToAllNewHires();
    toast({ title: "Задания выданы", description: `Назначено заданий: ${res.assigned}` });
  };

  const handleAssignOne = async (userId: string) => {
    const res = await assignMaterialsToNewHire(userId);
    toast({ title: "Задания выданы", description: `Назначено заданий: ${res.assigned}` });
  };

  const handleComplete = (profileId: string) => {
    updateNewHireStatus(profileId, "Завершено");
    toast({ title: "Завершено", description: "Статус сотрудника обновлён" });
  };

  const statusBadge = (status: string) => {
    if (status === "Новый") return <Badge className="bg-blue-600 text-white text-[10px]">{status}</Badge>;
    if (status === "Задания выданы") return <Badge className="bg-yellow-500 text-white text-[10px]">{status}</Badge>;
    if (status === "Завершено") return <Badge className="bg-green-600 text-white text-[10px]">{status}</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="newhires-enabled" className="text-sm font-semibold cursor-pointer">
              Включить модуль адаптации новых сотрудников
            </Label>
          </div>
          <Switch
            id="newhires-enabled"
            data-testid="switch-newhires-enabled"
            checked={newHiresEnabled}
            onCheckedChange={setNewHiresEnabled}
          />
        </div>
      </Card>

      {newHiresEnabled && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="btn-detect-newhires" variant="outline" className="rounded-xl" onClick={handleDetect}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Обнаружить новых
            </Button>
            <Button data-testid="btn-assign-all-newhires" variant="outline" className="rounded-xl" onClick={handleAssignAll}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Выдать задания всем новым
            </Button>
          </div>

          {newHireProfiles.length > 0 ? (
            <Card className="p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Сотрудник</th>
                    <th className="pb-2 pr-4">Источник</th>
                    <th className="pb-2 pr-4">Статус</th>
                    <th className="pb-2 pr-4">Прогресс</th>
                    <th className="pb-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {newHireProfiles.map((profile) => {
                    const user = users.find((u) => u.id === profile.userId);
                    const userAssignments = newHireAssignments.filter((a) => a.userId === profile.userId);
                    const acknowledged = userAssignments.filter((a) => a.acknowledgedAt).length;
                    const total = userAssignments.length;
                    const allAcknowledged = total > 0 && acknowledged === total;
                    const isExpanded = expandedProfileId === profile.id;
                    const canExpand = profile.status === "Задания выданы" || profile.status === "Завершено";

                    return (
                      <React.Fragment key={profile.id}>
                        <tr
                          className={`border-b last:border-0 ${canExpand ? "cursor-pointer hover:bg-muted/30" : ""}`}
                          data-testid={`row-newhire-${profile.id}`}
                          onClick={() => canExpand && setExpandedProfileId(isExpanded ? null : profile.id)}
                        >
                          <td className="py-2 pr-4">{user?.displayName ?? "—"}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary" className="text-[10px]">{profile.source}</Badge>
                          </td>
                          <td className="py-2 pr-4">{statusBadge(profile.status)}</td>
                          <td className="py-2 pr-4">{acknowledged} / {total}</td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              {profile.status === "Новый" && (
                                <Button
                                  data-testid={`btn-assign-newhire-${profile.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleAssignOne(profile.userId); }}
                                >
                                  Выдать задания
                                </Button>
                              )}
                              {profile.status === "Задания выданы" && allAcknowledged && (
                                <Button
                                  data-testid={`btn-complete-newhire-${profile.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs"
                                  onClick={(e) => { e.stopPropagation(); handleComplete(profile.id); }}
                                >
                                  Завершить
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && canExpand && (
                          <tr data-testid={`row-newhire-expanded-${profile.id}`}>
                            <td colSpan={5} className="px-2 pb-3 pt-1">
                              <div className="rounded-xl border bg-muted/10 p-3">
                                <div className="mb-2 text-xs font-semibold text-muted-foreground">Назначенные материалы</div>
                                <div className="grid gap-1.5">
                                  {userAssignments.map((assignment) => {
                                    const mat = materials.find(m => m.materialId === assignment.materialId);
                                    const matTitle = mat?.passport.title || assignment.materialId;
                                    const isAck = !!assignment.acknowledgedAt;
                                    const assignedUser = user;
                                    const hasAccess = assignedUser && mat
                                      ? canViewMaterial(assignedUser, mat, visibilityGroups)
                                      : false;

                                    const ackVersion = assignment.acknowledgedVersionId
                                      ? getAllVersions(assignment.materialId).find(v => v.id === assignment.acknowledgedVersionId)
                                      : null;
                                    const ackVersionLabel = ackVersion ? ackVersion.version : null;

                                    let bgClass: string;
                                    let statusLabel: string;
                                    if (isAck) {
                                      bgClass = "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
                                      statusLabel = "Ознакомлен";
                                    } else if (hasAccess) {
                                      bgClass = "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
                                      statusLabel = "Не ознакомлен";
                                    } else {
                                      bgClass = "bg-gray-100 border-gray-200 dark:bg-gray-800/40 dark:border-gray-700";
                                      statusLabel = "Нет доступа сейчас";
                                    }

                                    return (
                                      <div
                                        key={assignment.id}
                                        className={`rounded-xl border px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity ${bgClass}`}
                                        data-testid={`row-newhire-material-${assignment.id}`}
                                        onClick={() => navigate(`/materials/${assignment.materialId}`)}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="text-sm font-medium">{matTitle}</div>
                                          <Badge
                                            variant="secondary"
                                            className={`text-[10px] ${
                                              isAck
                                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                : hasAccess
                                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                            }`}
                                            data-testid={`badge-newhire-material-status-${assignment.id}`}
                                          >
                                            {statusLabel}
                                          </Badge>
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                          {ackVersionLabel && (
                                            <span data-testid={`text-ack-version-${assignment.id}`}>Версия: {ackVersionLabel}</span>
                                          )}
                                          <span>Назначен: {fmtDate(assignment.assignedAt)}</span>
                                          <span>Ознакомлен: {isAck ? fmtDate(assignment.acknowledgedAt) : "—"}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="text-sm text-muted-foreground text-center" data-testid="empty-newhires">
                Нет новых сотрудников. Нажмите «Обнаружить новых» для поиска.
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const { me, materials, notifications, policy, users, syncADUsers, updateAdConfig, createLocalUser, deactivateUser, reactivateUser, updateReviewPeriod, updateRbacDefaults, updateUser, createGroup, updateGroup, deleteGroup, visibilityGroups, catalogNodes, updateCatalogNode, addSection, renameSection, deleteSection, addSubsection, renameSubsection, deleteSubsection, emailConfig, emailTemplates, updateEmailConfig, updateEmailTemplate } = useKB();
  const [q, setQ] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newEntity, setNewEntity] = useState("");
  const [newPassword, setNewPassword] = useState("1");
  const [newRoles, setNewRoles] = useState<Role[]>(["Читатель"]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserDept, setEditUserDept] = useState("");
  const [editUserEntity, setEditUserEntity] = useState("");
  const [editUserRoles, setEditUserRoles] = useState<Role[]>([]);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [editGroupMembers, setEditGroupMembers] = useState<string[]>([]);

  const [grpDlgOpen, setGrpDlgOpen] = useState(false);
  const [grpTitle, setGrpTitle] = useState("");
  const [grpMembers, setGrpMembers] = useState<string[]>([]);

  const [adEditing, setAdEditing] = useState(false);
  const [adEnabled, setAdEnabled] = useState(false);
  const [adMode, setAdMode] = useState<"demo" | "SAML" | "OIDC" | "LDAP">("SAML");
  const [adSsoUrl, setAdSsoUrl] = useState("");
  const [adSyncFreq, setAdSyncFreq] = useState(60);
  const [adMapDepartment, setAdMapDepartment] = useState("");
  const [adMapLegalEntity, setAdMapLegalEntity] = useState("");
  const [adMapDisplayName, setAdMapDisplayName] = useState("");
  const [adMapEmail, setAdMapEmail] = useState("");

  const [emailEditing, setEmailEditing] = useState(false);
  const [emSenderAddress, setEmSenderAddress] = useState("");
  const [emSenderName, setEmSenderName] = useState("");
  const [emSmtpHost, setEmSmtpHost] = useState("");
  const [emSmtpPort, setEmSmtpPort] = useState(587);
  const [emSmtpUser, setEmSmtpUser] = useState("");
  const [emSmtpPassword, setEmSmtpPassword] = useState("");
  const [emSmtpUseTls, setEmSmtpUseTls] = useState(true);
  const [emEnabled, setEmEnabled] = useState(true);

  const [editingTplKey, setEditingTplKey] = useState<string | null>(null);
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");

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

  const activeUsers = useMemo(() => users.filter((u) => !u.deactivatedAt), [users]);

  const ad = policy.adIntegration;

  function startEditAd() {
    setAdEditing(true);
    setAdEnabled(ad.enabled);
    setAdMode(ad.mode);
    setAdSsoUrl(ad.ssoUrl);
    setAdSyncFreq(ad.syncFrequencyMinutes);
    setAdMapDepartment(ad.mapping.department || "");
    setAdMapLegalEntity(ad.mapping.legalEntity || "");
    setAdMapDisplayName(ad.mapping.displayName || "");
    setAdMapEmail(ad.mapping.email || "");
  }

  function saveAdConfig() {
    const res = updateAdConfig({
      enabled: adEnabled,
      mode: adMode,
      ssoUrl: adSsoUrl.trim(),
      syncFrequencyMinutes: adSyncFreq,
      mapping: {
        roles: ad.mapping.roles,
        department: adMapDepartment.trim() || null as any,
        legalEntity: adMapLegalEntity.trim() || null as any,
        displayName: adMapDisplayName.trim() || null as any,
        email: adMapEmail.trim() || null as any,
      },
    });
    if (res.ok) {
      toast({ title: "Сохранено", description: "Конфигурация AD/SSO обновлена" });
      setAdEditing(false);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  function startEditEmail() {
    setEmailEditing(true);
    setEmSenderAddress(emailConfig.senderAddress);
    setEmSenderName(emailConfig.senderName);
    setEmSmtpHost(emailConfig.smtpHost);
    setEmSmtpPort(emailConfig.smtpPort);
    setEmSmtpUser(emailConfig.smtpUser);
    setEmSmtpPassword(emailConfig.smtpPassword);
    setEmSmtpUseTls(emailConfig.smtpUseTls);
    setEmEnabled(emailConfig.enabled);
  }

  function saveEmailConfig() {
    if (!emSenderAddress.trim()) {
      toast({ title: "Ошибка", description: "Адрес отправителя обязателен", variant: "destructive" });
      return;
    }
    updateEmailConfig({
      senderAddress: emSenderAddress.trim(),
      senderName: emSenderName.trim(),
      smtpHost: emSmtpHost.trim(),
      smtpPort: emSmtpPort,
      smtpUser: emSmtpUser.trim(),
      smtpPassword: emSmtpPassword,
      smtpUseTls: emSmtpUseTls,
      enabled: emEnabled,
    });
    toast({ title: "Сохранено", description: "Настройки почты обновлены" });
    setEmailEditing(false);
  }

  function startEditTemplate(key: string) {
    const tpl = emailTemplates.find((t) => t.key === key);
    if (!tpl) return;
    setEditingTplKey(key);
    setTplSubject(tpl.subject);
    setTplBody(tpl.body);
  }

  function saveTemplate() {
    if (!editingTplKey) return;
    const res = updateEmailTemplate(editingTplKey, { subject: tplSubject, body: tplBody });
    if (res.ok) {
      toast({ title: "Сохранено", description: "Шаблон обновлён" });
      setEditingTplKey(null);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

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
      password: newPassword || "1",
    });
    if (res.ok) {
      toast({ title: "Пользователь создан", description: `${res.user?.displayName} добавлен` });
      setDlgOpen(false);
      setNewName("");
      setNewEmail("");
      setNewDept("");
      setNewEntity("");
      setNewPassword("1");
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

  function startEditUser(u: typeof users[0]) {
    setEditingUserId(u.id);
    setEditUserName(u.displayName);
    setEditUserEmail(u.email);
    setEditUserDept(u.department);
    setEditUserEntity(u.legalEntity);
    setEditUserRoles([...u.roles]);
  }

  function toggleEditUserRole(role: Role) {
    setEditUserRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function saveEditUser() {
    if (!editingUserId) return;
    const roles = editUserRoles.length > 0 ? editUserRoles : (["Читатель"] as Role[]);
    const res = updateUser(editingUserId, {
      displayName: editUserName.trim(),
      email: editUserEmail.trim(),
      department: editUserDept.trim(),
      legalEntity: editUserEntity.trim(),
      roles,
    });
    if (res.ok) {
      toast({ title: "Сохранено", description: "Данные пользователя обновлены" });
      setEditingUserId(null);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  function startEditGroup(g: typeof visibilityGroups[0]) {
    setEditingGroupId(g.id);
    setEditGroupTitle(g.title);
    setEditGroupMembers([...g.memberIds]);
  }

  function saveEditGroup() {
    if (!editingGroupId) return;
    const res = updateGroup(editingGroupId, {
      title: editGroupTitle.trim(),
      memberIds: editGroupMembers,
    });
    if (res.ok) {
      toast({ title: "Сохранено", description: "Группа обновлена" });
      setEditingGroupId(null);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  function handleDeleteGroup(groupId: string, title: string) {
    if (!window.confirm(`Вы уверены, что хотите удалить группу «${title}»?`)) return;
    const res = deleteGroup(groupId);
    if (res.ok) {
      toast({ title: "Удалено", description: `Группа «${title}» удалена` });
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  function handleCreateGroup() {
    if (!grpTitle.trim()) {
      toast({ title: "Ошибка", description: "Название группы обязательно" });
      return;
    }
    const res = createGroup({ title: grpTitle.trim(), memberIds: grpMembers });
    if (res.ok) {
      toast({ title: "Группа создана", description: `«${res.group?.title}» добавлена` });
      setGrpDlgOpen(false);
      setGrpTitle("");
      setGrpMembers([]);
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  return (
    <AppShell
      title="Администрирование"
      breadcrumbs={[{ label: "Портал инструкций", href: "/" }, { label: "Администрирование" }]}
      search={q}
      onSearch={setQ}
      actions={
        me.roles.includes("Администратор") ? (
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
        ) : null
      }
    >
      <div className="grid gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Администрирование</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Политики, интеграции, пользователи, группы видимости, отчёты и журнал уведомлений.
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
                <TabsTrigger data-testid="tab-admin-groups" value="groups">
                  Группы
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-reports" value="reports">
                  Отчёты
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-mail" value="mail">
                  Email‑журнал
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-newhires" value="newhires">
                  Новые сотрудники
                </TabsTrigger>
              </TabsList>

              {/* ── Политики ── */}
              <TabsContent value="policies" className="mt-4">
                <PoliciesTab />
              </TabsContent>

              {/* ── AD / SSO ── */}
              <TabsContent value="ad" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ad.enabled ? <Cloud className="h-4 w-4 text-green-600" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
                        <div className="text-sm font-semibold">Конфигурация AD/SSO</div>
                      </div>
                      {!adEditing ? (
                        <Button data-testid="button-edit-ad" size="sm" variant="outline" className="rounded-xl" onClick={startEditAd}>
                          <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                          Редактировать
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button data-testid="button-save-ad" size="sm" className="rounded-xl" onClick={saveAdConfig}>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Сохранить
                          </Button>
                          <Button data-testid="button-cancel-ad" size="sm" variant="outline" className="rounded-xl" onClick={() => setAdEditing(false)}>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Отмена
                          </Button>
                        </div>
                      )}
                    </div>

                    {adEditing ? (
                      <div className="mt-4 space-y-4" data-testid="card-ad-config-edit">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="ad-enabled">Интеграция включена</Label>
                          <Switch
                            id="ad-enabled"
                            data-testid="switch-ad-enabled"
                            checked={adEnabled}
                            onCheckedChange={setAdEnabled}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Протокол</Label>
                          <Select value={adMode} onValueChange={(v) => setAdMode(v as typeof adMode)}>
                            <SelectTrigger data-testid="select-ad-mode" className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SAML">SAML 2.0</SelectItem>
                              <SelectItem value="OIDC">OpenID Connect (OIDC)</SelectItem>
                              <SelectItem value="LDAP">LDAP / Active Directory</SelectItem>
                              <SelectItem value="demo">Демо-режим</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="ad-sso-url">
                            {adMode === "LDAP" ? "LDAP URL" : adMode === "OIDC" ? "Issuer URL" : "SSO URL (IdP)"}
                          </Label>
                          <Input
                            id="ad-sso-url"
                            data-testid="input-ad-sso-url"
                            value={adSsoUrl}
                            onChange={(e) => setAdSsoUrl(e.target.value)}
                            placeholder={adMode === "LDAP" ? "ldap://dc.example.com:389" : "https://sso.example.com/saml2"}
                            className="rounded-xl font-mono text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="ad-sync-freq">Частота синхронизации (минуты)</Label>
                          <Input
                            id="ad-sync-freq"
                            data-testid="input-ad-sync-freq"
                            type="number"
                            min={5}
                            max={1440}
                            value={adSyncFreq}
                            onChange={(e) => setAdSyncFreq(Number(e.target.value))}
                            className="rounded-xl w-32"
                          />
                        </div>

                        <Separator />
                        <div className="text-xs font-medium text-muted-foreground">Маппинг атрибутов AD → Портал</div>
                        <div className="grid gap-3">
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-sm text-muted-foreground">displayName →</Label>
                            <Input data-testid="input-ad-map-displayName" value={adMapDisplayName} onChange={(e) => setAdMapDisplayName(e.target.value)} placeholder="displayName" className="rounded-xl text-sm h-8" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-sm text-muted-foreground">email →</Label>
                            <Input data-testid="input-ad-map-email" value={adMapEmail} onChange={(e) => setAdMapEmail(e.target.value)} placeholder="mail" className="rounded-xl text-sm h-8" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-sm text-muted-foreground">department →</Label>
                            <Input data-testid="input-ad-map-department" value={adMapDepartment} onChange={(e) => setAdMapDepartment(e.target.value)} placeholder="department" className="rounded-xl text-sm h-8" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-sm text-muted-foreground">legalEntity →</Label>
                            <Input data-testid="input-ad-map-legalEntity" value={adMapLegalEntity} onChange={(e) => setAdMapLegalEntity(e.target.value)} placeholder="company" className="rounded-xl text-sm h-8" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3" data-testid="card-ad-config">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Статус</span>
                          {ad.enabled
                            ? <Badge className="bg-green-600 text-white text-[10px]">Включено</Badge>
                            : <Badge variant="destructive" className="text-[10px]">Выключено</Badge>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Протокол</span>
                          <Badge variant="outline" className="text-[10px]">{ad.mode}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{ad.mode === "LDAP" ? "LDAP URL" : "SSO URL"}</span>
                          <span className="text-xs font-mono truncate max-w-[240px]" data-testid="text-sso-url">{ad.ssoUrl || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Частота синхронизации</span>
                          <span className="text-xs">Каждые {ad.syncFrequencyMinutes} мин.</span>
                        </div>

                        <Separator />

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
                    )}
                  </Card>

                  <div className="space-y-4">
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Синхронизация</div>
                        <Button
                          data-testid="button-sync-ad"
                          size="sm"
                          className="rounded-xl"
                          disabled={syncing || !ad.enabled}
                          onClick={handleSync}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                          Синхронизировать сейчас
                        </Button>
                      </div>
                      {!ad.enabled && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Включите интеграцию AD/SSO для выполнения синхронизации.
                        </div>
                      )}
                    </Card>

                    <Card className="p-4">
                      <div className="text-sm font-semibold mb-3">Журнал синхронизации</div>
                      <div className="space-y-2" data-testid="list-sync-log">
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
                </div>
              </TabsContent>

              {/* ── Пользователи (merged with Права) ── */}
              <TabsContent value="users" className="mt-4">
                <div className="grid gap-4 md:grid-cols-[1fr_300px]">
                  <div>
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
                              <Label htmlFor="new-user-password">Пароль</Label>
                              <Input data-testid="input-new-user-password" id="new-user-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Пароль для входа" className="mt-1" />
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
                          {editingUserId === u.id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold">Редактирование: {u.displayName}</div>
                                <div className="flex gap-1">
                                  <Button data-testid={`button-save-user-${u.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditUser}>
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingUserId(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <Label className="text-xs">Имя</Label>
                                  <Input data-testid={`input-edit-name-${u.id}`} value={editUserName} onChange={(e) => setEditUserName(e.target.value)} className="mt-1 h-8" />
                                </div>
                                <div>
                                  <Label className="text-xs">Email</Label>
                                  <Input data-testid={`input-edit-email-${u.id}`} value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} className="mt-1 h-8" />
                                </div>
                                <div>
                                  <Label className="text-xs">Отдел</Label>
                                  <Input data-testid={`input-edit-dept-${u.id}`} value={editUserDept} onChange={(e) => setEditUserDept(e.target.value)} className="mt-1 h-8" />
                                </div>
                                <div>
                                  <Label className="text-xs">Юридическое лицо</Label>
                                  <Input data-testid={`input-edit-entity-${u.id}`} value={editUserEntity} onChange={(e) => setEditUserEntity(e.target.value)} className="mt-1 h-8" />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Роли</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {ALL_ROLES.map((role) => (
                                    <label key={role} className="flex items-center gap-1.5 cursor-pointer text-xs p-1 rounded hover:bg-muted/50">
                                      <Checkbox
                                        data-testid={`checkbox-edit-role-${u.id}-${role}`}
                                        checked={editUserRoles.includes(role)}
                                        onCheckedChange={() => toggleEditUserRole(role)}
                                      />
                                      {role}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
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
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`button-edit-user-${u.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs"
                                  onClick={() => startEditUser(u)}
                                >
                                  <Edit2 className="mr-1 h-3 w-3" />
                                  Изменить
                                </Button>
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
                          )}
                        </Card>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground text-center" data-testid="empty-users">
                          Пользователи не найдены
                        </div>
                      )}
                    </div>
                  </div>

                  <Card className="p-4 h-fit">
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
                <div className="grid gap-4 md:grid-cols-[1fr_300px]">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="text-sm font-semibold">Группы видимости</div>
                      <Dialog open={grpDlgOpen} onOpenChange={setGrpDlgOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-create-group" className="rounded-xl" variant="outline">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Создать группу
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Новая группа видимости</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-3 mt-2">
                            <div>
                              <Label htmlFor="grp-title">Название</Label>
                              <Input data-testid="input-grp-title" id="grp-title" value={grpTitle} onChange={(e) => setGrpTitle(e.target.value)} placeholder="Название группы" className="mt-1" />
                            </div>
                            <div>
                              <Label>Участники ({grpMembers.length} выбрано)</Label>
                              <div className="mt-1 max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                                {activeUsers.map((u) => (
                                  <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/50">
                                    <Checkbox
                                      data-testid={`checkbox-grp-member-${u.id}`}
                                      checked={grpMembers.includes(u.id)}
                                      onCheckedChange={() =>
                                        setGrpMembers((prev) =>
                                          prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                                        )
                                      }
                                    />
                                    <span className="text-sm">{u.displayName}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <Button data-testid="button-submit-create-group" className="w-full rounded-xl mt-2" onClick={handleCreateGroup}>
                              Создать
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-3" data-testid="list-groups">
                      {visibilityGroups.map((g) => (
                        <Card key={g.id} className="p-3" data-testid={`card-group-${g.id}`}>
                          {editingGroupId === g.id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold">Редактирование: {g.title}</div>
                                <div className="flex gap-1">
                                  <Button data-testid={`button-save-group-${g.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditGroup}>
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGroupId(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Название</Label>
                                <Input data-testid={`input-edit-group-title-${g.id}`} value={editGroupTitle} onChange={(e) => setEditGroupTitle(e.target.value)} className="mt-1 h-8" />
                              </div>
                              <div>
                                <Label className="text-xs">Участники ({editGroupMembers.length} выбрано)</Label>
                                <div className="mt-1 max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                                  {activeUsers.map((u) => (
                                    <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/50">
                                      <Checkbox
                                        data-testid={`checkbox-edit-grp-member-${g.id}-${u.id}`}
                                        checked={editGroupMembers.includes(u.id)}
                                        onCheckedChange={() =>
                                          setEditGroupMembers((prev) =>
                                            prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                                          )
                                        }
                                      />
                                      <span className="text-sm">{u.displayName}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-bold text-sm">{g.title}</span>
                                  {g.isSystem && <Badge variant="secondary" className="text-[10px]">Системная</Badge>}
                                </div>
                                <Badge variant="outline" className="text-[10px]">{g.memberIds.length} уч.</Badge>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {g.memberIds
                                  .map((id) => users.find((u) => u.id === id)?.displayName)
                                  .filter(Boolean)
                                  .join(", ") || "Нет участников"}
                              </div>
                              {g.isSystem ? (
                                <div className="mt-2 text-xs text-muted-foreground italic">Системная — нельзя изменить</div>
                              ) : (
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    data-testid={`button-edit-group-${g.id}`}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] rounded-lg"
                                    onClick={() => startEditGroup(g)}
                                  >
                                    <Edit2 className="mr-1 h-3 w-3" />
                                    Изменить
                                  </Button>
                                  <Button
                                    data-testid={`button-delete-group-${g.id}`}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[10px] rounded-lg text-destructive"
                                    onClick={() => handleDeleteGroup(g.id, g.title)}
                                  >
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    Удалить
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Card className="p-4 h-fit">
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

                <Card className="p-4 mt-4 md:col-span-full">
                  <div className="text-sm font-semibold mb-3">Структура каталога и группы по умолчанию</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Управляйте разделами и подразделами каталога. При создании материала группа видимости проставляется из дефолта подраздела.
                  </div>
                  <div className="space-y-4">
                    {catalogNodes.filter(n => n.type === "section").map(section => {
                      const subs = catalogNodes.filter(n => n.type === "subsection" && n.parentId === section.id);
                      return (
                        <div key={section.id} className="rounded-2xl border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-bold">{section.title}</span>
                              <Badge variant="secondary" className="text-[10px]">{subs.length} подразд.</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                data-testid={`button-admin-add-sub-${section.id}`}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] rounded-lg"
                                onClick={() => {
                                  const title = prompt("Название нового подраздела:");
                                  if (title?.trim()) {
                                    const res = addSubsection(section.id, title.trim());
                                    toast({
                                      title: res.ok ? "Подраздел создан" : "Ошибка",
                                      description: res.ok ? title.trim() : res.message,
                                      variant: res.ok ? "default" : "destructive",
                                    });
                                  }
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Подраздел
                              </Button>
                              <Button
                                data-testid={`button-admin-rename-section-${section.id}`}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] rounded-lg"
                                onClick={() => {
                                  const title = prompt("Новое название раздела:", section.title);
                                  if (title?.trim() && title.trim() !== section.title) {
                                    const res = renameSection(section.id, title.trim());
                                    toast({
                                      title: res.ok ? "Переименовано" : "Ошибка",
                                      description: res.ok ? title.trim() : res.message,
                                      variant: res.ok ? "default" : "destructive",
                                    });
                                  }
                                }}
                              >
                                <Edit2 className="mr-1 h-3 w-3" />
                              </Button>
                              <Button
                                data-testid={`button-admin-delete-section-${section.id}`}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] rounded-lg text-destructive"
                                onClick={() => {
                                  const res = deleteSection(section.id);
                                  toast({
                                    title: res.ok ? "Раздел удалён" : "Ошибка",
                                    description: res.ok ? section.title : res.message,
                                    variant: res.ok ? "default" : "destructive",
                                  });
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {subs.length > 0 && (
                            <div className="mt-2 space-y-1.5 ml-6">
                              {subs.map(sub => (
                                <div key={sub.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/10">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{sub.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {(sub.defaultVisibilityGroupIds || []).length === 0
                                        ? "Нет дефолтной группы"
                                        : (sub.defaultVisibilityGroupIds || []).map(gId => visibilityGroups.find(g => g.id === gId)?.title || gId).join(", ")}
                                    </div>
                                  </div>
                                  <Select
                                    value={(sub.defaultVisibilityGroupIds || [])[0] || "none"}
                                    onValueChange={(v) => {
                                      updateCatalogNode(sub.id, {
                                        defaultVisibilityGroupIds: v === "none" ? undefined : [v],
                                      });
                                      toast({ title: "Сохранено", description: `Дефолтная группа подраздела «${sub.title}» обновлена` });
                                    }}
                                  >
                                    <SelectTrigger className="w-44 rounded-xl" data-testid={`select-default-group-${sub.id}`}>
                                      <SelectValue placeholder="Не задана" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Не задана</SelectItem>
                                      {visibilityGroups.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex gap-1">
                                    <Button
                                      data-testid={`button-admin-rename-sub-${sub.id}`}
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      title="Переименовать"
                                      onClick={() => {
                                        const title = prompt("Новое название подраздела:", sub.title);
                                        if (title?.trim() && title.trim() !== sub.title) {
                                          const res = renameSubsection(sub.id, title.trim());
                                          toast({
                                            title: res.ok ? "Переименовано" : "Ошибка",
                                            description: res.ok ? title.trim() : res.message,
                                            variant: res.ok ? "default" : "destructive",
                                          });
                                        }
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      data-testid={`button-admin-delete-sub-${sub.id}`}
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      title="Удалить"
                                      onClick={() => {
                                        const res = deleteSubsection(sub.id);
                                        toast({
                                          title: res.ok ? "Подраздел удалён" : "Ошибка",
                                          description: res.ok ? sub.title : res.message,
                                          variant: res.ok ? "default" : "destructive",
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {subs.length === 0 && (
                            <div className="mt-2 ml-6 text-xs text-muted-foreground italic">Нет подразделов</div>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      data-testid="button-admin-add-section"
                      variant="outline"
                      className="rounded-xl w-full"
                      onClick={() => {
                        const title = prompt("Название нового раздела:");
                        if (title?.trim()) {
                          const res = addSection(title.trim());
                          toast({
                            title: res.ok ? "Раздел создан" : "Ошибка",
                            description: res.ok ? title.trim() : res.message,
                            variant: res.ok ? "default" : "destructive",
                          });
                        }
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить раздел
                    </Button>
                  </div>
                </Card>
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
                <div className="space-y-6">

                  {/* ── Email Config ── */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-semibold">Настройки почтовой рассылки</div>
                        {emailConfig.enabled
                          ? <Badge className="bg-green-600 text-white text-[10px]">Активна</Badge>
                          : <Badge variant="destructive" className="text-[10px]">Отключена</Badge>}
                      </div>
                      {!emailEditing ? (
                        <Button data-testid="button-edit-email-config" size="sm" variant="outline" className="rounded-xl" onClick={startEditEmail}>
                          <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                          Редактировать
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button data-testid="button-save-email-config" size="sm" className="rounded-xl" onClick={saveEmailConfig}>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Сохранить
                          </Button>
                          <Button data-testid="button-cancel-email-config" size="sm" variant="outline" className="rounded-xl" onClick={() => setEmailEditing(false)}>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Отмена
                          </Button>
                        </div>
                      )}
                    </div>

                    {emailEditing ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2" data-testid="card-email-config-edit">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="em-enabled">Рассылка включена</Label>
                            <Switch id="em-enabled" data-testid="switch-email-enabled" checked={emEnabled} onCheckedChange={setEmEnabled} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="em-sender-address">Адрес отправителя</Label>
                            <Input id="em-sender-address" data-testid="input-email-sender-address" value={emSenderAddress} onChange={(e) => setEmSenderAddress(e.target.value)} placeholder="noreply@example.com" className="rounded-xl font-mono text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="em-sender-name">Имя отправителя</Label>
                            <Input id="em-sender-name" data-testid="input-email-sender-name" value={emSenderName} onChange={(e) => setEmSenderName(e.target.value)} placeholder="Портал инструкций" className="rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="em-smtp-host">SMTP-сервер</Label>
                            <Input id="em-smtp-host" data-testid="input-email-smtp-host" value={emSmtpHost} onChange={(e) => setEmSmtpHost(e.target.value)} placeholder="smtp.example.com" className="rounded-xl font-mono text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="em-smtp-port">Порт</Label>
                              <Input id="em-smtp-port" data-testid="input-email-smtp-port" type="number" value={emSmtpPort} onChange={(e) => setEmSmtpPort(Number(e.target.value))} className="rounded-xl text-sm w-full" />
                            </div>
                            <div className="flex items-end pb-0.5">
                              <div className="flex items-center gap-2">
                                <Switch id="em-tls" data-testid="switch-email-tls" checked={emSmtpUseTls} onCheckedChange={setEmSmtpUseTls} />
                                <Label htmlFor="em-tls" className="text-sm">TLS</Label>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="em-smtp-user">Имя пользователя SMTP</Label>
                            <Input id="em-smtp-user" data-testid="input-email-smtp-user" value={emSmtpUser} onChange={(e) => setEmSmtpUser(e.target.value)} placeholder="smtp-user" className="rounded-xl font-mono text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="em-smtp-password">Пароль SMTP</Label>
                            <Input id="em-smtp-password" data-testid="input-email-smtp-password" type="password" value={emSmtpPassword} onChange={(e) => setEmSmtpPassword(e.target.value)} placeholder="••••••••" className="rounded-xl font-mono text-sm" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2 text-sm" data-testid="card-email-config">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Отправитель</span>
                          <span className="font-mono text-xs" data-testid="text-email-sender">{emailConfig.senderName} &lt;{emailConfig.senderAddress}&gt;</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">SMTP-сервер</span>
                          <span className="font-mono text-xs" data-testid="text-email-smtp">{emailConfig.smtpHost}:{emailConfig.smtpPort}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Пользователь SMTP</span>
                          <span className="font-mono text-xs">{emailConfig.smtpUser || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Пароль</span>
                          <span className="text-xs">{emailConfig.smtpPassword ? "••••••••" : "Не задан"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">TLS</span>
                          <span className="text-xs">{emailConfig.smtpUseTls ? "Да" : "Нет"}</span>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* ── Email Templates ── */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">Шаблоны уведомлений</div>
                      <Badge variant="secondary" className="kb-chip">{emailTemplates.length}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Переменные шаблона: <code className="bg-muted px-1 py-0.5 rounded">{"{{title}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{owner}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{days}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{dueDate}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{link}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{version}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{recipient}}"}</code>
                    </div>
                    <div className="grid gap-3" data-testid="list-email-templates">
                      {emailTemplates.map((tpl) => (
                        <div key={tpl.key} className="rounded-2xl border bg-muted/10 p-3" data-testid={`row-email-tpl-${tpl.key}`}>
                          {editingTplKey === tpl.key ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Send className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{tpl.label}</span>
                                </div>
                                <div className="flex gap-2">
                                  <Button data-testid={`button-save-tpl-${tpl.key}`} size="sm" className="rounded-xl h-7 text-xs" onClick={saveTemplate}>
                                    <Save className="mr-1 h-3 w-3" />
                                    Сохранить
                                  </Button>
                                  <Button data-testid={`button-cancel-tpl-${tpl.key}`} size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => setEditingTplKey(null)}>
                                    <X className="mr-1 h-3 w-3" />
                                    Отмена
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Тема письма</Label>
                                <Input data-testid={`input-tpl-subject-${tpl.key}`} value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} className="rounded-xl text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Текст письма</Label>
                                <Textarea data-testid={`input-tpl-body-${tpl.key}`} value={tplBody} onChange={(e) => setTplBody(e.target.value)} className="rounded-xl text-sm min-h-[120px] font-mono" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-semibold">{tpl.label}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">{tpl.key}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{tpl.description}</div>
                                <div className="mt-2 text-xs">
                                  <span className="text-muted-foreground">Тема: </span>
                                  <span className="font-mono">{tpl.subject}</span>
                                </div>
                              </div>
                              <Button data-testid={`button-edit-tpl-${tpl.key}`} size="sm" variant="ghost" className="rounded-xl h-7 text-xs shrink-0" onClick={() => startEditTemplate(tpl.key)}>
                                <Edit2 className="mr-1 h-3 w-3" />
                                Изменить
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* ── Email Log ── */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm font-semibold">Журнал отправленных уведомлений</div>
                          <Badge variant="secondary" className="kb-chip" data-testid="badge-mail-count">
                            {notificationsFiltered.length}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Напоминания, просрочки, эскалации, публикации версий.</div>
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
                        <div key={n.id} className="rounded-2xl border bg-muted/10 p-3">
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
                              {emailTemplates.find(t => t.key === n.template)?.label || n.template}
                            </Badge>
                            <Badge variant={n.status === "FAILED" ? "destructive" : "outline"} className="kb-chip">
                              {n.status === "SENT" ? "Отправлено" : n.status === "LOGGED" ? "В очереди" : "Ошибка"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {!notificationsFiltered.length ? (
                        <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-mails">
                          Ничего не найдено.
                        </div>
                      ) : null}
                    </div>
                  </Card>

                </div>
              </TabsContent>

              {/* ── Новые сотрудники ── */}
              <TabsContent value="newhires" className="mt-4">
                <NewHiresTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
