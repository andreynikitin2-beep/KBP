import { useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  FileUp,
  GitBranch,
  Loader2,
  Globe,
  Heart,
  MessageSquareText,
  Save,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AppShell } from "@/components/kb/AppShell";
import { PageViewer } from "@/components/kb/PageViewer";
import { RichEditor } from "@/components/kb/RichEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import { canApproveAndPublish, canConfirmActuality, canCreateNewVersion, canPublishDirectly, canReturnForRevision, canSubmitForApproval, canViewAudit, canViewMaterial, canViewVersion, daysToNextReview, getApprovalStep, getSectionOwnerIds, getSectionPath, isOverdue, validatePassport } from "@/lib/kbLogic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Criticality, MaterialVersion, VisibilityGroup, User } from "@/lib/mockData";
import { api } from "@/lib/api";

function computeAccessLoss(
  oldGroupIds: string[],
  newGroupIds: string[],
  groups: VisibilityGroup[],
  allUsers: User[],
): { count: number; names: string[] } {
  const oldGroups = oldGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);
  const newGroups = newGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);

  const oldHasSystem = oldGroups.some(g => g!.isSystem);
  const newHasSystem = newGroups.some(g => g!.isSystem);

  if (newHasSystem) return { count: 0, names: [] };

  const newMemberSet = new Set<string>();
  for (const g of newGroups) {
    for (const uid of g!.memberIds) newMemberSet.add(uid);
  }

  let usersWithOldAccess: User[];
  if (oldHasSystem) {
    usersWithOldAccess = allUsers.filter(u => !u.deactivatedAt);
  } else {
    const oldMemberSet = new Set<string>();
    for (const g of oldGroups) {
      for (const uid of g!.memberIds) oldMemberSet.add(uid);
    }
    usersWithOldAccess = allUsers.filter(u => !u.deactivatedAt && oldMemberSet.has(u.id));
  }

  const losers = usersWithOldAccess.filter(u =>
    !newMemberSet.has(u.id) && !u.roles.includes("Администратор")
  );

  return {
    count: losers.length,
    names: losers.slice(0, 10).map(u => u.displayName),
  };
}

function computeAccessGain(
  oldGroupIds: string[],
  newGroupIds: string[],
  groups: VisibilityGroup[],
  allUsers: User[],
): { count: number; names: string[] } {
  const oldGroups = oldGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);
  const newGroups = newGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);

  const oldHasSystem = oldGroups.some(g => g!.isSystem);
  const newHasSystem = newGroups.some(g => g!.isSystem);

  if (oldHasSystem) return { count: 0, names: [] };

  const oldMemberSet = new Set<string>();
  for (const g of oldGroups) {
    for (const uid of g!.memberIds) oldMemberSet.add(uid);
  }

  let gainers: User[];
  if (newHasSystem) {
    gainers = allUsers.filter(u =>
      !u.deactivatedAt && !oldMemberSet.has(u.id) && !u.roles.includes("Администратор")
    );
  } else {
    const newMemberSet = new Set<string>();
    for (const g of newGroups) {
      for (const uid of g!.memberIds) newMemberSet.add(uid);
    }
    gainers = allUsers.filter(u =>
      !u.deactivatedAt && !oldMemberSet.has(u.id) && newMemberSet.has(u.id) && !u.roles.includes("Администратор")
    );
  }

  return {
    count: gainers.length,
    names: gainers.slice(0, 10).map(u => u.displayName),
  };
}

function fmt(iso?: string) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: ru });
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy", { locale: ru });
}

