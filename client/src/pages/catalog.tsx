import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, Edit2, Folder, Lock, Plus, Search, Tag, Trash2, UserCog, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import { withinScope } from "@/lib/kbLogic";
import type { CatalogNode } from "@/lib/mockData";

const statusColor: Record<string, string> = {
  "Черновик": "bg-gray-100 text-gray-700",
  "На согласовании": "bg-yellow-100 text-yellow-800",
  "Опубликовано": "bg-green-100 text-green-800",
  "На пересмотре": "bg-orange-100 text-orange-800",
  "Архив": "bg-slate-100 text-slate-600",
};

const critColor: Record<string, string> = {
  "Критическая": "bg-red-100 text-red-700",
  "Высокая": "bg-orange-100 text-orange-700",
  "Средняя": "bg-yellow-100 text-yellow-700",
  "Низкая": "bg-blue-100 text-blue-700",
};

export default function Catalog() {
  const { toast } = useToast();
  const {
    me, users, visibleMaterials: materials, catalogNodes,
    setSectionOwners, addSection, renameSection, deleteSection,
    addSubsection, renameSubsection, deleteSubsection,
  } = useKB();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ownerDialog, setOwnerDialog] = useState<CatalogNode | null>(null);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [addSubDialog, setAddSubDialog] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ id: string; title: string } | null>(null);
  const [addSectionDialog, setAddSectionDialog] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [renameSectionDialog, setRenameSectionDialog] = useState<{ id: string; title: string } | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "popularity" | "criticality" | "status" | "review">("date");

  const critOrder: Record<string, number> = { "Критическая": 0, "Высокая": 1, "Средняя": 2, "Низкая": 3 };
  const statusOrder: Record<string, number> = { "Опубликовано": 0, "На пересмотре": 1, "На согласовании": 2, "Черновик": 3, "Архив": 4 };

  const sortMats = (list: typeof materials) => {
    const arr = [...list];
    switch (sortBy) {
      case "date": return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case "popularity": return arr.sort((a, b) => b.stats.views - a.stats.views);
      case "criticality": return arr.sort((a, b) => (critOrder[a.passport.criticality] ?? 9) - (critOrder[b.passport.criticality] ?? 9));
      case "status": return arr.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
      case "review": return arr.sort((a, b) => {
        const aDate = a.passport.nextReviewAt ? +new Date(a.passport.nextReviewAt) : Infinity;
        const bDate = b.passport.nextReviewAt ? +new Date(b.passport.nextReviewAt) : Infinity;
        return aDate - bDate;
      });
      default: return arr;
    }
  };

  const isAdmin = me.roles.includes("Администратор");
  const canCreateMaterial = me.roles.some(r => r === "Автор" || r === "Владелец" || r === "Заместитель владельца" || r === "Администратор");

  const sections = useMemo(() => catalogNodes.filter((n) => n.type === "section"), [catalogNodes]);

  const allowed = useMemo(() => {
    const set = new Set(catalogNodes.filter((n) => withinScope(me, n)).map((n) => n.id));
    return set;
  }, [me, catalogNodes]);

  const byParent = useMemo(() => {
    const map = new Map<string, CatalogNode[]>();
    catalogNodes
      .filter((n) => n.type === "subsection")
      .forEach((n) => {
        const key = n.parentId!;
        map.set(key, [...(map.get(key) || []), n]);
      });
    return map;
  }, [catalogNodes]);

  const materialsBySection = useMemo(() => {
    const map = new Map<string, typeof materials>();
    materials.forEach((m) => {
      const key = m.passport.sectionId;
      map.set(key, [...(map.get(key) || []), m]);
    });
    return map;
  }, [materials]);

  const qLower = q.trim().toLowerCase();
  const matchesStr = (s: string) => s.toLowerCase().includes(qLower);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSectionOwner = (section: CatalogNode) => {
    return section.ownerIds?.includes(me.id) || false;
  };

  const canManageSection = (section: CatalogNode) => {
    return isAdmin || isSectionOwner(section);
  };

  return (
    <AppShell
      title="Каталог"
      breadcrumbs={[{ label: "Портал инструкций", href: "/" }, { label: "Каталог" }]}
      search={q}
      onSearch={setQ}
      actions={
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[180px] rounded-xl" data-testid="select-sort-catalog">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">По дате</SelectItem>
              <SelectItem value="popularity">По популярности</SelectItem>
              <SelectItem value="criticality">По критичности</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
              <SelectItem value="review">По дате пересмотра</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              data-testid="button-add-section"
              variant="outline"
              className="rounded-xl"
              onClick={() => { setNewSectionTitle(""); setAddSectionDialog(true); }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить раздел
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="grid gap-4">
            {sections
              .filter((s) => {
                if (!qLower) return true;
                if (matchesStr(s.title)) return true;
                const subs = byParent.get(s.id) || [];
                if (subs.some((sub) => matchesStr(sub.title))) return true;
                const allMats = subs.flatMap((sub) => materialsBySection.get(sub.id) || []);
                return allMats.some((m) => matchesStr(m.passport.title) || m.passport.tags.some(matchesStr));
              })
              .map((s) => {
                const sAllowed = allowed.has(s.id);
                const subs = (byParent.get(s.id) || []).filter((x) => {
                  if (!qLower) return true;
                  if (matchesStr(x.title) || matchesStr(s.title)) return true;
                  const mats = materialsBySection.get(x.id) || [];
                  return mats.some((m) => matchesStr(m.passport.title) || m.passport.tags.some(matchesStr));
                });
                const sectionOwners = (s.ownerIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean);
                const totalMats = subs.reduce((sum, sub) => sum + (materialsBySection.get(sub.id)?.length || 0), 0);

                return (
                  <Card key={s.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="flex items-center gap-2 text-base" data-testid={`text-section-${s.id}`}>
                            <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                            {s.title}
                            <Badge variant="secondary" className="kb-chip ml-1">{totalMats}</Badge>
                          </CardTitle>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {sectionOwners.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {sectionOwners.map((u) => u!.displayName).join(", ")}
                              </div>
                            )}
                            {!sectionOwners.length && (
                              <div className="text-xs text-orange-600">Владелец не назначен</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!sAllowed ? (
                            <Badge className="kb-chip" variant="secondary" data-testid={`status-restricted-${s.id}`}>
                              <Lock className="mr-1 h-3.5 w-3.5" />
                              Ограничено
                            </Badge>
                          ) : (
                            <Badge className="kb-chip" variant="secondary">Доступно</Badge>
                          )}
                          {canManageSection(s) && (
                            <>
                              <Button
                                data-testid={`button-owners-${s.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Владельцы раздела"
                                onClick={() => {
                                  setSelectedOwnerIds(s.ownerIds || []);
                                  setOwnerDialog(s);
                                }}
                              >
                                <UserCog className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                data-testid={`button-add-sub-${s.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Добавить подраздел"
                                onClick={() => {
                                  setNewSubTitle("");
                                  setAddSubDialog(s.id);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button
                                    data-testid={`button-rename-section-${s.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Переименовать раздел"
                                    onClick={() => setRenameSectionDialog({ id: s.id, title: s.title })}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    data-testid={`button-delete-section-${s.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title="Удалить раздел"
                                    onClick={() => {
                                      const res = deleteSection(s.id);
                                      toast({
                                        title: res.ok ? "Раздел удалён" : "Ошибка",
                                        description: res.ok ? s.title : res.message,
                                        variant: res.ok ? "default" : "destructive",
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-4">
                      <div className="grid gap-2">
                        {subs.map((sub) => {
                          const subMaterials = materialsBySection.get(sub.id) || [];
                          const filteredMats = qLower
                            ? subMaterials.filter((m) => matchesStr(m.passport.title) || m.passport.tags.some(matchesStr))
                            : subMaterials;
                          const count = subMaterials.length;
                          const subAllowed = sAllowed && allowed.has(sub.id);
                          const isExpanded = expanded.has(sub.id) || (!!qLower && filteredMats.length > 0);

                          return (
                            <div key={sub.id} data-testid={`row-subsection-${sub.id}`}>
                              <div
                                className={
                                  "flex items-center justify-between rounded-2xl border p-3 transition cursor-pointer " +
                                  (subAllowed ? "hover:bg-accent/30" : "opacity-70")
                                }
                                onClick={() => subAllowed && count > 0 && toggle(sub.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {count > 0 ? (
                                      isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                      )
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                                    )}
                                    <div className="truncate text-sm font-semibold">{sub.title}</div>
                                    <Badge variant="secondary" className="kb-chip" data-testid={`badge-count-${sub.id}`}>
                                      {count}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {canManageSection(s) && (
                                    <>
                                      <Button
                                        data-testid={`button-rename-${sub.id}`}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        title="Переименовать"
                                        onClick={() => setRenameDialog({ id: sub.id, title: sub.title })}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        data-testid={`button-delete-${sub.id}`}
                                        variant="ghost"
                                        size="icon"
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
                                    </>
                                  )}
                                  {!count && subAllowed && canCreateMaterial && (
                                    <Link href="/materials/new">
                                      <Button data-testid={`button-create-in-${sub.id}`} size="sm" className="rounded-xl h-7 text-xs">
                                        Создать
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </div>

                              {isExpanded && subAllowed && (
                                <div className="ml-6 mt-1 mb-2 space-y-1" data-testid={`materials-list-${sub.id}`}>
                                  {sortMats(qLower ? filteredMats : subMaterials).map((m) => (
                                    <Link key={m.id} href={`/materials/${m.materialId}`}>
                                      <div
                                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group border border-transparent hover:border-border"
                                        data-testid={`material-row-${m.id}`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                                            {m.passport.title}
                                          </div>
                                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Badge className={`text-[10px] px-1.5 py-0 rounded-md ${statusColor[m.status] || ""}`}>
                                              {m.status}
                                            </Badge>
                                            <Badge className={`text-[10px] px-1.5 py-0 rounded-md ${critColor[m.passport.criticality] || ""}`}>
                                              {m.passport.criticality}
                                            </Badge>
                                            {m.passport.tags.slice(0, 4).map((tag) => (
                                              <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                                <Tag className="h-2.5 w-2.5" />
                                                {tag}
                                              </span>
                                            ))}
                                            {m.passport.tags.length > 4 && (
                                              <span className="text-[10px] text-muted-foreground">+{m.passport.tags.length - 4}</span>
                                            )}
                                          </div>
                                        </div>
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                      </div>
                                    </Link>
                                  ))}
                                  {!filteredMats.length && qLower && (
                                    <div className="text-xs text-muted-foreground p-2">Материалы не найдены.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!subs.length && (
                          <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-catalog">
                            Нет подразделов.{canManageSection(s) && " Нажмите «+» чтобы создать."}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>

        <div className="md:col-span-4">
          <Card className="sticky top-[92px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Как устроен каталог</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                Раздел → Подраздел → Материал. Доступ ограничивается политиками.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Владельцы разделов</div>
                <div className="mt-2 text-sm">
                  Владельцы раздела могут создавать, удалять и переименовывать подразделы.
                  Администратор может назначать владельцев.
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Правила доступа</div>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• По роли (RBAC)</li>
                  <li>• По разделам</li>
                  <li>• По группам видимости</li>
                </ul>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Навигация</div>
                <div className="mt-2 text-sm">
                  Нажмите на подраздел, чтобы раскрыть список материалов. Нажмите на материал, чтобы открыть его.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!ownerDialog} onOpenChange={(open) => !open && setOwnerDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Владельцы раздела «{ownerDialog?.title}»</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="text-sm text-muted-foreground">Выберите пользователей, которые будут управлять подразделами.</div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {users.filter((u) => !u.deactivatedAt).map((u) => (
                <label key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    data-testid={`checkbox-owner-${u.id}`}
                    checked={selectedOwnerIds.includes(u.id)}
                    onCheckedChange={(checked) => {
                      setSelectedOwnerIds((prev) =>
                        checked ? [...prev, u.id] : prev.filter((id) => id !== u.id),
                      );
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold">{u.displayName}</div>
                    <div className="text-xs text-muted-foreground">{u.roles.join(", ")} · {u.department}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOwnerDialog(null)} data-testid="button-cancel-owners">
                Отмена
              </Button>
              <Button
                data-testid="button-save-owners"
                onClick={() => {
                  if (ownerDialog) {
                    const res = setSectionOwners(ownerDialog.id, selectedOwnerIds);
                    toast({
                      title: res.ok ? "Владельцы обновлены" : "Ошибка",
                      description: res.ok ? `Назначено: ${selectedOwnerIds.length}` : res.message,
                    });
                    if (res.ok) setOwnerDialog(null);
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addSubDialog} onOpenChange={(open) => !open && setAddSubDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый подраздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Название подраздела</Label>
              <Input
                data-testid="input-new-sub-title"
                value={newSubTitle}
                onChange={(e) => setNewSubTitle(e.target.value)}
                placeholder="Введите название…"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddSubDialog(null)}>Отмена</Button>
              <Button
                data-testid="button-create-sub"
                disabled={!newSubTitle.trim()}
                onClick={() => {
                  if (addSubDialog) {
                    const res = addSubsection(addSubDialog, newSubTitle);
                    toast({
                      title: res.ok ? "Подраздел создан" : "Ошибка",
                      description: res.ok ? newSubTitle : res.message,
                      variant: res.ok ? "default" : "destructive",
                    });
                    if (res.ok) setAddSubDialog(null);
                  }
                }}
              >
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать подраздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Новое название</Label>
              <Input
                data-testid="input-rename-sub"
                value={renameDialog?.title || ""}
                onChange={(e) => setRenameDialog((prev) => prev ? { ...prev, title: e.target.value } : null)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameDialog(null)}>Отмена</Button>
              <Button
                data-testid="button-save-rename"
                disabled={!renameDialog?.title.trim()}
                onClick={() => {
                  if (renameDialog) {
                    const res = renameSubsection(renameDialog.id, renameDialog.title);
                    toast({
                      title: res.ok ? "Переименовано" : "Ошибка",
                      description: res.ok ? renameDialog.title : res.message,
                      variant: res.ok ? "default" : "destructive",
                    });
                    if (res.ok) setRenameDialog(null);
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addSectionDialog} onOpenChange={(open) => !open && setAddSectionDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Название раздела</Label>
              <Input
                data-testid="input-new-section-title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Введите название…"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddSectionDialog(false)}>Отмена</Button>
              <Button
                data-testid="button-create-section"
                disabled={!newSectionTitle.trim()}
                onClick={() => {
                  const res = addSection(newSectionTitle);
                  toast({
                    title: res.ok ? "Раздел создан" : "Ошибка",
                    description: res.ok ? newSectionTitle : res.message,
                    variant: res.ok ? "default" : "destructive",
                  });
                  if (res.ok) setAddSectionDialog(false);
                }}
              >
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameSectionDialog} onOpenChange={(open) => !open && setRenameSectionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Новое название</Label>
              <Input
                data-testid="input-rename-section"
                value={renameSectionDialog?.title || ""}
                onChange={(e) => setRenameSectionDialog((prev) => prev ? { ...prev, title: e.target.value } : null)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameSectionDialog(null)}>Отмена</Button>
              <Button
                data-testid="button-save-rename-section"
                disabled={!renameSectionDialog?.title.trim()}
                onClick={() => {
                  if (renameSectionDialog) {
                    const res = renameSection(renameSectionDialog.id, renameSectionDialog.title);
                    toast({
                      title: res.ok ? "Переименовано" : "Ошибка",
                      description: res.ok ? renameSectionDialog.title : res.message,
                      variant: res.ok ? "default" : "destructive",
                    });
                    if (res.ok) setRenameSectionDialog(null);
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
