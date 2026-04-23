import { useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import { useLocation } from "wouter";
import { FilePlus2, FileText, Globe, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { RichEditor } from "@/components/kb/RichEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useKB } from "@/lib/kbStore";
import type { CatalogNode, Criticality, MaterialVersion } from "@/lib/mockData";
import { getSectionPath, validatePassport } from "@/lib/kbLogic";
import { api } from "@/lib/api";

function nextVersionLike(prev?: string) {
  if (!prev) return "0.1";
  const [a, b] = prev.split(".").map((x) => Number(x));
  if (Number.isFinite(a) && Number.isFinite(b)) return `${a}.${b + 1}`;
  return "0.1";
}

export default function MaterialWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { me, users, materials, setMaterials, policy, catalogNodes, visibilityGroups } = useKB();

  const initialSectionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("section") || "";
  }, []);

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [criticality, setCriticality] = useState<Criticality>("Средняя");
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [ownerId, setOwnerId] = useState(me.id);
  const [deputyId, setDeputyId] = useState<string | undefined>(undefined);
  const [visibilityGroupIds, setVisibilityGroupIds] = useState<string[]>(["g-base"]);
  const [newHireRequired, setNewHireRequired] = useState(false);
  const [tags, setTags] = useState("hr, отпуск");
  const [contentKind, setContentKind] = useState<"file" | "page">("file");
  const [fileType, setFileType] = useState<"pdf" | "docx">("pdf");
  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [fileDataBase64, setFileDataBase64] = useState("");
  const [pageHtml, setPageHtml] = useState("<h1>Заголовок</h1><p>Абзац с описанием процесса…</p><ol><li>Шаг 1</li><li>Шаг 2</li><li>Шаг 3</li></ol>");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const detectedType = ext === "docx" ? "docx" : "pdf";
    setFileType(detectedType);
    setFileName(file.name);

    const toBase64 = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    try {
      const b64 = await toBase64(file);
      setFileDataBase64(b64);
      if (detectedType === "docx") {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setExtractedText(result.value);
          toast({ title: "Файл загружен", description: `${file.name} — текст извлечён` });
        } catch {
          toast({ title: "Файл загружен", description: file.name, variant: "default" });
        }
      } else {
        toast({ title: "Файл выбран", description: file.name });
      }
    } catch {
      toast({ title: "Ошибка чтения файла", description: file.name, variant: "destructive" });
    }
    e.target.value = "";
  }

  const sectionOptions = useMemo(() => {
    const subs = catalogNodes.filter((n) => n.type === "subsection");
    return subs.map((s) => {
      const path = getSectionPath(catalogNodes, s.id).map((x) => x.title).join(" / ");
      return { id: s.id, label: path };
    });
  }, [catalogNodes]);

  const periodRow = useMemo(() => policy.reviewPeriods.find((p) => p.criticality === criticality), [policy, criticality]);

  const computedNextReview = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (periodRow?.days ?? 180));
    return d.toISOString();
  }, [periodRow]);

  const passportDraft: MaterialVersion["passport"] = {
    title,
    purpose,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    tagGroups: [],
    criticality,
    sectionId,
    ownerId: ownerId || undefined,
    deputyId,
    legalEntity: me.legalEntity,
    department: me.department,
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: computedNextReview,
    reviewPeriodDays: periodRow?.days,
    visibilityGroupIds,
    newHireRequired: newHireRequired || undefined,
  };

  useEffect(() => {
    if (sectionId) {
      const node = catalogNodes.find(n => n.id === sectionId);
      if (node?.defaultVisibilityGroupIds?.length) {
        setVisibilityGroupIds(node.defaultVisibilityGroupIds);
      }
    }
  }, [sectionId, catalogNodes]);

  const missing = useMemo(() => validatePassport(passportDraft), [passportDraft]);

  return (
    <AppShell
      title="Мастер создания материала"
      breadcrumbs={[
        { label: "Центр знаний ЦОС", href: "/" },
        { label: "Каталог", href: "/catalog" },
        { label: "Новый материал" },
      ]}
      actions={<></>}
    >
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Паспорт и контент</CardTitle>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Обязательные поля проверяются перед публикацией.</div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="title">Название (обязательно)</Label>
                  <Input
                    id="title"
                    data-testid="input-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Как подключиться к VPN"
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="purpose">Назначение</Label>
                  <Textarea
                    id="purpose"
                    data-testid="textarea-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Кому и для чего нужна инструкция…"
                    className="mt-1 min-h-[90px] rounded-xl"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Критичность (настраиваемый период)</Label>
                    <Select value={criticality} onValueChange={(v) => setCriticality(v as Criticality)}>
                      <SelectTrigger data-testid="select-criticality" className="mt-1 rounded-xl">
                        <SelectValue placeholder="Выберите…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Низкая">Низкая</SelectItem>
                        <SelectItem value="Средняя">Средняя</SelectItem>
                        <SelectItem value="Высокая">Высокая</SelectItem>
                        <SelectItem value="Критическая">Критическая</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="mt-2 text-xs text-muted-foreground" data-testid="text-review-policy">
                      Период: {periodRow?.days ?? 180} дн. · Напоминания: {(periodRow?.remindBeforeDays || []).join(", ")} · Эскалации:
                      {(periodRow?.escalationAfterDays || []).join(", ")}
                    </div>
                  </div>
                  <div>
                    <Label>Раздел / подраздел (обязательно)</Label>
                    <Select value={sectionId} onValueChange={(v) => setSectionId(v)}>
                      <SelectTrigger data-testid="select-section" className="mt-1 rounded-xl">
                        <SelectValue placeholder="Выберите…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectionOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Владелец (обязательно)</Label>
                    <Select value={ownerId} onValueChange={(v) => setOwnerId(v)}>
                      <SelectTrigger data-testid="select-owner" className="mt-1 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => !u.deactivatedAt).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Заместитель</Label>
                      <Select value={deputyId || "none"} onValueChange={(v) => setDeputyId(v === "none" ? undefined : v)}>
                        <SelectTrigger data-testid="select-deputy" className="mt-1 rounded-xl">
                          <SelectValue placeholder="Не выбран" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не выбран</SelectItem>
                          {users.filter(u => !u.deactivatedAt).map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                </div>

                <div>
                  <Label>Группы видимости</Label>
                  <div className="mt-1 rounded-xl border p-3 space-y-2 max-h-48 overflow-y-auto">
                    {visibilityGroups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          data-testid={`checkbox-vis-group-${g.id}`}
                          checked={visibilityGroupIds.includes(g.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setVisibilityGroupIds(prev => [...prev, g.id]);
                            } else {
                              setVisibilityGroupIds(prev => prev.filter(id => id !== g.id));
                            }
                          }}
                        />
                        <span>{g.title}{g.isSystem ? " (все пользователи)" : ""}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Материал видят участники выбранных групп. Если выбрана «Базовая» — все пользователи.
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      data-testid="checkbox-new-hire-required"
                      checked={newHireRequired}
                      onCheckedChange={(checked) => setNewHireRequired(!!checked)}
                    />
                    <span className="text-sm font-medium">Обязателен для новых сотрудников</span>
                  </label>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Материал будет автоматически назначен новым сотрудникам при адаптации.
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Теги (обязательно)</Label>
                  <Input
                    id="tags"
                    data-testid="input-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Через запятую: vpn, доступ…"
                    className="mt-1 rounded-xl"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags-preview">
                    {passportDraft.tags.slice(0, 10).map((t) => (
                      <Badge key={t} variant="secondary" className="kb-chip">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="text-sm font-semibold">Контент</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="button-kind-file"
                      type="button"
                      variant={contentKind === "file" ? "default" : "outline"}
                      className="rounded-xl"
                      onClick={() => setContentKind("file")}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Файл (PDF/DOCX)
                    </Button>
                    <Button
                      data-testid="button-kind-page"
                      type="button"
                      variant={contentKind === "page" ? "default" : "outline"}
                      className="rounded-xl"
                      onClick={() => setContentKind("page")}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Страница портала
                    </Button>
                  </div>

                  {contentKind === "file" ? (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm font-semibold">Загрузка файла</div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl border-dashed h-16 flex-col gap-1"
                        data-testid="button-pick-file"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {fileName ? fileName : "Выбрать файл PDF или DOCX…"}
                        </span>
                      </Button>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <Label>Тип</Label>
                          <Select value={fileType} onValueChange={(v) => setFileType(v as any)}>
                            <SelectTrigger data-testid="select-file-type" className="mt-1 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pdf">PDF</SelectItem>
                              <SelectItem value="docx">DOCX</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="fileName">Имя файла</Label>
                          <Input
                            id="fileName"
                            data-testid="input-file-name"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
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
                        <div className="text-sm font-semibold">Страница портала</div>
                      </div>
                      <RichEditor content={pageHtml} onChange={setPageHtml} />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Статус новой записи: <span className="font-semibold">Черновик</span>
                  </div>
                  <Button
                    data-testid="button-create-material"
                    className="rounded-xl"
                    onClick={() => {
                      const missingNow = validatePassport(passportDraft);
                      if (missingNow.length) {
                        toast({
                          title: "Нельзя создать",
                          description: `Заполните обязательные поля: ${missingNow.join(", ")}`,
                          variant: "destructive",
                        });
                        return;
                      }

                      const materialId = `m-${1000 + materials.length}`;
                      const version: MaterialVersion = {
                        id: `v-${materialId}-1`,
                        materialId,
                        version: nextVersionLike(),
                        createdAt: new Date().toISOString(),
                        createdBy: me.id,
                        status: "Черновик",
                        passport: passportDraft,
                        content:
                          contentKind === "file"
                            ? {
                                kind: "file",
                                file: { name: fileName, type: fileType, extractedText, dataBase64: fileDataBase64 },
                              }
                            : {
                                kind: "page",
                                page: { html: pageHtml },
                              },
                        subscribers: [],
                        discussionsEnabled: false,
                        discussionVisibility: "Все",
                        stats: { views: 0, helpfulYes: 0, helpfulNo: 0 },
                        auditViews: [],
                        auditDownloads: [],
                      };

                      setMaterials((p) => [version, ...p]);
                      api.createMaterialVersion(version).catch(console.error);
                      toast({ title: "Создано", description: "Материал добавлен в Черновики." });
                      setLocation(`/materials/${materialId}`);
                    }}
                  >
                    Создать
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-[92px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Проверка перед публикацией</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">Демонстрация валидации паспорта.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-xl bg-accent/60 p-2">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-validation-title">
                      Обязательные поля
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {missing.length ? `Не заполнено: ${missing.join(", ")}` : "Готово к публикации"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Будет установлено автоматически</div>
                <div className="mt-1 text-sm">Следующий пересмотр: {new Date(computedNextReview).toLocaleDateString("ru-RU")}</div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Статусы ЖЦ</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "Черновик",
                    "На согласовании",
                    "Опубликовано",
                    "На пересмотре",
                    "Архив",
                  ].map((s) => (
                    <Badge key={s} variant="secondary" className="kb-chip">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