export default function MaterialView() {
  const [, params] = useRoute("/materials/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { me, users, materials, setMaterials, rfcs, setRfcs, notifications, setNotifications, confirmActuality, submitForApproval, publishDirect, approveAndPublish, returnForRevision, adminForcePublish, catalogNodes, visibilityGroups, isSubscribed, toggleSubscription, createNewVersion, getAllVersions, policy, rateMaterial, canRateToday, recordView, recordDownload, recordPreview, newHireAssignments, acknowledgeAssignment, newHiresEnabled, archiveMaterial, restoreMaterial } = useKB();
  const isAdmin = me.roles.includes("Администратор");

  const materialId = params?.id || "";
  const allVersions = useMemo(() => getAllVersions(materialId), [getAllVersions, materialId]);
  const current = useMemo(() => {
    const active = allVersions.find((v) => v.status !== "Архив");
    return active || allVersions[0] || null;
  }, [allVersions]);

  const [activeTab, setActiveTab] = useState("passport");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const accessibleVersions = useMemo(() => {
    return allVersions.filter(v => canViewVersion(me, v, visibilityGroups));
  }, [allVersions, me, visibilityGroups]);

  const displayVersion = useMemo(() => {
    if (selectedVersionId) {
      const found = allVersions.find(v => v.id === selectedVersionId);
      if (found && canViewVersion(me, found, visibilityGroups)) return found;
      return current;
    }
    return current;
  }, [selectedVersionId, allVersions, current, me, visibilityGroups]);

  const isViewingOldVersion = displayVersion !== null && current !== null && displayVersion.id !== current.id;

  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewDocxText, setPreviewDocxText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [rfcTitle, setRfcTitle] = useState("");
  const [rfcText, setRfcText] = useState("");
  const [rfcType, setRfcType] = useState<"Проблема" | "Предложение">("Проблема");

  const [publishWarningOpen, setPublishWarningOpen] = useState(false);
  const [publishAction, setPublishAction] = useState<"direct" | "approve" | null>(null);
  const [accessLossInfo, setAccessLossInfo] = useState<{ count: number; names: string[] }>({ count: 0, names: [] });
  const [accessGainInfo, setAccessGainInfo] = useState<{ count: number; names: string[] }>({ count: 0, names: [] });

  const isDraft = current?.status === "Черновик";

  const previousPublished = useMemo(() => {
    return allVersions.find(v => v.id !== current?.id && (v.status === "Опубликовано" || v.status === "Архив" || v.status === "На пересмотре"));
  }, [allVersions, current]);

  const previousVersion = useMemo(() => {
    if (!current) return null;
    const idx = allVersions.findIndex(v => v.id === current.id);
    return allVersions[idx + 1] || null;
  }, [allVersions, current]);

  const [editTitle, setEditTitle] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editCriticality, setEditCriticality] = useState<Criticality>("Средняя");
  const [editSectionId, setEditSectionId] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editDeputyId, setEditDeputyId] = useState<string | undefined>(undefined);
  const [editVisibilityGroupIds, setEditVisibilityGroupIds] = useState<string[]>(["g-base"]);
  const [editTags, setEditTags] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editNewHireRequired, setEditNewHireRequired] = useState(false);
  const [newHireVisWarning, setNewHireVisWarning] = useState(false);

  const [editContentKind, setEditContentKind] = useState<"file" | "page">("file");
  const [editPageHtml, setEditPageHtml] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [editFileType, setEditFileType] = useState<"pdf" | "docx">("pdf");
  const [editExtractedText, setEditExtractedText] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);

  async function handleEditFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const detectedType = ext === "docx" ? "docx" : "pdf";
    setEditFileType(detectedType);
    setEditFileName(file.name);
    if (detectedType === "docx") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setEditExtractedText(result.value);
        toast({ title: "Файл загружен", description: `${file.name} — текст извлечён` });
      } catch {
        toast({ title: "Файл загружен", description: file.name });
      }
    } else {
      toast({ title: "Файл выбран", description: file.name });
    }
    e.target.value = "";
  }

  useEffect(() => {
    if (current) {
      setEditTitle(current.passport.title);
      setEditPurpose(current.passport.purpose || "");
      setEditCriticality(current.passport.criticality);
      setEditSectionId(current.passport.sectionId);
      setEditOwnerId(current.passport.ownerId || "");
      setEditDeputyId(current.passport.deputyId);
      setEditVisibilityGroupIds(current.passport.visibilityGroupIds);
      setEditTags(current.passport.tags.join(", "));
      setEditDepartment(current.passport.department || "");
      setEditNewHireRequired(!!current.passport.newHireRequired);
      setNewHireVisWarning(false);
      setEditContentKind(current.content.kind);
      setEditPageHtml(current.content.page?.html || "");
      setEditFileName(current.content.file?.name || "");
      setEditFileType(current.content.file?.type || "pdf");
      setEditExtractedText(current.content.file?.extractedText || "");
    }
  }, [current?.id]);

  const isFieldChanged = (currentVal: string | undefined, prevVal: string | undefined) => {
    return (currentVal || "") !== (prevVal || "");
  };

  const sectionOptions = useMemo(() => {
    const subs = catalogNodes.filter(n => n.type === "subsection");
    return subs.map(s => {
      const path = getSectionPath(catalogNodes, s.id).map(x => x.title).join(" / ");
      return { id: s.id, label: path };
    });
  }, [catalogNodes]);

  const saveDraft = () => {
    if (!current || !isDraft) return;
    const periodRow = policy.reviewPeriods.find(p => p.criticality === editCriticality);
    const computedNextReview = new Date();
    computedNextReview.setDate(computedNextReview.getDate() + (periodRow?.days ?? 180));

    setMaterials(prev => prev.map(m =>
      m.id === current.id ? {
        ...m,
        passport: {
          ...m.passport,
          title: editTitle,
          purpose: editPurpose || undefined,
          criticality: editCriticality,
          sectionId: editSectionId,
          ownerId: editOwnerId || undefined,
          deputyId: editDeputyId,
          visibilityGroupIds: editVisibilityGroupIds,
          tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
          department: editDepartment || undefined,
          newHireRequired: editNewHireRequired || undefined,
          reviewPeriodDays: periodRow?.days,
          nextReviewAt: computedNextReview.toISOString(),
        },
        content: editContentKind === "file"
          ? { kind: "file" as const, file: { name: editFileName, type: editFileType, extractedText: editExtractedText } }
          : { kind: "page" as const, page: { html: editPageHtml } },
      } : m
    ));
    api.updateMaterialVersionRaw(current.id, {
      title: editTitle,
      purpose: editPurpose || null,
      criticality: editCriticality,
      sectionId: editSectionId,
      ownerId: editOwnerId || null,
      deputyId: editDeputyId || null,
      visibilityGroupIds: editVisibilityGroupIds,
      tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
      department: editDepartment || null,
      reviewPeriodDays: periodRow?.days,
      nextReviewAt: computedNextReview.toISOString(),
      contentKind: editContentKind,
      contentFile: editContentKind === "file" ? { name: editFileName, type: editFileType, extractedText: editExtractedText } : null,
      contentPage: editContentKind === "page" ? { html: editPageHtml } : null,
    }).catch(console.error);
    toast({ title: "Сохранено", description: "Изменения черновика сохранены." });
  };

  useEffect(() => {
    if (!current) return;
    recordView(current.materialId);
  }, [current?.id]);

  const overdue = current ? isOverdue(current) : false;
  const canConfirm = current ? canConfirmActuality(me, current) : false;
  const dueDays = current ? daysToNextReview(current) : null;
  const canRate = current ? canRateToday(current.materialId) : false;

  const canArchiveCurrent = useMemo(() => {
    if (!current || current.status === "Архив") return false;
    if (isAdmin) return true;
    const sectionNode = catalogNodes.find((n) => n.id === current.passport.sectionId);
    if (sectionNode && (sectionNode.ownerIds ?? []).includes(me.id)) return true;
    if (current.passport.ownerId === me.id || current.passport.deputyId === me.id) return true;
    return false;
  }, [current, isAdmin, catalogNodes, me.id]);

  const [nextMinorVersion, nextMajorVersion] = useMemo(() => {
    if (!current) return ["1.1", "2.0"];
    const parts = current.version.split(".");
    const maj = parseInt(parts[0], 10) || 1;
    const min = parseInt(parts[1], 10) || 0;
    return [`${maj}.${min + 1}`, `${maj + 1}.0`];
  }, [current]);

  const editPassportDraft: MaterialVersion["passport"] | null = isDraft ? {
    title: editTitle,
    purpose: editPurpose || undefined,
    tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
    tagGroups: current?.passport.tagGroups || [],
    criticality: editCriticality,
    sectionId: editSectionId,
    ownerId: editOwnerId || undefined,
    deputyId: editDeputyId,
    legalEntity: current?.passport.legalEntity || "",
    department: editDepartment || undefined,
    visibilityGroupIds: editVisibilityGroupIds,
    newHireRequired: editNewHireRequired || undefined,
    reviewPeriodDays: current?.passport.reviewPeriodDays,
    nextReviewAt: current?.passport.nextReviewAt,
    lastReviewedAt: current?.passport.lastReviewedAt,
  } : null;

  const missing = current ? validatePassport(isDraft && editPassportDraft ? editPassportDraft : current.passport) : [];

  const showPublishDirect = current ? canPublishDirectly(me, current) : false;
  const showSubmitForApproval = current ? canSubmitForApproval(me, current) : false;
  const showApprove = current ? canApproveAndPublish(me, current, catalogNodes) : false;
  const showReturn = current ? canReturnForRevision(me, current, catalogNodes) : false;

  const accessAllowed = current ? canViewMaterial(me, current, visibilityGroups) : false;
  const dv = displayVersion || current;
  const materialGroups = dv ? visibilityGroups.filter((g) => dv.passport.visibilityGroupIds.includes(g.id)) : [];
  const hasRestrictedGroups = materialGroups.some(g => !g.isSystem);
  const allSystem = materialGroups.every(g => g.isSystem);
  const owner = dv ? users.find((u) => u.id === dv.passport.ownerId) : null;
  const deputy = dv ? users.find((u) => u.id === dv.passport.deputyId) : null;

  const rfcList = useMemo(() => rfcs.filter((r) => r.materialId === materialId), [rfcs, materialId]);

  const sectionPath = useMemo(() => {
    if (!current) return [];
    return getSectionPath(catalogNodes, current.passport.sectionId);
  }, [current, catalogNodes]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; href?: string }[] = [
      { label: "Центр знаний ЦОС", href: "/" },
      { label: "Каталог", href: "/catalog" },
    ];
    sectionPath.forEach((node) => {
      crumbs.push({ label: node.title });
    });
    if (current) {
      crumbs.push({ label: current.passport.title });
    }
    return crumbs;
  }, [sectionPath, current]);

  if (!current || !accessAllowed) {
    return (
      <AppShell
        title={current ? "Доступ ограничен" : "Материал не найден"}
        breadcrumbs={[
          { label: "Центр знаний ЦОС", href: "/" },
          { label: "Каталог", href: "/catalog" },
        ]}
      >
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">
              {current
                ? "Этот материал доступен только участникам групп видимости «" + materialGroups.map(g => g.title).join("», «") + "». У вас нет доступа."
                : "Материал недоступен или отсутствует."}
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const myAssignment = useMemo(() => {
    if (!newHiresEnabled) return null;
    return newHireAssignments.find(a => a.userId === me.id && a.materialId === materialId && !a.acknowledgedAt) || null;
  }, [newHiresEnabled, newHireAssignments, me.id, materialId]);

  const myAcknowledgedAssignment = useMemo(() => {
    if (!newHiresEnabled) return null;
    return newHireAssignments.find(a => a.userId === me.id && a.materialId === materialId && !!a.acknowledgedAt) || null;
  }, [newHiresEnabled, newHireAssignments, me.id, materialId]);

  return (
    <AppShell
      title={current.passport.title}
      breadcrumbs={breadcrumbs}
      actions={<></>}
    >
      {myAssignment && (
        <Card className="mb-4 border-blue-300 bg-blue-50/50" data-testid="card-onboarding-assignment">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-700">Задание для ознакомления</div>
              <div className="text-sm text-muted-foreground">
                Этот материал назначен вам для ознакомления. После прочтения нажмите кнопку.
              </div>
            </div>
            <Button
              data-testid="btn-acknowledge-material"
              className="rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                acknowledgeAssignment(myAssignment.id, current.id);
                toast({ title: "Ознакомлен", description: "Вы отметили ознакомление с этим материалом." });
              }}
            >
              <BadgeCheck className="h-4 w-4 mr-1" />
              Ознакомлен
            </Button>
          </CardContent>
        </Card>
      )}

      {myAcknowledgedAssignment && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50/50 p-3 text-sm text-green-700 flex items-center gap-2" data-testid="badge-already-acknowledged">
          <BadgeCheck className="h-4 w-4" />
          Вы ознакомились с этим материалом {myAcknowledgedAssignment.acknowledgedAt ? fmt(myAcknowledgedAssignment.acknowledgedAt) : ""}
        </div>
      )}

      {returnDialogOpen && (
        <Card className="mb-4 border-red-300 bg-red-50/50">
          <CardContent className="p-4">
            <div className="font-semibold text-red-700 mb-2">Отклонение публикации</div>
            <div className="text-sm text-muted-foreground mb-3">
              Укажите причину отклонения. Комментарий обязателен и будет отправлен автору. После отклонения повторное согласование этой версии невозможно — автор должен создать новую версию.
            </div>
            <Textarea
              data-testid="textarea-return-comment"
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              placeholder="Укажите причину отклонения…"
              className="min-h-[80px] rounded-xl mb-3"
            />
            <div className="flex gap-2">
              <Button
                data-testid="button-confirm-return"
                variant="default"
                className="rounded-xl bg-red-600 hover:bg-red-700"
                disabled={!returnComment.trim()}
                onClick={() => {
                  const res = returnForRevision(current.id, returnComment);
                  if (!res.ok) {
                    toast({ title: "Ошибка", description: res.message || "", variant: "destructive" });
                  } else {
                    toast({ title: "Публикация отклонена", description: "Автор уведомлён. Для новой попытки потребуется создание новой версии." });
                    setReturnDialogOpen(false);
                    setReturnComment("");
                  }
                }}
              >
                Отклонить публикацию
              </Button>
              <Button
                data-testid="button-cancel-return"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setReturnDialogOpen(false);
                  setReturnComment("");
                }}
              >
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={publishWarningOpen} onOpenChange={setPublishWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ShieldAlert className="h-5 w-5" />
              Изменение видимости
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {accessLossInfo.count > 0 && (
              <>
                <div className="text-sm">
                  После публикации доступ к материалу и всем его предыдущим версиям <span className="font-semibold text-orange-700">потеряют</span>:
                </div>
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="font-semibold text-orange-700">{accessLossInfo.count} {accessLossInfo.count === 1 ? "пользователь" : accessLossInfo.count < 5 ? "пользователя" : "пользователей"}</div>
                  {accessLossInfo.names.length > 0 && (
                    <div className="mt-1 text-sm text-orange-600">
                      {accessLossInfo.names.join(", ")}
                      {accessLossInfo.count > accessLossInfo.names.length && ` и ещё ${accessLossInfo.count - accessLossInfo.names.length}`}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Подписки пользователей, потерявших доступ, будут удалены автоматически.
                </div>
              </>
            )}
            {accessGainInfo.count > 0 && (
              <>
                <div className="text-sm">
                  После публикации доступ к материалу <span className="font-semibold text-green-700">получат</span>:
                </div>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <div className="font-semibold text-green-700">{accessGainInfo.count} {accessGainInfo.count === 1 ? "пользователь" : accessGainInfo.count < 5 ? "пользователя" : "пользователей"}</div>
                  {accessGainInfo.names.length > 0 && (
                    <div className="mt-1 text-sm text-green-600">
                      {accessGainInfo.names.join(", ")}
                      {accessGainInfo.count > accessGainInfo.names.length && ` и ещё ${accessGainInfo.count - accessGainInfo.names.length}`}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPublishWarningOpen(false)}>
              Отмена
            </Button>
            <Button
              data-testid="button-confirm-publish-warning"
              className={`rounded-xl ${accessLossInfo.count > 0 ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}
              onClick={() => {
                setPublishWarningOpen(false);
                if (publishAction === "direct") {
                  const res = publishDirect(current!.id);
                  if (!res.ok) {
                    toast({ title: "Ошибка", description: res.message || "", variant: "destructive" });
                  } else {
                    toast({ title: "Опубликовано", description: "Материал опубликован." });
                  }
                } else if (publishAction === "approve") {
                  const res = approveAndPublish(current!.id);
                  if (!res.ok) {
                    toast({ title: "Ошибка", description: res.message || "", variant: "destructive" });
                  } else {
                    toast({ title: "Согласовано", description: "Материал одобрен и опубликован." });
                  }
                }
              }}
            >
              {accessLossInfo.count > 0 ? "Опубликовать с ограничением" : "Опубликовать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {isViewingOldVersion && displayVersion && (
        <Card className="mb-4 border-amber-400/60 bg-amber-50/40" data-testid="card-old-version-banner">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100/60 p-2 text-amber-600">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-amber-800">
                    Просмотр версии {displayVersion.version} ({displayVersion.status})
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Это не актуальная версия материала. Текущая версия: {current.version}
                  </div>
                </div>
              </div>
              <Button
                data-testid="button-back-to-current"
                variant="outline"
                className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100/50 shrink-0"
                onClick={() => setSelectedVersionId(null)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                К актуальной версии
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {!isViewingOldVersion && overdue ? (
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
      {!isViewingOldVersion && (current.status === "Черновик" || current.status === "На согласовании") && (
        <Card className="mb-4 border-blue-200/60 bg-blue-50/30" data-testid="card-approval-workflow">
          <CardContent className="p-4 bg-[#ede59fc2]">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-100/60 p-2 text-blue-500">
                <FileUp className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#07268fcc]" data-testid="text-approval-title">
                  {current.status === "Черновик" && !current.rejectedAt && "Черновик — ожидает отправки на согласование"}
                  {current.status === "Черновик" && current.rejectedAt && "Публикация отклонена — требуется новая версия"}
                  {current.status === "На согласовании" && getApprovalStep(current) === "material_owner" && "На согласовании — шаг 1: владелец материала"}
                  {current.status === "На согласовании" && getApprovalStep(current) === "section_owner" && "На согласовании — шаг 2: владелец раздела"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground" data-testid="text-approval-hint">
                  {current.status === "Черновик" && !current.rejectedAt && showSubmitForApproval && (
                    <>Нажмите «Запустить согласование» чтобы направить материал на согласование.</>
                  )}
                  {current.status === "Черновик" && !current.rejectedAt && !showSubmitForApproval && (
                    <>Ожидает отправки на согласование автором.</>
                  )}
                  {current.status === "Черновик" && current.rejectedAt && (
                    <>Публикация была отклонена согласующим. Повторная отправка данной версии невозможна — создайте новую версию документа.</>
                  )}
                  {current.status === "На согласовании" && getApprovalStep(current) === "material_owner" && showApprove && (
                    <>Вы — владелец/заместитель материала. Согласуйте публикацию или отклоните с комментарием.</>
                  )}
                  {current.status === "На согласовании" && getApprovalStep(current) === "material_owner" && !showApprove && (
                    <>Ожидает согласования с владельцем материала ({owner?.displayName || "—"}).</>
                  )}
                  {current.status === "На согласовании" && getApprovalStep(current) === "section_owner" && showApprove && (
                    <>Вы — владелец раздела. Согласуйте публикацию или отклоните с комментарием.</>
                  )}
                  {current.status === "На согласовании" && getApprovalStep(current) === "section_owner" && !showApprove && (() => {
                    const sectionOwnerNames = getSectionOwnerIds(current, catalogNodes).map(id => users.find(u => u.id === id)?.displayName).filter(Boolean);
                    return <>Ожидает согласования с владельцем раздела{sectionOwnerNames.length > 0 ? ` (${sectionOwnerNames.join(", ")})` : ""}.</>;
                  })()}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Автор: {users.find((u) => u.id === current.createdBy)?.displayName || "—"}
                  {current.passport.ownerId && <> · Владелец материала: {owner?.displayName || "—"}</>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {showSubmitForApproval && (
                    <Button
                      data-testid="button-submit-approval"
                      variant="ghost"
                      className="rounded-xl bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border border-blue-300/50"
                      onClick={() => {
                        const res = submitForApproval(current.id);
                        if (!res.ok) {
                          toast({ title: "Ошибка", description: res.message || "", variant: "destructive" });
                        } else {
                          const isOwnerOrDeputy = current.createdBy === current.passport.ownerId || current.createdBy === current.passport.deputyId;
                          toast({ title: "Отправлено", description: isOwnerOrDeputy ? "Запрос направлен владельцу раздела." : "Запрос направлен владельцу материала." });
                        }
                      }}
                    >
                      <FileUp className="mr-2 h-4 w-4" />
                      Запустить согласование
                    </Button>
                  )}
                  {showApprove && (
                    <Button
                      data-testid="button-approve-publish"
                      variant="ghost"
                      className="rounded-xl bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/50"
                      onClick={() => {
                        const step = getApprovalStep(current);
                        if (step === "section_owner") {
                          const oldGids = previousPublished?.passport.visibilityGroupIds || ["g-base"];
                          const newGids = current.passport.visibilityGroupIds;
                          const loss = computeAccessLoss(oldGids, newGids, visibilityGroups, users);
                          const gain = computeAccessGain(oldGids, newGids, visibilityGroups, users);
                          if (loss.count > 0 || gain.count > 0) {
                            setAccessLossInfo(loss);
                            setAccessGainInfo(gain);
                            setPublishAction("approve");
                            setPublishWarningOpen(true);
                            return;
                          }
                        }
                        const res = approveAndPublish(current.id);
                        if (!res.ok) {
                          toast({ title: "Ошибка", description: res.message || "", variant: "destructive" });
                        } else if (step === "material_owner") {
                          toast({ title: "Согласовано (шаг 1/2)", description: "Передано на согласование владельцу раздела." });
                        } else {
                          toast({ title: "Согласовано и опубликовано", description: "Материал успешно опубликован." });
                        }
                      }}
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Согласовать публикацию
                    </Button>
                  )}
                  {showReturn && (
                    <Button
                      data-testid="button-return-revision"
                      variant="ghost"
                      className="rounded-xl bg-red-500/15 text-red-600 hover:bg-red-500/25 border border-red-300/50"
                      onClick={() => {
                        setReturnDialogOpen(true);
                        setReturnComment("");
                      }}
                    >
                      <CircleAlert className="mr-2 h-4 w-4" />
                      Отклонить публикацию
                    </Button>
                  )}
                  {me.roles.includes("Администратор") && (
                    <Button
                      data-testid="button-force-publish"
                      variant="ghost"
                      className="rounded-xl bg-red-500/15 text-red-600 hover:bg-red-500/25 border border-red-300/50"
                      onClick={() => {
                        const comment = prompt("Введите обязательный комментарий для принудительной публикации:");
                        if (!comment) {
                          toast({ title: "Ошибка", description: "Комментарий обязателен", variant: "destructive" });
                          return;
                        }
                        const res = adminForcePublish(current.id, comment);
                        if (res.ok) {
                          toast({ title: "Принудительно опубликовано", description: "Запись в аудит добавлена." });
                        } else {
                          toast({ title: "Ошибка", description: res.message, variant: "destructive" });
                        }
                      }}
                    >
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Принудительно опубликовать
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isViewingOldVersion && current.status === "Опубликовано" && canConfirm && (
        <Card className="mb-4 border-emerald-200/60 bg-emerald-50/30" data-testid="card-confirm-actuality">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100/60 p-2 text-emerald-500">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-emerald-700/80">Подтверждение актуальности</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Подтвердите, что материал актуален. Дата следующего пересмотра будет пересчитана автоматически.
                </div>
                <div className="mt-3">
                  <Button
                    data-testid="button-confirm-actuality"
                    variant="ghost"
                    className="rounded-xl bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 border border-emerald-300/50"
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
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isViewingOldVersion && current.status === "На пересмотре" && (canConfirm || me.roles.includes("Администратор")) && (
        <Card className="mb-4 border-amber-200/60 bg-amber-50/30" data-testid="card-review-actions">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100/60 p-2 text-amber-500">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-amber-700/80">На пересмотре</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Материал требует пересмотра. Подтвердите актуальность или обновите содержание.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canConfirm && (
                    <Button
                      data-testid="button-confirm-actuality-review"
                      variant="ghost"
                      className="rounded-xl bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 border border-emerald-300/50"
                      onClick={() => {
                        const res = confirmActuality(current.id);
                        if (!res.ok) {
                          toast({ title: "Не удалось", description: res.message || "", variant: "destructive" });
                        } else {
                          toast({ title: "Готово", description: "Актуальность подтверждена." });
                        }
                      }}
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Подтвердить актуальность
                    </Button>
                  )}
                  {me.roles.includes("Администратор") && (
                    <Button
                      data-testid="button-force-publish-review"
                      variant="ghost"
                      className="rounded-xl bg-red-500/15 text-red-600 hover:bg-red-500/25 border border-red-300/50"
                      onClick={() => {
                        const comment = prompt("Введите обязательный комментарий для принудительной публикации:");
                        if (!comment) {
                          toast({ title: "Ошибка", description: "Комментарий обязателен", variant: "destructive" });
                          return;
                        }
                        const res = adminForcePublish(current.id, comment);
                        if (res.ok) {
                          toast({ title: "Принудительно опубликовано", description: "Запись в аудит добавлена." });
                        } else {
                          toast({ title: "Ошибка", description: res.message, variant: "destructive" });
                        }
                      }}
                    >
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Принудительно опубликовать
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="overflow-hidden relative">
            {isViewingOldVersion && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden" aria-hidden="true">
                <div className="text-[64px] font-bold text-red-500/[0.07] whitespace-nowrap select-none" style={{ transform: "rotate(-30deg)" }}>
                  Неактуальная версия · Неактуальная версия · Неактуальная версия
                </div>
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="kb-chip" variant={dv.status === "Опубликовано" ? "default" : "secondary"} data-testid="status-material">
                  {dv.status}
                </Badge>
                <Badge className="kb-chip" variant="secondary" data-testid="badge-version">
                  Версия {dv.version}
                </Badge>
                <Badge className="kb-chip" variant="outline" data-testid="badge-criticality">
                  {dv.passport.criticality}
                </Badge>
                {materialGroups.filter(g => !g.isSystem).map(g => (
                  <Badge key={g.id} className="kb-chip" variant="secondary" data-testid={`badge-visibility-group-${g.id}`}>
                    <Users className="mr-1 h-3.5 w-3.5" />
                    {g.title}
                  </Badge>
                ))}
                {!isViewingOldVersion && dueDays !== null ? (
                  <Badge className="kb-chip" variant={dueDays < 0 ? "destructive" : "secondary"} data-testid="badge-review-due">
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                    {dueDays < 0 ? `Просрочено на ${Math.abs(dueDays)} дн.` : `Пересмотр через ${dueDays} дн.`}
                  </Badge>
                ) : null}
                {!isViewingOldVersion && canArchiveCurrent && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        data-testid="button-archive-material"
                        variant="outline"
                        size="sm"
                        className="ml-auto rounded-xl text-slate-600 border-slate-300 hover:bg-slate-100 hover:text-slate-800 gap-1.5"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        В архив
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Переместить в архив?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Материал «{current.passport.title}» будет перемещён в архив. Он исчезнет из каталога и станет недоступен для всех сотрудников. Восстановить материал можно из раздела «Архив».
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-xl bg-slate-700 hover:bg-slate-800"
                          onClick={() => {
                            const res = archiveMaterial(current.materialId);
                            if (res.ok) {
                              toast({ title: "Перемещено в архив", description: `«${current.passport.title}» добавлен в архив` });
                              setLocation("/archive");
                            } else {
                              toast({ title: "Ошибка", description: res.message, variant: "destructive" });
                            }
                          }}
                        >
                          В архив
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {!isViewingOldVersion && (
                  <button
                    data-testid="button-toggle-subscription"
                    className={`${canArchiveCurrent ? "" : "ml-auto"} p-1 rounded-full hover:bg-muted/50 transition-colors`}
                    onClick={() => toggleSubscription(current.materialId)}
                    title={isSubscribed(current.materialId) ? "Отписаться" : "Подписаться"}
                  >
                    <Heart
                      className={`h-5 w-5 transition-colors ${
                        isSubscribed(current.materialId)
                          ? "fill-red-500 text-red-500"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  {isAdmin && (
                    <TabsTrigger data-testid="tab-rfc" value="rfc">
                      RFC
                    </TabsTrigger>
                  )}
                  {isAdmin && (
                    <TabsTrigger data-testid="tab-discussions" value="discussions">
                      Обсуждения
                    </TabsTrigger>
                  )}
                  <TabsTrigger data-testid="tab-audit" value="audit">
                    Аудит
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="passport" className="mt-4">
                  {isDraft && !isViewingOldVersion ? (
                    <div className="space-y-4">
                      {previousVersion && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 text-sm text-muted-foreground flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-blue-500" />
                          Редактирование черновика версии {current.version} на основе версии {previousVersion.version}.
                          <span className="text-xs">Изменённые поля выделены <span className="text-foreground font-semibold">жирным чёрным</span></span>
                        </div>
                      )}

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

                      <div className="grid gap-4">
                        <div>
                          <Label htmlFor="edit-title">Название (обязательно)</Label>
                          <Input
                            id="edit-title"
                            data-testid="input-edit-title"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            placeholder="Название материала"
                            className={`mt-1 rounded-xl ${isFieldChanged(editTitle, previousVersion?.passport.title) ? 'text-foreground' : 'text-muted-foreground'}`}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-purpose">Назначение</Label>
                          <Textarea
                            id="edit-purpose"
                            data-testid="textarea-edit-purpose"
                            value={editPurpose}
                            onChange={e => setEditPurpose(e.target.value)}
                            placeholder="Кому и для чего нужна инструкция…"
                            className={`mt-1 min-h-[90px] rounded-xl ${isFieldChanged(editPurpose, previousVersion?.passport.purpose) ? 'text-foreground' : 'text-muted-foreground'}`}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label>Критичность</Label>
                            <Select value={editCriticality} onValueChange={v => setEditCriticality(v as Criticality)}>
                              <SelectTrigger data-testid="select-edit-criticality" className={`mt-1 rounded-xl ${isFieldChanged(editCriticality, previousVersion?.passport.criticality) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Низкая">Низкая</SelectItem>
                                <SelectItem value="Средняя">Средняя</SelectItem>
                                <SelectItem value="Высокая">Высокая</SelectItem>
                                <SelectItem value="Критическая">Критическая</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Раздел / подраздел</Label>
                            <Select value={editSectionId} onValueChange={v => setEditSectionId(v)}>
                              <SelectTrigger data-testid="select-edit-section" className={`mt-1 rounded-xl ${isFieldChanged(editSectionId, previousVersion?.passport.sectionId) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <SelectValue placeholder="Выберите…" />
                              </SelectTrigger>
                              <SelectContent>
                                {sectionOptions.map(o => (
                                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label>Владелец</Label>
                            <Select value={editOwnerId} onValueChange={v => setEditOwnerId(v)}>
                              <SelectTrigger data-testid="select-edit-owner" className={`mt-1 rounded-xl ${isFieldChanged(editOwnerId, previousVersion?.passport.ownerId) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {users.filter(u => !u.deactivatedAt).map(u => (
                                  <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Заместитель</Label>
                            <Select value={editDeputyId || "none"} onValueChange={v => setEditDeputyId(v === "none" ? undefined : v)}>
                              <SelectTrigger data-testid="select-edit-deputy" className={`mt-1 rounded-xl ${isFieldChanged(editDeputyId, previousVersion?.passport.deputyId) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <SelectValue placeholder="Не выбран" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Не выбран</SelectItem>
                                {users.filter(u => !u.deactivatedAt).map(u => (
                                  <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label>Группы видимости</Label>
                          {newHireVisWarning && (
                            <div className="mt-1 mb-1 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="alert-newhire-vis-warning">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <span>Группа видимости автоматически изменена на «Базовая» — материалы для новых сотрудников должны быть доступны всем пользователям.</span>
                            </div>
                          )}
                          <div className="mt-1 rounded-xl border p-3 space-y-2 max-h-48 overflow-y-auto">
                            {visibilityGroups.map(g => {
                              const lockedByNewHire = editNewHireRequired && g.id !== "g-base";
                              return (
                                <label key={g.id} className={`flex items-center gap-2 text-sm ${lockedByNewHire ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                                  <Checkbox
                                    data-testid={`checkbox-edit-vis-group-${g.id}`}
                                    checked={editVisibilityGroupIds.includes(g.id)}
                                    disabled={lockedByNewHire}
                                    onCheckedChange={(checked) => {
                                      if (lockedByNewHire) return;
                                      if (checked) {
                                        setEditVisibilityGroupIds(prev => [...prev, g.id]);
                                      } else {
                                        setEditVisibilityGroupIds(prev => prev.filter(id => id !== g.id));
                                      }
                                    }}
                                  />
                                  <span>{g.title}{g.isSystem ? " (все пользователи)" : ""}</span>
                                </label>
                              );
                            })}
                          </div>
                          {editNewHireRequired && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Инструкции для новых сотрудников доступны только в группе «Базовая». Другие группы заблокированы.
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              data-testid="checkbox-edit-new-hire-required"
                              checked={editNewHireRequired}
                              onCheckedChange={(checked) => {
                                const isChecked = !!checked;
                                setEditNewHireRequired(isChecked);
                                if (isChecked) {
                                  const isAlreadyBaseOnly = editVisibilityGroupIds.length === 1 && editVisibilityGroupIds[0] === "g-base";
                                  if (!isAlreadyBaseOnly) {
                                    setEditVisibilityGroupIds(["g-base"]);
                                    setNewHireVisWarning(true);
                                  }
                                } else {
                                  setNewHireVisWarning(false);
                                }
                              }}
                            />
                            <span className="text-sm font-medium">Требуется ознакомление для новых сотрудников</span>
                          </label>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Материал будет автоматически назначен новым сотрудникам при адаптации.
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="edit-tags">Теги</Label>
                          <Input
                            id="edit-tags"
                            data-testid="input-edit-tags"
                            value={editTags}
                            onChange={e => setEditTags(e.target.value)}
                            placeholder="Через запятую: vpn, доступ…"
                            className={`mt-1 rounded-xl ${isFieldChanged(editTags, previousVersion?.passport.tags.join(", ")) ? 'text-foreground' : 'text-muted-foreground'}`}
                          />
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {editTags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                              <Badge key={t} variant="secondary" className="kb-chip">{t}</Badge>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Статус: <span className="font-semibold">Черновик</span> · Версия {current.version}
                          </div>
                          <Button
                            data-testid="button-save-draft"
                            className="rounded-xl"
                            onClick={saveDraft}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Сохранить черновик
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="text-xs text-muted-foreground">Группы видимости</div>
                          </div>
                          <div className="mt-1 space-y-1">
                            {materialGroups.length === 0 && <span className="font-semibold" data-testid="text-visibility-group">—</span>}
                            {materialGroups.map(g => (
                              <div key={g.id} className="flex items-center gap-2" data-testid={`text-visibility-group-${g.id}`}>
                                <span className="font-semibold">{g.title}</span>
                                {g.isSystem && <Badge variant="secondary" className="text-[10px]">Системная</Badge>}
                                {!g.isSystem && <Badge variant="outline" className="text-[10px]">{g.memberIds.length} уч.</Badge>}
                              </div>
                            ))}
                          </div>
                          {hasRestrictedGroups && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Материал виден только участникам выбранных групп
                            </div>
                          )}
                        </Card>
                        <Card className="p-4 md:col-span-2">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <div className="text-xs text-muted-foreground">Последний пересмотр</div>
                              <div className="mt-1 font-semibold" data-testid="text-last-review">
                                {fmtDate(dv.passport.lastReviewedAt)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Следующий пересмотр</div>
                              <div className="mt-1 font-semibold" data-testid="text-next-review">
                                {fmtDate(dv.passport.nextReviewAt)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Период (по критичности)</div>
                              <div className="mt-1 font-semibold" data-testid="text-review-period">
                                {dv.passport.reviewPeriodDays ? `${dv.passport.reviewPeriodDays} дн.` : "—"}
                              </div>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Теги</div>
                          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags">
                            {dv.passport.tags.map((t) => (
                              <Badge key={t} variant="secondary" className="kb-chip" data-testid={`badge-tag-${t}`}>
                                {t}
                              </Badge>
                            ))}
                            {dv.passport.newHireRequired && (
                              <Badge variant="default" className="kb-chip bg-blue-600" data-testid="badge-new-hire-required">
                                Для новых сотрудников
                              </Badge>
                            )}
                          </div>
                          <Separator className="my-3" />
                          <div className="text-xs text-muted-foreground">Группы тегов</div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2" data-testid="list-tag-groups">
                            {dv.passport.tagGroups.map((g) => (
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
                        <Card className="p-4 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Автор версии {dv.version}</div>
                          <div className="mt-1 font-semibold" data-testid="text-version-author">
                            {users.find((u) => u.id === dv.createdBy)?.displayName || "—"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {users.find((u) => u.id === dv.createdBy)?.email || ""}
                            {dv.createdAt && (
                              <span className="ml-2 text-muted-foreground/70">· создана {fmtDate(dv.createdAt)}</span>
                            )}
                          </div>
                        </Card>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="content" className="mt-4">
                  {isDraft && !isViewingOldVersion ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          data-testid="button-edit-kind-file"
                          type="button"
                          variant={editContentKind === "file" ? "default" : "outline"}
                          className="rounded-xl"
                          onClick={() => setEditContentKind("file")}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Файл (PDF/DOCX)
                        </Button>
                        <Button
                          data-testid="button-edit-kind-page"
                          type="button"
                          variant={editContentKind === "page" ? "default" : "outline"}
                          className="rounded-xl"
                          onClick={() => setEditContentKind("page")}
                        >
                          <Globe className="mr-2 h-4 w-4" />
                          Страница портала
                        </Button>
                      </div>

                      {editContentKind === "file" ? (
                        <Card className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm font-semibold">Загрузка файла</div>
                          </div>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept=".pdf,.docx"
                            className="hidden"
                            onChange={handleEditFileSelect}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-xl border-dashed h-16 flex-col gap-1"
                            data-testid="button-pick-edit-file"
                            onClick={() => editFileInputRef.current?.click()}
                          >
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {editFileName ? editFileName : "Выбрать файл PDF или DOCX…"}
                            </span>
                          </Button>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <Label>Тип</Label>
                              <Select value={editFileType} onValueChange={v => setEditFileType(v as "pdf" | "docx")}>
                                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pdf">PDF</SelectItem>
                                  <SelectItem value="docx">DOCX</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="edit-file-name">Имя файла</Label>
                              <Input
                                id="edit-file-name"
                                data-testid="input-edit-file-name"
                                value={editFileName}
                                onChange={e => setEditFileName(e.target.value)}
                                placeholder="Файл не выбран"
                                className="mt-1 rounded-xl"
                              />
                            </div>
                          </div>
                        </Card>
                      ) : (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm font-semibold">Редактор страницы</div>
                          </div>
                          <RichEditor content={editPageHtml} onChange={setEditPageHtml} />
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button data-testid="button-save-content" className="rounded-xl" onClick={saveDraft}>
                          <Save className="mr-2 h-4 w-4" />
                          Сохранить контент
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {dv.content.kind === "file" ? (
                        <div className="space-y-3">
                          <Card className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-accent/50 p-2">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold" data-testid="text-file-name">
                                    {dv.content.file?.name}
                                  </div>
                                  {isViewingOldVersion && (
                                    <div className="text-xs text-amber-600 font-medium">
                                      Скачается как: {(() => {
                                        const n = dv.content.file?.name || "file";
                                        const ext = n.includes(".") ? "." + n.split(".").pop() : "";
                                        const base = n.includes(".") ? n.slice(0, n.lastIndexOf(".")) : n;
                                        return `${base} версия №${dv.version} НЕАКТУАЛЬНАЯ${ext}`;
                                      })()}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">{dv.content.file?.type?.toUpperCase?.() ?? "Файл"}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  data-testid="button-preview"
                                  variant="outline"
                                  className="rounded-xl"
                                  disabled={previewLoading}
                                  onClick={async () => {
                                    setPreviewLoading(true);
                                    try {
                                      const resp = await fetch(`/api/material-versions/${dv.id}/file?inline=true`);
                                      if (!resp.ok) throw new Error("Ошибка загрузки файла");
                                      const blob = await resp.blob();
                                      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                                      const url = URL.createObjectURL(blob);
                                      setPreviewBlobUrl(url);
                                      if (dv.content.file?.type === "docx") {
                                        try {
                                          const arrayBuffer = await blob.arrayBuffer();
                                          const result = await mammoth.extractRawText({ arrayBuffer });
                                          setPreviewDocxText(result.value);
                                        } catch {
                                          setPreviewDocxText(dv.content.file?.extractedText || null);
                                        }
                                      }
                                      setPreviewOpen(true);
                                      recordPreview(dv.materialId);
                                    } catch {
                                      toast({ title: "Ошибка", description: "Не удалось загрузить файл для предпросмотра", variant: "destructive" });
                                    } finally {
                                      setPreviewLoading(false);
                                    }
                                  }}
                                >
                                  {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                  Предпросмотр
                                </Button>
                                <Button
                                  data-testid="button-download"
                                  variant="secondary"
                                  className="rounded-xl"
                                  onClick={() => {
                                    const originalName = dv.content.file?.name || "file";
                                    const ext = originalName.includes(".") ? "." + originalName.split(".").pop() : "";
                                    const baseName = originalName.includes(".") ? originalName.slice(0, originalName.lastIndexOf(".")) : originalName;
                                    const downloadName = isViewingOldVersion
                                      ? `${baseName} версия №${dv.version} НЕАКТУАЛЬНАЯ${ext}`
                                      : originalName;
                                    const a = document.createElement("a");
                                    a.href = `/api/material-versions/${dv.id}/file`;
                                    a.download = downloadName;
                                    a.click();
                                    recordDownload(dv.materialId);
                                    toast({ title: "Скачивание", description: `Файл: ${downloadName}` });
                                  }}
                                >
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Скачать
                                </Button>
                              </div>
                            </div>
                          </Card>

                        </div>
                      ) : (
                        <PageViewer html={dv.content.page?.html || ""} materialId={dv.materialId} />
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="mt-4">
                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                        <GitBranch className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold" data-testid="text-version-rule">
                          Правило версий
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Опубликованную версию нельзя редактировать напрямую. Создайте новую версию — предыдущая автоматически отправится в архив, а история сохранится.
                        </div>
                      </div>
                      {(current.status === "Опубликовано" || current.status === "На пересмотре") && canCreateNewVersion(me, current, allVersions) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button data-testid="button-create-new-version" className="rounded-xl shrink-0">
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              Создать новую версию
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              data-testid="button-create-minor-version"
                              onClick={() => {
                                const res = createNewVersion(current.materialId, false);
                                if (res.ok) {
                                  toast({ title: "Новая версия создана", description: `Версия ${res.version?.version} создана как черновик.` });
                                  setActiveTab("passport");
                                } else {
                                  toast({ title: "Ошибка", description: res.message, variant: "destructive" });
                                }
                              }}
                            >
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              Минорная версия — {nextMinorVersion}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              data-testid="button-create-major-version"
                              onClick={() => {
                                const res = createNewVersion(current.materialId, true);
                                if (res.ok) {
                                  toast({ title: "Новая версия создана", description: `Версия ${res.version?.version} создана как черновик.` });
                                  setActiveTab("passport");
                                } else {
                                  toast({ title: "Ошибка", description: res.message, variant: "destructive" });
                                }
                              }}
                            >
                              <GitBranch className="mr-2 h-4 w-4" />
                              Мажорная версия — {nextMajorVersion}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2" data-testid="list-versions">
                    {accessibleVersions.map((v, idx) => {
                      const author = users.find((u) => u.id === v.createdBy);
                      const isCurrent = v.id === current.id;
                      const isSelected = selectedVersionId === v.id;
                      const isViewing = isViewingOldVersion && isSelected;
                      return (
                        <div
                          key={v.id}
                          className={`rounded-2xl border p-4 transition cursor-pointer hover:border-primary/30 ${isCurrent ? "border-primary/40 bg-primary/5" : isViewing ? "border-amber-400/60 bg-amber-50/30 ring-1 ring-amber-300/40" : "bg-muted/20"}`}
                          data-testid={`row-version-${v.id}`}
                          onClick={() => {
                            if (isCurrent) {
                              setSelectedVersionId(null);
                            } else {
                              setSelectedVersionId(v.id);
                              setActiveTab("passport");
                            }
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold">Версия {v.version}</div>
                              {isCurrent && (
                                <Badge variant="default" className="kb-chip text-[10px]">Текущая</Badge>
                              )}
                              {isViewing && (
                                <Badge variant="outline" className="kb-chip text-[10px] border-amber-400 text-amber-700">Просмотр</Badge>
                              )}
                              <Badge
                                variant={v.status === "Опубликовано" ? "default" : v.status === "Архив" ? "outline" : "secondary"}
                                className="kb-chip text-[10px]"
                              >
                                {v.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isCurrent && (
                                <Button
                                  data-testid={`button-view-version-${v.id}`}
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-xl text-xs h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedVersionId(v.id);
                                    setActiveTab("passport");
                                  }}
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  Просмотр
                                </Button>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {fmt(v.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            Автор: {author?.displayName || "—"}
                          </div>
                          {v.changelog && (
                            <div className="mt-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                              <span className="font-medium">Изменения:</span> {v.changelog}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{v.stats.views} просмотров</span>
                            <span>·</span>
                            <span>{v.stats.helpfulYes} полезно</span>
                          </div>
                        </div>
                      );
                    })}
                    {accessibleVersions.length === 0 && (
                      <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
                        Нет версий
                      </div>
                    )}
                  </div>
                </TabsContent>

                {isAdmin && (<TabsContent value="rfc" className="mt-4">
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

                            const to = users.find((u) => u.id === assignedTo)?.email || "unknown@demo.local";
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
                            const who = users.find((u) => u.id === r.createdBy)?.displayName || r.createdBy;
                            const ass = users.find((u) => u.id === r.assignedTo)?.displayName || r.assignedTo;
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
                </TabsContent>)}

                {isAdmin && (<TabsContent value="discussions" className="mt-4">
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
                </TabsContent>)}

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
                            {dv.auditViews.length}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2" data-testid="list-audit">
                          {dv.auditViews.length === 0 && (
                            <div className="text-sm text-muted-foreground">Просмотров не зафиксировано</div>
                          )}
                          {dv.auditViews.slice(0, 20).map((v, idx) => {
                            const who = users.find((u) => u.id === v.userId)?.displayName || v.userId;
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

                      {dv.content.kind === "file" && (
                        <>
                          <Card className="p-4">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm font-semibold">Аудит предпросмотров</div>
                              <Badge variant="secondary" className="kb-chip" data-testid="badge-preview-audit-count">
                                {(dv.auditPreviews || []).length}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2" data-testid="list-preview-audit">
                              {(dv.auditPreviews || []).length === 0 && (
                                <div className="text-sm text-muted-foreground">Предпросмотров не зафиксировано</div>
                              )}
                              {(dv.auditPreviews || []).slice(0, 20).map((p, idx) => {
                                const who = users.find((u) => u.id === p.userId)?.displayName || p.userId;
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-2"
                                    data-testid={`row-preview-audit-${idx}`}
                                  >
                                    <div className="text-sm">{who}</div>
                                    <div className="text-xs text-muted-foreground">{fmt(p.at)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>

                          <Card className="p-4">
                            <div className="flex items-center gap-2">
                              <FileDown className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm font-semibold">Аудит скачиваний</div>
                              <Badge variant="secondary" className="kb-chip" data-testid="badge-download-audit-count">
                                {(dv.auditDownloads || []).length}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2" data-testid="list-download-audit">
                              {(dv.auditDownloads || []).length === 0 && (
                                <div className="text-sm text-muted-foreground">Скачиваний не зафиксировано</div>
                              )}
                              {(dv.auditDownloads || []).slice(0, 20).map((d, idx) => {
                                const who = users.find((u) => u.id === d.userId)?.displayName || d.userId;
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between rounded-2xl border bg-muted/20 px-3 py-2"
                                    data-testid={`row-download-audit-${idx}`}
                                  >
                                    <div className="text-sm">{who}</div>
                                    <div className="text-xs text-muted-foreground">{fmt(d.at)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        </>
                      )}

                      {(() => {
                        const materialAssignments = newHireAssignments.filter(a => a.materialId === materialId);
                        if (materialAssignments.length === 0) return null;
                        return (
                          <Card className="p-4" data-testid="card-newhire-audit">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm font-semibold">Ознакомление новыми сотрудниками</div>
                              <Badge variant="secondary" className="kb-chip" data-testid="badge-newhire-audit-count">
                                {materialAssignments.length}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2" data-testid="list-newhire-audit">
                              {materialAssignments.map((assignment) => {
                                const assignedUser = users.find(u => u.id === assignment.userId);
                                const userName = assignedUser?.displayName || assignment.userId;
                                const isAcknowledged = !!assignment.acknowledgedAt;
                                const hasAccess = assignedUser
                                  ? canViewMaterial(assignedUser, dv, visibilityGroups)
                                  : false;

                                const ackVersion = assignment.acknowledgedVersionId
                                  ? getAllVersions(materialId).find(v => v.id === assignment.acknowledgedVersionId)
                                  : null;

                                let bgClass: string;
                                let statusText: string;
                                if (isAcknowledged) {
                                  bgClass = "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
                                  statusText = "Ознакомлен";
                                } else if (hasAccess) {
                                  bgClass = "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
                                  statusText = "Не ознакомлен";
                                } else {
                                  bgClass = "bg-gray-100 border-gray-200 dark:bg-gray-800/40 dark:border-gray-700";
                                  statusText = "Нет доступа сейчас";
                                }

                                return (
                                  <div
                                    key={assignment.id}
                                    className={`rounded-2xl border px-3 py-2.5 ${bgClass}`}
                                    data-testid={`row-newhire-audit-${assignment.id}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-medium">{userName}</div>
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] ${
                                          isAcknowledged
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                            : hasAccess
                                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                        }`}
                                        data-testid={`badge-newhire-status-${assignment.id}`}
                                      >
                                        {statusText}
                                      </Badge>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                      {ackVersion && <span>Версия: {ackVersion.version}</span>}
                                      <span>Назначен: {fmt(assignment.assignedAt)}</span>
                                      <span>Ознакомлен: {isAcknowledged ? fmt(assignment.acknowledgedAt!) : "—"}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        );
                      })()}
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
                  {dv.stats.views}
                </div>
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">Оценка</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    data-testid="button-helpful-yes"
                    variant="secondary"
                    className="rounded-xl"
                    disabled={isViewingOldVersion || !canRate}
                    title={!canRate ? "Вы уже оценили сегодня" : undefined}
                    onClick={() => {
                      const res = rateMaterial(current.materialId, "helpful");
                      toast({ title: res.ok ? "Спасибо" : "Ограничение", description: res.ok ? "Отметили: помогло" : res.message || "" });
                    }}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Помогло
                  </Button>
                  <Button
                    data-testid="button-helpful-no"
                    variant="outline"
                    className="rounded-xl"
                    disabled={isViewingOldVersion || !canRate}
                    title={!canRate ? "Вы уже оценили сегодня" : undefined}
                    onClick={() => {
                      const res = rateMaterial(current.materialId, "not_helpful");
                      toast({ title: res.ok ? "Принято" : "Ограничение", description: res.ok ? "Отметили: не помогло" : res.message || "" });
                    }}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    Не помогло
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground" data-testid="text-helpful-stats">
                  Помогло: {dv.stats.helpfulYes} · Не помогло: {dv.stats.helpfulNo}
                </div>
                {!canRate && <div className="text-xs text-amber-600 mt-1">Оценка уже поставлена сегодня</div>}
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                    <CircleAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">RBAC и доступ</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Кнопка «Подтвердить актуальность» — только для владельца/заместителя/модератора.
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
      {/* Диалог предпросмотра файла */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
            setPreviewDocxText(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-full p-0 gap-0 overflow-hidden" style={{ height: "90vh", display: "flex", flexDirection: "column" }}>
          <DialogHeader className="px-5 pt-4 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{dv?.content.file?.name}</span>
              <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground pr-6">
                {dv?.content.file?.type?.toUpperCase()}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div style={{ flex: 1, minHeight: 0, padding: "12px" }}>
            {dv?.content.file?.type === "pdf" && previewBlobUrl ? (
              <iframe
                data-testid="iframe-preview-pdf"
                src={previewBlobUrl}
                title={dv.content.file?.name}
                style={{ width: "100%", height: "100%", border: "1px solid #e5e7eb", borderRadius: "12px", display: "block" }}
              />
            ) : dv?.content.file?.type === "docx" ? (
              <div style={{ height: "100%", overflowY: "auto" }} className="rounded-xl border bg-muted/20 p-4" data-testid="div-preview-docx">
                <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">DOCX — извлечённый текст</span>
                  <span>Полный рендеринг DOCX недоступен в браузере. Скачайте файл для просмотра форматирования.</span>
                </div>
                {previewDocxText ? (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{previewDocxText}</pre>
                ) : (
                  <div className="text-sm text-muted-foreground">Текст не извлечён. Скачайте файл для просмотра.</div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Предпросмотр недоступен для данного типа файла.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
