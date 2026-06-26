import React, { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { api } from "@/lib/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Code,
  CloudOff,
  Download,
  Edit2,
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Table2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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

const HTML_GENERATOR_DEFAULT_PROMPT = `Ты — технический писатель и UX-редактор базы знаний. Твоя задача — преобразовывать инструкции, переданные автором в формате PDF, DOC/DOCX или обычного текста, в единообразные HTML-страницы для внутренней базы знаний.

## ЗАДАЧА
Преобразуй исходный текст инструкции (из файла или текстового описания процесса) в профессиональную HTML-страницу единого корпоративного формата, готовую к размещению в базе знаний.

## СТИЛЬ И ТОНАЛЬНОСТЬ
- Нейтральный, объясняющий тон — как опытный коллега проводит новичка по процессу
- Структура: контекст и цель → что нужно для начала → шаги → нюансы и ограничения
- Язык: русский, короткие предложения, в шагах — повелительное наклонение («Откройте...», «Нажмите...», «Заполните...»)
- Без канцелярита и избыточных вводных конструкций
- Один шаг = одно действие; не объединять несколько действий в один пункт
- Если в исходном файле шаги расположены непоследовательно или дублируются — переупорядочить и схлопнуть дубликаты при переносе в HTML

## КОРПОРАТИВНАЯ ЦВЕТОВАЯ СХЕМА
Используется та же палитра, что и в письмах — для единого визуального языка компании:

| Переменная         | HEX     | Применение                                              |
|--------------------|---------|---------------------------------------------------------------|
| Midnight Blue      | #41566D | Заголовки разделов внутри карточек, акцентная линия           |
| Graphite           | #323E48 | Основной текст, заголовки разделов                            |
| Turquoise          | #45A19F | Номера шагов, акценты, маркеры списков                        |
| Green              | #92C143 | Опционально для позитивных статусов внутри шагов (фон #F2F8E8)|
| Orange             | #F29957 | Предупреждения, ограничения (фон светлый: #FEF3EA)            |
| Gray               | #ACB3BC | Вторичный текст, подписи к скриншотам, строка «Результат»     |
| Фон страницы       | #F4F5F6 | Внешний фон вокруг карточек разделов                          |
| Фон блоков         | #FFFFFF | Белые карточки разделов                                       |

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К HTML-СТРАНИЦЕ
Это веб-страница базы знаний, а не email-рассылка — ограничения Outlook не действуют:
- Допустимы flexbox/grid, встроенный <style> в <head>, CSS-переменные
- Один самостоятельный HTML-файл без внешних зависимостей: стили только встроенным <style> в <head>, отдельные CSS-файлы не подключать
- Адаптивная вёрстка: корректное отображение от 360px (мобильный) до 1200px+ (десктоп)
- Шрифты: системный стек (system-ui, "Segoe UI", Arial, sans-serif)
- Семантичная вёрстка: <header>, <nav>, <main>, <section>, <footer> вместо вложенных <div>
- На каждом заголовке раздела — якорь (id), чтобы можно было дать прямую ссылку на нужный шаг
- Скриншоты/иллюстрации — через <img> с обязательным alt-текстом; подпись под изображением — серый текст 12px
- Картинки кодируются в base64 прямо в src — внешних файлов и ссылок на хранилище не использовать
- Сворачиваемые блоки (FAQ, доп. сведения) — через <details>/<summary> (работает без JS)
- JavaScript не использовать; вся интерактивность реализуется чисто на HTML/CSS
- Код, команды, названия полей форм — моноширинный шрифт (Consolas, Menlo, monospace), фон #F4F5F6, padding 8–12px, border-radius 4px
- Доступность: контраст текста не ниже AA, основной текст не менее 14px, видимые focus-стили на интерактивных элементах
- Версия для печати: через @media print скрывать навигацию и интерактивные элементы

## СТРУКТУРА ИНСТРУКЦИИ

### 1. ШАПКА / ТИТУЛЬНЫЙ БЛОК
- Заголовок инструкции — Graphite #323E48, 24–28px, жирный
- Без хлебных крошек, плашки актуальности и строки «Версия: / Обновлено: / Автор:» — эта информация уже выводится самим порталом

### 2. КОРОТКОЕ ОПИСАНИЕ (TL;DR)
- Белый фон, отступы 24px
- 1–2 предложения: что делает инструкция и в какой ситуации её применять
- При необходимости отдельной строкой: «Эта инструкция не подходит, если...» со ссылкой на смежную инструкцию

### 3. ПРЕДВАРИТЕЛЬНЫЕ ТРЕБОВАНИЯ
- Заголовок раздела: Midnight Blue #41566D, 16px, жирный, нижняя линия-разделитель 2px solid #45A19F
- Список с маркерами-галочками (#45A19F): какие права доступа, программы, документы или данные нужны до начала
- Раздел не выводить, если у процесса нет предварительных условий

### 4. ПОШАГОВАЯ ИНСТРУКЦИЯ (ядро страницы)
- Каждый шаг — отдельный блок с рамкой 1px solid #E8EAEC, отступ между шагами 12px
- Слева круглый маркер с номером шага (фон #45A19F, белый текст, 28×28px)
- Заголовок шага — жирный #323E48, 14–16px; текст шага — обычный вес, тот же цвет
- При наличии скриншота — изображение под текстом шага с подписью 12px серым
- При наличии ожидаемого результата — отдельная строка курсивом, серый текст: «Результат: ...»

### 5. ВАЖНО / ОГРАНИЧЕНИЯ / ТИПИЧНЫЕ ОШИБКИ
- Фон #FEF3EA, рамка слева 4px solid #F29957, значок ⚠ перед заголовком
- Заголовок «Обратите внимание» — жирный #323E48
- Текст: ограничения процесса, частые ошибки пользователей, последствия неправильного выполнения

### 6. ОСОБЫЕ СЛУЧАИ / ИСКЛЮЧЕНИЯ (опционально)
- Белый фон, рамка слева 4px solid #45A19F (отличать цветом от блока «Важно»)
- Заголовок «Особые случаи» — жирный #41566D
- Сценарии вида «если у вас..., то...»

### 7. ЧАСТЫЕ ВОПРОСЫ (опционально)
- Сворачиваемые блоки <details>/<summary>
- Вопрос — жирный #323E48; при раскрытии ответ — обычный вес, тот же цвет
- Фон каждого блока белый, рамка 1px solid #E8EAEC

## ОТСТУПЫ МЕЖДУ БЛОКАМИ
Между разделами — воздух 16–24px (margin/padding секции); фон страницы #F4F5F6 виден между белыми карточками разделов.

## ПРАВИЛА ОБРАБОТКИ ИСХОДНОГО ФАЙЛА
- Если в исходнике нет данных для опционального раздела (3, 6 или 7) — раздел полностью пропускается, без пустых заголовков
- Если исходный файл содержит изображения/скриншоты — переносить их как <img>, не описывать словами
- Верни ТОЛЬКО валидный HTML-фрагмент содержимого страницы — без обёртки <html>/<body>/<head>, без <style>, без markdown-ограждений`;

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
  const [newHireSearch, setNewHireSearch] = useState("");

  const filteredProfiles = newHireProfiles.filter((profile) => {
    const user = users.find((u) => u.id === profile.userId);
    if (!newHireSearch.trim()) return true;
    const q = newHireSearch.trim().toLowerCase();
    return user?.displayName?.toLowerCase().includes(q) || user?.email?.toLowerCase().includes(q);
  });

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
            <React.Fragment>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="input-newhire-search"
                  className="rounded-xl pl-9"
                  placeholder="Поиск по имени или email сотрудника…"
                  value={newHireSearch}
                  onChange={(e) => setNewHireSearch(e.target.value)}
                />
              </div>
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
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground" data-testid="empty-newhire-search">
                        Сотрудники по запросу «{newHireSearch}» не найдены
                      </td>
                    </tr>
                  ) : null}
                  {filteredProfiles.map((profile) => {
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
                                    const mat = materials.find(m => m.materialId === assignment.materialId && m.status === "Опубликовано")
                                      ?? materials.find(m => m.materialId === assignment.materialId);
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
            </React.Fragment>
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

function AiSettingsTab() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<"openai" | "anthropic" | "custom">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [htmlGeneratorEnabled, setHtmlGeneratorEnabled] = useState(false);
  const [htmlGeneratorSystemPrompt, setHtmlGeneratorSystemPrompt] = useState(HTML_GENERATOR_DEFAULT_PROMPT);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const [queryLog, setQueryLog] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [logPeriod, setLogPeriod] = useState<7 | 30 | 90>(30);
  const [allLogsOpen, setAllLogsOpen] = useState(false);
  const [allLogsSearch, setAllLogsSearch] = useState("");
  const [userLogsUser, setUserLogsUser] = useState<{ userId: string; name: string } | null>(null);

  const MODEL_DEFAULTS: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    custom: "",
  };

  useEffect(() => {
    api
      .getAiSettings()
      .then((data) => {
        if (data) {
          setProvider(data.provider || "openai");
          setApiKey(data.apiKey || "");
          setModel(data.model || "gpt-4o");
          setBaseUrl(data.baseUrl || "");
          setEnabled(data.enabled ?? false);
          setLoggingEnabled(data.loggingEnabled ?? true);
          setHtmlGeneratorEnabled(data.htmlGeneratorEnabled ?? false);
          setHtmlGeneratorSystemPrompt(data.htmlGeneratorSystemPrompt || HTML_GENERATOR_DEFAULT_PROMPT);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));

    api
      .getAiQueryLog()
      .then((data) => setQueryLog(data || []))
      .catch(() => setQueryLog([]))
      .finally(() => setLoadingLog(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAiSettings({ provider, apiKey, model, baseUrl, enabled, loggingEnabled, htmlGeneratorEnabled, htmlGeneratorSystemPrompt });
      toast({ title: "Сохранено", description: "Настройки AI-помощника обновлены" });
      setTestResult(null);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить настройки", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testAiConnection({ provider, apiKey, model, baseUrl });
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message || "Ошибка подключения" });
    } finally {
      setTesting(false);
    }
  };

  const periodLogs = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - logPeriod);
    return queryLog.filter((l) => new Date(l.createdAt) >= cutoff);
  }, [queryLog, logPeriod]);

  const topUsers = useMemo(() => {
    const counts: Record<string, { userId: string; name: string; count: number }> = {};
    for (const l of periodLogs) {
      if (!counts[l.userId]) counts[l.userId] = { userId: l.userId, name: l.userName || l.userId, count: 0 };
      counts[l.userId].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [periodLogs]);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <div className="text-sm font-semibold">Подключение LLM</div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-enabled" className="text-sm cursor-pointer">
                Включить AI-помощник
              </Label>
              <Switch
                id="ai-enabled"
                data-testid="switch-ai-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ai-logging" className="text-sm cursor-pointer">
                Вести журнал запросов
              </Label>
              <Switch
                id="ai-logging"
                data-testid="switch-ai-logging"
                checked={loggingEnabled}
                onCheckedChange={setLoggingEnabled}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Провайдер</Label>
              <Select
                value={provider}
                onValueChange={(v: any) => {
                  setProvider(v);
                  setModel(MODEL_DEFAULTS[v] || "");
                }}
              >
                <SelectTrigger data-testid="select-ai-provider" className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  <SelectItem value="custom">Custom (OpenAI-compatible)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">API-ключ</Label>
              <Input
                data-testid="input-ai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="mt-1 rounded-xl font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Модель</Label>
              <Input
                data-testid="input-ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={MODEL_DEFAULTS[provider] || "model-name"}
                className="mt-1 rounded-xl"
              />
            </div>

            {(provider === "custom" || provider === "openai") && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  URL эндпоинта{" "}
                  {provider === "openai"
                    ? "(опционально — для Azure/прокси/совместимых API)"
                    : "(обязательно)"}
                </Label>
                <Input
                  data-testid="input-ai-base-url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    provider === "custom"
                      ? "https://your-llm-host/v1"
                      : "https://api.openai.com/v1/chat/completions"
                  }
                  className="mt-1 rounded-xl"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                data-testid="button-ai-test"
                variant="outline"
                className="rounded-xl flex-1"
                onClick={test}
                disabled={testing || !apiKey.trim()}
              >
                {testing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                )}
                Проверить
              </Button>
              <Button
                data-testid="button-ai-save"
                className="rounded-xl flex-1"
                onClick={save}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Сохранить
              </Button>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                  testResult.ok
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {testResult.ok
                    ? "Подключение успешно"
                    : testResult.message || "Ошибка подключения"}
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Как работает AI-помощник</div>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            {[
              "Пользователь задаёт вопрос в чате (кнопка AI в шапке).",
              "Система отбирает материалы, доступные пользователю (статус «Опубликован» + группы видимости).",
              "По ключевым словам вопроса находятся до 8 наиболее релевантных материалов (страницы и файлы с извлечённым текстом).",
              "LLM формирует развёрнутый ответ строго по контексту из базы знаний.",
              "Под ответом — кликабельные ссылки на использованные материалы.",
            ].map((text, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="shrink-0 h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[10px] font-bold">
                  {i + 1}
                </div>
                <div>{text}</div>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <strong>Провайдеры:</strong> OpenAI (GPT-4o, GPT-4), Anthropic (Claude), любой
              OpenAI-compatible API (vLLM, Ollama, LM Studio, Azure OpenAI).
            </div>
            <div>
              <strong>Данные:</strong> API-ключ хранится в зашифрованной базе данных.
              Запросы отправляются сервером напрямую — ключ никогда не попадает в браузер.
            </div>
          </div>
        </Card>
      </div>

      {/* AI HTML Generator */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-amber-500" />
            <div className="text-sm font-semibold">AI HTML-генератор</div>
          </div>
          <Switch
            data-testid="switch-html-generator-enabled"
            checked={htmlGeneratorEnabled}
            onCheckedChange={setHtmlGeneratorEnabled}
          />
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          Инструмент в мастере создания материала: автор загружает PDF/DOCX или текст, AI
          преобразует инструкцию в HTML-страницу единого корпоративного формата.
          Требует включённого AI-помощника выше.
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-muted-foreground">
              Системный промпт генератора
            </Label>
            <Button
              data-testid="button-html-generator-prompt-reset"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              disabled={!htmlGeneratorEnabled || htmlGeneratorSystemPrompt === HTML_GENERATOR_DEFAULT_PROMPT}
              onClick={() => setHtmlGeneratorSystemPrompt(HTML_GENERATOR_DEFAULT_PROMPT)}
            >
              Сбросить до умолчания
            </Button>
          </div>
          <Textarea
            data-testid="textarea-html-generator-prompt"
            value={htmlGeneratorSystemPrompt}
            onChange={(e) => setHtmlGeneratorSystemPrompt(e.target.value)}
            placeholder={HTML_GENERATOR_DEFAULT_PROMPT}
            className="mt-0 min-h-[280px] rounded-xl text-sm font-mono"
            disabled={!htmlGeneratorEnabled}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Полный системный промпт, который получает модель при каждой генерации. По умолчанию содержит
            корпоративный стандарт оформления: цвета, структуру разделов и технические требования к HTML.
            Изменения вступают в силу сразу после сохранения.
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            data-testid="button-html-generator-save"
            className="rounded-xl"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Сохранить
          </Button>
        </div>
      </Card>

      {/* AI Query Log */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Журнал запросов AI</div>
            {!loggingEnabled && (
              <Badge variant="secondary" className="text-[10px]">Логирование отключено</Badge>
            )}
          </div>
          <Select value={String(logPeriod)} onValueChange={(v) => setLogPeriod(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger data-testid="select-ai-log-period" className="w-36 rounded-xl h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">За 7 дней</SelectItem>
              <SelectItem value="30">За 30 дней</SelectItem>
              <SelectItem value="90">За 90 дней</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingLog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-3" data-testid="ai-log-stat-total">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Запросов за период</div>
                <div className="text-2xl font-bold mt-1">{periodLogs.length}</div>
              </div>
              <div className="rounded-xl border p-3" data-testid="ai-log-stat-users">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Уникальных пользователей</div>
                <div className="text-2xl font-bold mt-1">
                  {new Set(periodLogs.map((l) => l.userId)).size}
                </div>
              </div>
              <div className="rounded-xl border p-3" data-testid="ai-log-stat-all">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Всего в журнале</div>
                <div className="text-2xl font-bold mt-1">{queryLog.length}</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {topUsers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Топ-5 пользователей</div>
                  <div className="space-y-1.5">
                    {topUsers.map((u, i) => (
                      <button
                        key={i}
                        className="w-full flex items-center gap-2 text-sm rounded-lg px-1 py-0.5 hover:bg-accent transition-colors cursor-pointer text-left"
                        onClick={() => setUserLogsUser({ userId: (u as any).userId, name: u.name })}
                        data-testid={`ai-log-top-user-${i}`}
                        title="Показать запросы пользователя"
                      >
                        <div className="shrink-0 h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[10px] font-bold">
                          {i + 1}
                        </div>
                        <span className="flex-1 truncate">{u.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{u.count} запр.</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Последние вопросы</div>
                {periodLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">Запросов за этот период нет.</div>
                ) : (
                  <div className="space-y-1.5">
                    {periodLogs.slice(0, 8).map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground" data-testid={`ai-log-recent-${i}`}>
                        <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
                        <div className="flex-1 min-w-0">
                          <div className="line-clamp-1 text-foreground">{l.question}</div>
                          <div className="text-[10px] mt-0.5">{l.userName} · {format(new Date(l.createdAt), "d MMM, HH:mm", { locale: ru })}</div>
                        </div>
                      </div>
                    ))}
                    {periodLogs.length > 8 && (
                      <button
                        className="w-full text-xs text-primary hover:underline text-left pt-1"
                        onClick={() => { setAllLogsSearch(""); setAllLogsOpen(true); }}
                        data-testid="button-ai-log-show-all"
                      >
                        Показать все {periodLogs.length} запросов…
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Диалог: все запросы за период */}
      <Dialog open={allLogsOpen} onOpenChange={setAllLogsOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Все запросы к AI-помощнику</DialogTitle>
            <DialogDescription>
              За выбранный период · {periodLogs.length} запросов
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Input
              placeholder="Поиск по вопросу или пользователю…"
              value={allLogsSearch}
              onChange={(e) => setAllLogsSearch(e.target.value)}
              className="rounded-xl text-sm mb-3"
              data-testid="input-ai-log-search"
            />
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-2">
                {periodLogs
                  .filter((l) => {
                    const q = allLogsSearch.toLowerCase();
                    return !q || l.question?.toLowerCase().includes(q) || l.userName?.toLowerCase().includes(q);
                  })
                  .map((l, i) => (
                    <div key={i} className="rounded-xl border px-3 py-2.5" data-testid={`ai-log-all-${i}`}>
                      <div className="text-sm text-foreground">{l.question}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span className="font-medium">{l.userName || l.userId}</span>
                        <span>·</span>
                        <span>{format(new Date(l.createdAt), "d MMM yyyy, HH:mm", { locale: ru })}</span>
                      </div>
                    </div>
                  ))}
                {periodLogs.filter((l) => {
                  const q = allLogsSearch.toLowerCase();
                  return !q || l.question?.toLowerCase().includes(q) || l.userName?.toLowerCase().includes(q);
                }).length === 0 && (
                  <div className="text-sm text-muted-foreground italic text-center py-8">Ничего не найдено</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог: запросы конкретного пользователя */}
      <Dialog open={!!userLogsUser} onOpenChange={(o) => { if (!o) setUserLogsUser(null); }}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Запросы пользователя</DialogTitle>
            <DialogDescription>
              {userLogsUser?.name} · {queryLog.filter((l) => l.userId === userLogsUser?.userId).length} запросов всего
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-2">
                {queryLog
                  .filter((l) => l.userId === userLogsUser?.userId)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((l, i) => (
                    <div key={i} className="rounded-xl border px-3 py-2.5" data-testid={`ai-log-user-${i}`}>
                      <div className="text-sm text-foreground">{l.question}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {format(new Date(l.createdAt), "d MMM yyyy, HH:mm", { locale: ru })}
                      </div>
                    </div>
                  ))}
                {queryLog.filter((l) => l.userId === userLogsUser?.userId).length === 0 && (
                  <div className="text-sm text-muted-foreground italic text-center py-8">Запросов нет</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const { me, materials, notifications, policy, users, syncADUsers, updateAdConfig, createLocalUser, deactivateUser, reactivateUser, updateReviewPeriod, updateRbacDefaults, updateUser, createGroup, updateGroup, deleteGroup, visibilityGroups, catalogNodes, updateCatalogNode, addSection, renameSection, deleteSection, addSubsection, renameSubsection, deleteSubsection, emailConfig, emailTemplates, updateEmailConfig, updateEmailTemplate } = useKB();
  const [q, setQ] = useState("");
  const [notifLimit, setNotifLimit] = useState<number>(50);
  const [helpfulTopN, setHelpfulTopN] = useState<number>(3);
  const [uselessTopN, setUselessTopN] = useState<number>(3);
  const [userSearch, setUserSearch] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | "ad" | "local">("all");
  const [userDeptFilter, setUserDeptFilter] = useState("all");
  const [userEntityFilter, setUserEntityFilter] = useState("all");
  const [userSortBy, setUserSortBy] = useState<"name" | "lastLogin" | "dept" | "entity">("name");
  const [syncing, setSyncing] = useState(false);
  const [syncingUser, setSyncingUser] = useState(false);
  const [syncUserAccount, setSyncUserAccount] = useState("");
  const [syncUserResult, setSyncUserResult] = useState<{ ok: boolean; message: string; action?: string; user?: Record<string, string> } | null>(null);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newEntity, setNewEntity] = useState("");
  const [newPassword, setNewPassword] = useState("1");
  const [newRoles, setNewRoles] = useState<Role[]>(["Читатель"]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [addGroupOpenForUser, setAddGroupOpenForUser] = useState<string | null>(null);
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
  const [grpMemberSearch, setGrpMemberSearch] = useState("");

  const [adEditing, setAdEditing] = useState(false);
  const [adEnabled, setAdEnabled] = useState(false);
  const [adMode, setAdMode] = useState<"demo" | "SAML" | "OIDC" | "LDAP">("SAML");
  const [adSsoUrl, setAdSsoUrl] = useState("");
  const [adBindDn, setAdBindDn] = useState("");
  const [adBindPassword, setAdBindPassword] = useState("");
  const [adBaseDn, setAdBaseDn] = useState("");
  const [adSyncFreq, setAdSyncFreq] = useState(60);
  const [adSyncMode, setAdSyncMode] = useState<"manual" | "auto">("auto");
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
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<"idle" | "ok" | "error">("idle");

  const [editingTplKey, setEditingTplKey] = useState<string | null>(null);
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");

  const scoped = useMemo(
    () => materials.filter((m) => m.passport.legalEntity === me.legalEntity),
    [materials, me],
  );

  const kpis = useMemo(() => computeKpis(scoped, users), [scoped, users]);

  const overdueAll = useMemo(() => materials.filter(isOverdue), [materials]);
  const failedNotifications = useMemo(() => notifications.filter((n) => n.status === "FAILED"), [notifications]);
  const withoutOwner = useMemo(() =>
    materials.filter((m) => m.status !== "Архив" && !m.passport.ownerId),
    [materials],
  );

  const catalogStats = useMemo(() => {
    const sections = catalogNodes.filter((n) => n.type === "section").length;
    const subsections = catalogNodes.filter((n) => n.type === "subsection").length;
    const uniqueMaterials = new Set(materials.map((m) => m.materialId)).size;
    const publishedMaterials = new Set(
      materials.filter((m) => m.status === "Опубликовано").map((m) => m.materialId)
    ).size;
    const draftMaterials = new Set(
      materials.filter((m) => m.status === "Черновик").map((m) => m.materialId)
    ).size;
    return { sections, subsections, uniqueMaterials, publishedMaterials, draftMaterials };
  }, [catalogNodes, materials]);

  const expandedUserViews = useMemo(() => {
    if (!expandedUserId) return [];
    const views: { materialId: string; title: string; viewedAt: string }[] = [];
    materials.forEach((m) => {
      (m.auditViews || [])
        .filter((v: { userId: string; at: string }) => v.userId === expandedUserId)
        .forEach((v: { userId: string; at: string }) => {
          views.push({ materialId: m.materialId, title: m.passport.title, viewedAt: v.at });
        });
    });
    return views.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());
  }, [expandedUserId, materials]);

  const helpfulnessSorted = useMemo(() => {
    const withVotes = scoped.filter((m) => (m.stats.helpfulYes + m.stats.helpfulNo) > 0);
    const byHelpful = [...withVotes].sort((a, b) => b.stats.helpfulYes - a.stats.helpfulYes);
    const byUseless = [...withVotes].sort((a, b) => b.stats.helpfulNo - a.stats.helpfulNo);
    return { byHelpful, byUseless };
  }, [scoped]);

  const notificationsFiltered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return notifications;
    return notifications.filter((n) => (n.subject + " " + n.to).toLowerCase().includes(query));
  }, [notifications, q]);

  const allDepts = useMemo(() => Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort(), [users]);
  const allEntities = useMemo(() => Array.from(new Set(users.map(u => u.legalEntity).filter(Boolean))).sort(), [users]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    let result = users.filter((u) => {
      if (query && !(u.displayName + " " + u.email + " " + u.department + " " + u.legalEntity).toLowerCase().includes(query)) return false;
      if (userTypeFilter !== "all" && u.source !== userTypeFilter) return false;
      if (userDeptFilter !== "all" && u.department !== userDeptFilter) return false;
      if (userEntityFilter !== "all" && u.legalEntity !== userEntityFilter) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      if (userSortBy === "lastLogin") {
        const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bTime - aTime;
      }
      if (userSortBy === "dept") return (a.department || "").localeCompare(b.department || "", "ru");
      if (userSortBy === "entity") return (a.legalEntity || "").localeCompare(b.legalEntity || "", "ru");
      return a.displayName.localeCompare(b.displayName, "ru");
    });
    return result;
  }, [users, userSearch, userTypeFilter, userDeptFilter, userEntityFilter, userSortBy]);

  const activeUsers = useMemo(() => users.filter((u) => !u.deactivatedAt), [users]);

  const ad = policy.adIntegration;

  function startEditAd() {
    setAdEditing(true);
    setAdEnabled(ad.enabled);
    setAdMode(ad.mode);
    setAdSsoUrl(ad.ssoUrl);
    setAdBindDn(ad.bindDn || "");
    setAdBindPassword(ad.bindPassword || "");
    setAdBaseDn(ad.baseDn || "");
    setAdSyncMode(ad.syncFrequencyMinutes === 0 ? "manual" : "auto");
    setAdSyncFreq(ad.syncFrequencyMinutes === 0 ? 60 : ad.syncFrequencyMinutes);
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
      bindDn: adBindDn.trim(),
      bindPassword: adBindPassword,
      baseDn: adBaseDn.trim(),
      syncFrequencyMinutes: adSyncMode === "manual" ? 0 : adSyncFreq,
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

  async function sendTestEmail() {
    const addr = testEmailAddress.trim();
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      toast({ title: "Ошибка", description: "Введите корректный email-адрес", variant: "destructive" });
      return;
    }
    if (!emailConfig.smtpHost) {
      toast({ title: "Ошибка", description: "SMTP-сервер не настроен", variant: "destructive" });
      return;
    }
    setTestEmailSending(true);
    setTestEmailResult("idle");
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: addr }),
      });
      if (res.ok) {
        setTestEmailResult("ok");
        toast({ title: "Тестовое письмо отправлено", description: `Письмо направлено на ${addr}` });
      } else {
        const data = await res.json().catch(() => ({}));
        setTestEmailResult("error");
        toast({ title: "Ошибка отправки", description: data.message || "Не удалось отправить письмо", variant: "destructive" });
      }
    } catch {
      setTestEmailResult("error");
      toast({ title: "Ошибка", description: "Нет связи с сервером", variant: "destructive" });
    } finally {
      setTestEmailSending(false);
    }
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

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.triggerLdapSync();
      toast({
        title: res.ok ? "Синхронизация завершена" : "Ошибка синхронизации",
        description: res.message,
        variant: res.ok ? undefined : "destructive",
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err: any) {
      toast({
        title: "Ошибка синхронизации",
        description: err.message || "Не удалось выполнить синхронизацию",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncUser() {
    if (!syncUserAccount.trim()) return;
    setSyncingUser(true);
    setSyncUserResult(null);
    try {
      const res = await api.triggerLdapSyncUser(syncUserAccount.trim());
      setSyncUserResult(res);
      if (res.ok) {
        toast({ title: "Готово", description: res.message });
      } else {
        toast({ title: "Не удалось", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      const result = { ok: false, message: err.message || "Ошибка запроса" };
      setSyncUserResult(result);
      toast({ title: "Ошибка", description: result.message, variant: "destructive" });
    } finally {
      setSyncingUser(false);
    }
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
      setGrpMemberSearch("");
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" });
    }
  }

  return (
    <AppShell
      title="Администрирование"
      breadcrumbs={[{ label: "Центр знаний ЦОС", href: "/" }, { label: "Администрирование" }]}
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
              <TabsList className="grid w-full grid-cols-9">
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
                <TabsTrigger data-testid="tab-admin-health" value="health">
                  Здоровье базы
                </TabsTrigger>
                <TabsTrigger data-testid="tab-admin-ai" value="ai">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 mr-1" />
                  AI
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

                        {adMode === "LDAP" && (
                          <>
                            <Separator />
                            <div className="text-xs font-medium text-muted-foreground">Учётная запись AD для подключения</div>
                            <div className="space-y-1.5">
                              <Label htmlFor="ad-bind-dn">Логин учётной записи AD</Label>
                              <Input
                                id="ad-bind-dn"
                                data-testid="input-ad-bind-dn"
                                value={adBindDn}
                                onChange={(e) => setAdBindDn(e.target.value)}
                                placeholder="DOMAIN\svc_ldap или svc_ldap@domain.com"
                                className="rounded-xl text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="ad-bind-password">Пароль</Label>
                              <Input
                                id="ad-bind-password"
                                data-testid="input-ad-bind-password"
                                type="password"
                                value={adBindPassword}
                                onChange={(e) => setAdBindPassword(e.target.value)}
                                placeholder="Пароль учётной записи AD"
                                className="rounded-xl text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="ad-base-dn">Base DN (корень поиска)</Label>
                              <Input
                                id="ad-base-dn"
                                data-testid="input-ad-base-dn"
                                value={adBaseDn}
                                onChange={(e) => setAdBaseDn(e.target.value)}
                                placeholder="DC=example,DC=com"
                                className="rounded-xl font-mono text-sm"
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-3">
                          <Label>Режим синхронизации</Label>
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-3 cursor-pointer rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/40 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                              <input
                                type="radio"
                                name="adSyncMode"
                                data-testid="radio-sync-manual"
                                value="manual"
                                checked={adSyncMode === "manual"}
                                onChange={() => setAdSyncMode("manual")}
                                className="accent-primary"
                              />
                              <div>
                                <div className="text-sm font-medium">Только вручную</div>
                                <div className="text-xs text-muted-foreground">Синхронизация запускается только по кнопке «Синхронизировать сейчас»</div>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/40 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                              <input
                                type="radio"
                                name="adSyncMode"
                                data-testid="radio-sync-auto"
                                value="auto"
                                checked={adSyncMode === "auto"}
                                onChange={() => setAdSyncMode("auto")}
                                className="accent-primary mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium">Автоматически</div>
                                <div className="text-xs text-muted-foreground mb-2">Синхронизация запускается по расписанию</div>
                                {adSyncMode === "auto" && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id="ad-sync-freq"
                                      data-testid="input-ad-sync-freq"
                                      type="number"
                                      min={5}
                                      max={1440}
                                      value={adSyncFreq}
                                      onChange={(e) => setAdSyncFreq(Number(e.target.value))}
                                      className="rounded-xl w-24 h-8 text-sm"
                                    />
                                    <span className="text-xs text-muted-foreground">минут между синхронизациями</span>
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
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
                        {ad.mode === "LDAP" && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Учётная запись AD</span>
                              <span className="text-xs truncate max-w-[240px]" data-testid="text-bind-dn">{ad.bindDn || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Пароль</span>
                              <span className="text-xs" data-testid="text-bind-password">{ad.bindPassword ? "••••••••" : "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Base DN</span>
                              <span className="text-xs font-mono truncate max-w-[240px]" data-testid="text-base-dn">{ad.baseDn || "—"}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Режим синхронизации</span>
                          {ad.syncFrequencyMinutes === 0
                            ? <Badge variant="outline" className="text-[10px]">Только вручную</Badge>
                            : <span className="text-xs">Каждые {ad.syncFrequencyMinutes} мин.</span>}
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

                    {ad.mode === "LDAP" && (
                      <Card className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm font-semibold">Синхронизация отдельного аккаунта</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Укажите sAMAccountName для точечного обновления или создания пользователя из LDAP.
                        </div>
                        <div className="flex gap-2">
                          <Input
                            data-testid="input-sync-user-account"
                            className="h-8 text-sm font-mono"
                            placeholder="Например: ivanova_m"
                            value={syncUserAccount}
                            onChange={(e) => { setSyncUserAccount(e.target.value); setSyncUserResult(null); }}
                            onKeyDown={(e) => e.key === "Enter" && handleSyncUser()}
                            disabled={syncingUser || !ad.enabled}
                          />
                          <Button
                            data-testid="button-sync-user"
                            size="sm"
                            className="rounded-xl shrink-0"
                            disabled={syncingUser || !ad.enabled || !syncUserAccount.trim()}
                            onClick={handleSyncUser}
                          >
                            {syncingUser
                              ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              : <UserCheck className="mr-2 h-3.5 w-3.5" />}
                            Синхронизировать
                          </Button>
                        </div>
                        {syncUserResult && (
                          <div className={`rounded-xl border px-3 py-2.5 text-sm ${syncUserResult.ok ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"}`}>
                            <div className="flex items-center gap-2">
                              {syncUserResult.ok
                                ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                              <span className="font-medium">{syncUserResult.message}</span>
                            </div>
                            {syncUserResult.ok && syncUserResult.user && (
                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pl-6">
                                {syncUserResult.user.displayName && <span>Имя: <span className="text-foreground font-medium">{syncUserResult.user.displayName}</span></span>}
                                {syncUserResult.user.email && <span>Email: <span className="text-foreground font-medium">{syncUserResult.user.email}</span></span>}
                                {syncUserResult.user.department && <span>Отдел: <span className="text-foreground font-medium">{syncUserResult.user.department}</span></span>}
                                {syncUserResult.user.legalEntity && <span>Юр. лицо: <span className="text-foreground font-medium">{syncUserResult.user.legalEntity}</span></span>}
                              </div>
                            )}
                          </div>
                        )}
                        {!ad.enabled && (
                          <div className="text-xs text-muted-foreground">Включите интеграцию AD/SSO для выполнения синхронизации.</div>
                        )}
                      </Card>
                    )}

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
                    {/* ── Панель поиска и фильтров ── */}
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Input
                          data-testid="input-user-search"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Поиск по имени, email, отделу…"
                          className="rounded-2xl max-w-sm"
                        />
                        <Button data-testid="button-create-user" className="rounded-xl shrink-0" onClick={() => setDlgOpen(true)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Создать локального пользователя
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={userTypeFilter} onValueChange={(v) => setUserTypeFilter(v as any)}>
                          <SelectTrigger data-testid="select-user-type-filter" className="h-8 rounded-xl text-xs w-[140px]">
                            <SelectValue placeholder="Тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все типы</SelectItem>
                            <SelectItem value="ad">AD</SelectItem>
                            <SelectItem value="local">Локальный</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={userDeptFilter} onValueChange={setUserDeptFilter}>
                          <SelectTrigger data-testid="select-user-dept-filter" className="h-8 rounded-xl text-xs w-[180px]">
                            <SelectValue placeholder="Подразделение" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все подразделения</SelectItem>
                            {allDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={userEntityFilter} onValueChange={setUserEntityFilter}>
                          <SelectTrigger data-testid="select-user-entity-filter" className="h-8 rounded-xl text-xs w-[180px]">
                            <SelectValue placeholder="Организация" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все организации</SelectItem>
                            {allEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={userSortBy} onValueChange={(v) => setUserSortBy(v as any)}>
                          <SelectTrigger data-testid="select-user-sort" className="h-8 rounded-xl text-xs w-[185px]">
                            <SelectValue placeholder="Сортировка" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">По имени</SelectItem>
                            <SelectItem value="lastLogin">По последнему входу</SelectItem>
                            <SelectItem value="dept">По подразделению</SelectItem>
                            <SelectItem value="entity">По организации</SelectItem>
                          </SelectContent>
                        </Select>
                        {(userTypeFilter !== "all" || userDeptFilter !== "all" || userEntityFilter !== "all") && (
                          <Button
                            data-testid="button-reset-user-filters"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs rounded-xl text-muted-foreground"
                            onClick={() => { setUserTypeFilter("all"); setUserDeptFilter("all"); setUserEntityFilter("all"); }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Сбросить
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {filteredUsers.length} из {users.length}
                        </span>
                      </div>
                    </div>

                    <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
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
                              {/* Группы видимости — управление в режиме редактирования */}
                              <div>
                                <Label className="text-xs">Группы доступа</Label>
                                <div className="mt-1 flex flex-wrap gap-1 items-center">
                                  {visibilityGroups.filter(g => g.memberIds.includes(u.id)).length === 0 && (
                                    <span className="text-[10px] italic text-muted-foreground/60">Нет групп</span>
                                  )}
                                  {visibilityGroups.filter(g => g.memberIds.includes(u.id)).map(g => (
                                    <Badge
                                      key={g.id}
                                      variant="outline"
                                      className="text-[10px] gap-1 pr-1 pl-2"
                                      data-testid={`badge-edit-group-${u.id}-${g.id}`}
                                    >
                                      {g.title}
                                      {!g.isSystem && (
                                        <button
                                          data-testid={`button-remove-group-${u.id}-${g.id}`}
                                          className="ml-0.5 rounded-sm hover:text-destructive transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateGroup(g.id, { memberIds: g.memberIds.filter(id => id !== u.id) });
                                            toast({ title: `Пользователь удалён из группы «${g.title}»` });
                                          }}
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </Badge>
                                  ))}
                                  {visibilityGroups.filter(g => !g.memberIds.includes(u.id)).length > 0 && (
                                    <Popover
                                      open={addGroupOpenForUser === u.id}
                                      onOpenChange={(open) => setAddGroupOpenForUser(open ? u.id : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          data-testid={`button-add-group-${u.id}`}
                                          variant="outline"
                                          size="sm"
                                          className="h-5 w-5 rounded-full p-0 border-dashed"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-56 p-0" align="start">
                                        <Command>
                                          <CommandInput placeholder="Поиск группы…" className="h-8" />
                                          <CommandList>
                                            <CommandEmpty>Группы не найдены</CommandEmpty>
                                            <CommandGroup>
                                              {visibilityGroups.filter(g => !g.memberIds.includes(u.id)).map(g => (
                                                <CommandItem
                                                  key={g.id}
                                                  value={g.title}
                                                  data-testid={`item-add-group-${u.id}-${g.id}`}
                                                  onSelect={() => {
                                                    updateGroup(g.id, { memberIds: [...g.memberIds, u.id] });
                                                    toast({ title: `Пользователь добавлен в группу «${g.title}»` });
                                                    setAddGroupOpenForUser(null);
                                                  }}
                                                >
                                                  {g.title}
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (<>
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
                                <div className="mt-1 text-xs flex items-center gap-1" data-testid={`text-last-login-${u.id}`}>
                                  <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  {u.lastLogin
                                    ? <span className="text-muted-foreground">Последний вход: <span className="font-medium text-foreground">{formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true, locale: ru })}</span></span>
                                    : <span className="text-muted-foreground/60 italic">Вход не зафиксирован</span>}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {u.roles.map((r) => (
                                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                                  ))}
                                </div>
                                {/* Группы видимости — только просмотр */}
                                {(() => {
                                  const userGroups = visibilityGroups.filter(g => g.memberIds.includes(u.id));
                                  return (
                                    <div className="mt-2">
                                      <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        Группы доступа
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {userGroups.length === 0
                                          ? <span className="text-[10px] italic text-muted-foreground/60">Нет групп</span>
                                          : userGroups.map(g => (
                                            <Badge key={g.id} variant="outline" className="text-[10px]" data-testid={`badge-group-${u.id}-${g.id}`}>
                                              {g.title}
                                            </Badge>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`button-stats-user-${u.id}`}
                                  size="sm"
                                  variant={expandedUserId === u.id ? "secondary" : "outline"}
                                  className="rounded-lg text-xs"
                                  onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                >
                                  <Activity className="mr-1 h-3 w-3" />
                                  Статистика
                                </Button>
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

                            {expandedUserId === u.id && (
                              <div className="mt-3 border-t pt-3 space-y-3">
                                {/* Login info */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  {u.lastLogin
                                    ? <span>Последний вход: <span className="font-semibold text-foreground">{format(new Date(u.lastLogin), "d MMM yyyy, HH:mm", { locale: ru })}</span> ({formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true, locale: ru })})</span>
                                    : <span className="italic">Вход в систему не зафиксирован</span>}
                                </div>

                                {/* Material views */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold">Просмотры материалов</span>
                                    <Badge variant="secondary" className="kb-chip">{expandedUserViews.length}</Badge>
                                  </div>
                                  {expandedUserViews.length === 0 ? (
                                    <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground italic">
                                      Просмотры материалов не зафиксированы.
                                    </div>
                                  ) : (
                                    <div className="grid gap-1.5 max-h-60 overflow-y-auto pr-1">
                                      {expandedUserViews.map((v, idx) => (
                                        <Link key={idx} href={`/materials/${v.materialId}`}>
                                          <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/10 px-3 py-2 cursor-pointer transition-all hover:bg-accent/40 hover:border-primary/20" data-testid={`row-user-view-${u.id}-${idx}`}>
                                            <span className="truncate text-xs font-medium">{v.title}</span>
                                            <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                                              {format(new Date(v.viewedAt), "d MMM yyyy, HH:mm", { locale: ru })}
                                            </span>
                                          </div>
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>)}
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
                      <Dialog open={grpDlgOpen} onOpenChange={(open) => { setGrpDlgOpen(open); if (!open) setGrpMemberSearch(""); }}>
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
                              <Label>Участники</Label>
                              {grpMembers.length > 0 && (
                                <div className="mt-1 mb-2 flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-2 min-h-[36px]" data-testid="selected-grp-members">
                                  {grpMembers.map((id) => {
                                    const u = activeUsers.find((u) => u.id === id);
                                    if (!u) return null;
                                    return (
                                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" data-testid={`tag-grp-member-${id}`}>
                                        {u.displayName}
                                        <button
                                          type="button"
                                          data-testid={`remove-grp-member-${id}`}
                                          onClick={() => setGrpMembers((prev) => prev.filter((x) => x !== id))}
                                          className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 leading-none"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {grpMembers.length === 0 && (
                                <div className="mt-1 mb-2 rounded-lg border border-dashed bg-muted/10 p-2 text-xs text-muted-foreground">
                                  Никто не выбран
                                </div>
                              )}
                              <div className="relative mb-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  data-testid="input-grp-member-search"
                                  placeholder="Поиск сотрудника…"
                                  value={grpMemberSearch}
                                  onChange={(e) => setGrpMemberSearch(e.target.value)}
                                  className="pl-8 h-8 rounded-lg text-sm"
                                />
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                                {activeUsers.filter((u) =>
                                  grpMemberSearch.trim() === "" ||
                                  u.displayName.toLowerCase().includes(grpMemberSearch.toLowerCase()) ||
                                  (u.department || "").toLowerCase().includes(grpMemberSearch.toLowerCase())
                                ).map((u) => (
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
                                {activeUsers.length > 0 && activeUsers.filter((u) =>
                                  grpMemberSearch.trim() === "" ||
                                  u.displayName.toLowerCase().includes(grpMemberSearch.toLowerCase()) ||
                                  (u.department || "").toLowerCase().includes(grpMemberSearch.toLowerCase())
                                ).length === 0 && (
                                  <div className="text-xs text-muted-foreground text-center py-3">Сотрудники не найдены</div>
                                )}
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

                {/* Общая статистика */}
                <Card className="mb-4 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-semibold">Общая статистика базы знаний</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/20 p-4 text-center" data-testid="stat-sections">
                      <div className="text-2xl font-bold">{catalogStats.sections}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Разделов</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/20 p-4 text-center" data-testid="stat-subsections">
                      <div className="text-2xl font-bold">{catalogStats.subsections}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Подразделов</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-primary/5 p-4 text-center" data-testid="stat-materials">
                      <div className="text-2xl font-bold text-primary">{catalogStats.uniqueMaterials}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Материалов всего</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-green-50 p-4 text-center" data-testid="stat-published">
                      <div className="text-2xl font-bold text-green-700">{catalogStats.publishedMaterials}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Опубликовано</div>
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/20 p-4 text-center" data-testid="stat-drafts">
                      <div className="text-2xl font-bold text-muted-foreground">{catalogStats.draftMaterials}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Черновиков</div>
                    </div>
                  </div>
                </Card>

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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {/* Top N helpful */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="text-sm font-semibold">Топ полезных материалов</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">Показать топ</span>
                        <Input
                          data-testid="input-helpful-top-n"
                          type="number"
                          min={1}
                          max={helpfulnessSorted.byHelpful.length || 99}
                          value={helpfulTopN}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1);
                            setHelpfulTopN(v);
                          }}
                          className="w-16 h-7 rounded-lg text-center text-sm px-1"
                        />
                      </div>
                    </div>
                    {helpfulnessSorted.byHelpful.length === 0 ? (
                      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">Голоса ещё не выставлены.</div>
                    ) : (
                      <div className="grid gap-2" data-testid="list-top-helpful">
                        {helpfulnessSorted.byHelpful.slice(0, helpfulTopN).map((m, idx) => {
                          const total = m.stats.helpfulYes + m.stats.helpfulNo;
                          const pct = total > 0 ? Math.round((m.stats.helpfulYes / total) * 100) : 0;
                          return (
                            <Link key={m.id} href={`/materials/${m.materialId}`}>
                              <div className="flex items-center gap-3 rounded-2xl border bg-muted/10 p-3 cursor-pointer transition-all hover:bg-green-50 hover:border-green-200 hover:shadow-sm" data-testid={`row-helpful-${m.id}`}>
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{m.passport.title}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {m.stats.helpfulYes} <span className="text-green-600">👍</span> · {pct}% полезность
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Top N useless */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="h-4 w-4 text-red-500 shrink-0" />
                        <div className="text-sm font-semibold">Топ бесполезных материалов</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">Показать топ</span>
                        <Input
                          data-testid="input-useless-top-n"
                          type="number"
                          min={1}
                          max={helpfulnessSorted.byUseless.length || 99}
                          value={uselessTopN}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1);
                            setUselessTopN(v);
                          }}
                          className="w-16 h-7 rounded-lg text-center text-sm px-1"
                        />
                      </div>
                    </div>
                    {helpfulnessSorted.byUseless.length === 0 ? (
                      <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">Голоса ещё не выставлены.</div>
                    ) : (
                      <div className="grid gap-2" data-testid="list-top-useless">
                        {helpfulnessSorted.byUseless.slice(0, uselessTopN).map((m, idx) => {
                          const total = m.stats.helpfulYes + m.stats.helpfulNo;
                          const pct = total > 0 ? Math.round((m.stats.helpfulNo / total) * 100) : 0;
                          return (
                            <Link key={m.id} href={`/materials/${m.materialId}`}>
                              <div className="flex items-center gap-3 rounded-2xl border bg-muted/10 p-3 cursor-pointer transition-all hover:bg-red-50 hover:border-red-200 hover:shadow-sm" data-testid={`row-useless-${m.id}`}>
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{m.passport.title}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {m.stats.helpfulNo} <span className="text-red-500">👎</span> · {pct}% негативных оценок
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
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
                            <Input id="em-sender-name" data-testid="input-email-sender-name" value={emSenderName} onChange={(e) => setEmSenderName(e.target.value)} placeholder="Центр знаний ЦОС" className="rounded-xl text-sm" />
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

                    {/* ── Test Email ── */}
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Send className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Тестовое письмо</span>
                        <span className="text-xs text-muted-foreground">— проверка работоспособности настроек</span>
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Input
                            data-testid="input-test-email"
                            type="email"
                            placeholder="recipient@example.com"
                            value={testEmailAddress}
                            onChange={(e) => { setTestEmailAddress(e.target.value); setTestEmailResult("idle"); }}
                            className="rounded-xl font-mono text-sm"
                          />
                          {testEmailResult === "ok" && (
                            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400" data-testid="text-test-email-ok">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Письмо успешно отправлено
                            </div>
                          )}
                          {testEmailResult === "error" && (
                            <div className="flex items-center gap-1.5 text-xs text-destructive" data-testid="text-test-email-error">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Ошибка отправки — проверьте SMTP-настройки
                            </div>
                          )}
                        </div>
                        <Button
                          data-testid="button-send-test-email"
                          size="sm"
                          variant="outline"
                          className="rounded-xl shrink-0"
                          disabled={testEmailSending || !testEmailAddress.trim()}
                          onClick={sendTestEmail}
                        >
                          {testEmailSending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {testEmailSending ? "Отправка…" : "Отправить"}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* ── Email Templates ── */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-semibold">Шаблоны уведомлений</div>
                      <Badge variant="secondary" className="kb-chip">{emailTemplates.length}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Переменные шаблона: <code className="bg-muted px-1 py-0.5 rounded">{"{{title}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{owner}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{days}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{dueDate}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{link}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{version}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{recipient}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{reporter}}"}</code>, <code className="bg-muted px-1 py-0.5 rounded">{"{{message}}"}</code>
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={String(notifLimit)} onValueChange={(v) => setNotifLimit(Number(v))}>
                          <SelectTrigger className="w-[160px] rounded-xl" data-testid="select-notif-limit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">Последние 10</SelectItem>
                            <SelectItem value="50">Последние 50</SelectItem>
                            <SelectItem value="100">Последние 100</SelectItem>
                            <SelectItem value="300">Последние 300</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="w-[260px] max-w-full">
                          <Input
                            data-testid="input-mail-search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Фильтр по теме или адресу…"
                            className="rounded-2xl"
                          />
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid gap-2" data-testid="list-mails">
                      {notificationsFiltered.slice(0, notifLimit).map((n) => (
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

              {/* ── AI-помощник ── */}
              <TabsContent value="ai" className="mt-4">
                <AiSettingsTab />
              </TabsContent>

              {/* ── Здоровье базы ── */}
              <TabsContent value="health" className="mt-4">
                <div className="space-y-4">
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
                    <div className="space-y-3">
                      {overdueAll.length > 0 && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <TriangleAlert className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-semibold text-destructive">Просроченные материалы ({overdueAll.length})</span>
                          </div>
                          <div className="space-y-1">
                            {overdueAll.slice(0, 5).map((m) => (
                              <Link key={m.id} href={`/materials/${m.materialId}`}>
                                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-destructive/5 cursor-pointer text-sm">
                                  <FileText className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  <span className="flex-1 line-clamp-1">{m.passport.title}</span>
                                  <Badge variant="destructive" className="text-[9px] shrink-0">Просрочен</Badge>
                                </div>
                              </Link>
                            ))}
                            {overdueAll.length > 5 && (
                              <div className="text-xs text-muted-foreground pl-2">...и ещё {overdueAll.length - 5}</div>
                            )}
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
                  )}

                  <Separator />
                  <div className="rounded-xl border p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Резервная копия базы данных</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        SQL-дамп всех таблиц. Имя файла: <span className="font-mono">AppDB_ЧЧММ_ДДММГГ.dump</span>
                      </div>
                    </div>
                    <a
                      href="/api/admin/db-dump"
                      download
                      data-testid="link-db-dump"
                    >
                      <Button variant="outline" size="sm" className="rounded-lg shrink-0 gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        Выгрузить .dump
                      </Button>
                    </a>
                  </div>

                  <Separator />
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Последние уведомления</div>
                    <div className="space-y-1.5">
                      {notifications.slice(0, 6).map((n) => (
                        <div key={n.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Badge variant={n.status === "FAILED" ? "destructive" : "secondary"} className="text-[9px] px-1.5 py-0 shrink-0 mt-0.5">
                            {n.status}
                          </Badge>
                          <span className="line-clamp-1 flex-1">{n.subject}</span>
                          <span className="text-[10px] shrink-0">{new Date(n.at).toLocaleDateString("ru-RU")}</span>
                        </div>
                      ))}
                      {!notifications.length && (
                        <div className="text-sm text-muted-foreground italic">Нет уведомлений.</div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
