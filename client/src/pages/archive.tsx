import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Archive,
  ArrowUpFromLine,
  BookOpen,
  CalendarClock,
  Search,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { AppShell } from "@/components/kb/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useKB } from "@/lib/kbStore";
import { useToast } from "@/hooks/use-toast";
import type { MaterialVersion } from "@/lib/mockData";

export default function ArchivePage() {
  const { me, materials, users, catalogNodes, restoreMaterial } = useKB();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const isAdmin = me.roles.includes("Администратор");

  const mySectionIds = useMemo(() => {
    return new Set(
      catalogNodes
        .filter((n) => n.type === "section" && (n.ownerIds ?? []).includes(me.id))
        .map((n) => n.id)
    );
  }, [catalogNodes, me.id]);

  const archivedMaterials = useMemo(() => {
    const archived: MaterialVersion[] = [];
    const seenMaterialIds = new Set<string>();

    for (const m of materials) {
      if (m.status !== "Архив") continue;
      if (seenMaterialIds.has(m.materialId)) continue;

      if (isAdmin) {
        archived.push(m);
        seenMaterialIds.add(m.materialId);
      } else {
        const isSectionOwner = mySectionIds.has(m.passport.sectionId);
        const isMaterialOwner = m.passport.ownerId === me.id;
        const isMaterialDeputy = m.passport.deputyId === me.id;
        if (isSectionOwner || isMaterialOwner || isMaterialDeputy) {
          archived.push(m);
          seenMaterialIds.add(m.materialId);
        }
      }
    }

    return archived.sort((a, b) =>
      new Date(b.archivedAt ?? b.createdAt).getTime() -
      new Date(a.archivedAt ?? a.createdAt).getTime()
    );
  }, [materials, isAdmin, mySectionIds, me.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return archivedMaterials;
    const q = search.toLowerCase();
    return archivedMaterials.filter(
      (m) =>
        m.passport.title.toLowerCase().includes(q) ||
        m.passport.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [archivedMaterials, search]);

  function getUserName(userId?: string) {
    if (!userId) return "—";
    const u = users.find((u) => u.id === userId);
    return u ? u.displayName : userId;
  }

  function getSectionName(sectionId: string) {
    const node = catalogNodes.find((n) => n.id === sectionId);
    return node ? node.title : sectionId;
  }

  function canRestore(m: MaterialVersion) {
    if (isAdmin) return true;
    if (mySectionIds.has(m.passport.sectionId)) return true;
    if (m.passport.ownerId === me.id || m.passport.deputyId === me.id) return true;
    return false;
  }

  function handleRestore(materialId: string, title: string) {
    const result = restoreMaterial(materialId);
    if (result.ok) {
      toast({ title: "Материал восстановлен", description: `«${title}» возвращён в каталог со статусом «Опубликовано»` });
    } else {
      toast({ title: "Ошибка", description: result.message, variant: "destructive" });
    }
  }

  return (
    <AppShell
      title="Архив"
      breadcrumbs={[{ label: "Центр знаний ЦОС", href: "/" }, { label: "Архив" }]}
    >
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Archive className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Архив материалов</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Все материалы, перенесённые в архив"
                : "Материалы из ваших разделов и собственности, перенесённые в архив"}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-archive-search"
            className="pl-9 rounded-xl"
            placeholder="Поиск по названию или тегам…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Archive className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "Ничего не найдено по вашему запросу" : "В архиве пока нет материалов"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground pl-1">
              Найдено: {filtered.length}
            </div>
            {filtered.map((m) => (
              <Card
                key={m.id}
                data-testid={`card-archive-${m.materialId}`}
                className="rounded-2xl hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] font-medium shrink-0">
                          Архив
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {m.passport.criticality}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {m.content.kind === "file" ? m.content.file?.type?.toUpperCase() ?? "Файл" : "Страница"}
                        </Badge>
                      </div>

                      <Link href={`/materials/${m.materialId}`}>
                        <h3
                          data-testid={`text-archive-title-${m.materialId}`}
                          className="font-semibold text-sm leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-2"
                        >
                          {m.passport.title}
                        </h3>
                      </Link>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {getSectionName(m.passport.sectionId)}
                        </span>
                        {m.archivedBy && (
                          <span
                            className="flex items-center gap-1"
                            data-testid={`text-archive-by-${m.materialId}`}
                          >
                            <User className="h-3 w-3" />
                            Архивировал: {getUserName(m.archivedBy)}
                          </span>
                        )}
                        {m.archivedAt && (
                          <span
                            className="flex items-center gap-1"
                            data-testid={`text-archive-at-${m.materialId}`}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {format(new Date(m.archivedAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                          </span>
                        )}
                      </div>

                      {m.passport.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.passport.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {canRestore(m) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            data-testid={`button-restore-${m.materialId}`}
                            variant="outline"
                            size="sm"
                            className="rounded-xl shrink-0 gap-1.5"
                          >
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                            Восстановить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Восстановить материал?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Материал «{m.passport.title}» будет возвращён в каталог со статусом «Опубликовано» и станет доступен пользователям согласно настройкам видимости.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-xl"
                              onClick={() => handleRestore(m.materialId, m.passport.title)}
                            >
                              Восстановить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
