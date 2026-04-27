import { useMemo, useState } from "react";
import { Link } from "wouter";
import { BookOpen, CheckCircle2, Circle, Clock, Filter } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKB } from "@/lib/kbStore";
import type { NewHireAssignment } from "@/lib/mockData";

type FilterStatus = "all" | "pending" | "acknowledged";

export default function MyOnboarding() {
  const { me, materials, newHireAssignments, acknowledgeAssignment, newHiresEnabled } = useKB();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "status">("date");

  const myAssignments = useMemo(
    () => newHireAssignments.filter(a => a.userId === me.id),
    [newHireAssignments, me.id]
  );

  const enriched = useMemo(() => {
    return myAssignments
      .map(a => {
        const publishedVersion = materials.find(m =>
          m.materialId === a.materialId && m.status === "Опубликовано"
        );
        return { ...a, material: publishedVersion };
      })
      .filter(a => !!a.material);
  }, [myAssignments, materials]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filterStatus === "pending") list = list.filter(a => !a.acknowledgedAt);
    if (filterStatus === "acknowledged") list = list.filter(a => !!a.acknowledgedAt);

    list.sort((a, b) => {
      if (sortBy === "title") {
        const ta = a.material?.passport.title || "";
        const tb = b.material?.passport.title || "";
        return ta.localeCompare(tb, "ru");
      }
      if (sortBy === "status") {
        const sa = a.acknowledgedAt ? 1 : 0;
        const sb = b.acknowledgedAt ? 1 : 0;
        return sa - sb;
      }
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });
    return list;
  }, [enriched, filterStatus, sortBy]);

  const totalCount = enriched.length;
  const acknowledgedCount = enriched.filter(a => a.acknowledgedAt).length;
  const pendingCount = totalCount - acknowledgedCount;
  const progress = totalCount > 0 ? Math.round((acknowledgedCount / totalCount) * 100) : 0;

  if (!newHiresEnabled || totalCount === 0) {
    return (
      <AppShell title="Мои задания для ознакомления">
        <div className="max-w-4xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground" data-testid="empty-onboarding">
              <BookOpen className="mx-auto h-12 w-12 mb-3 opacity-40" />
              {!newHiresEnabled
                ? "Модуль адаптации новых сотрудников не активирован."
                : "У вас нет назначенных материалов для ознакомления."}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Мои задания для ознакомления">
      <div className="max-w-4xl mx-auto space-y-4">

        <div className="grid grid-cols-3 gap-3">
          <Card data-testid="stat-total-assignments">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{totalCount}</div>
              <div className="text-xs text-muted-foreground">Всего заданий</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-acknowledged">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{acknowledgedCount}</div>
              <div className="text-xs text-muted-foreground">Ознакомлен</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-pending">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Ожидает</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Прогресс ознакомления</CardTitle>
              <span className="text-sm font-medium" data-testid="text-progress-percent">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mt-1">
              <div
                className="bg-primary rounded-full h-2.5 transition-all"
                style={{ width: `${progress}%` }}
                data-testid="progress-bar"
              />
            </div>
          </CardHeader>
        </Card>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="pending">Ожидают</SelectItem>
                <SelectItem value="acknowledged">Ознакомлен</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[180px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">По дате</SelectItem>
              <SelectItem value="title">По названию</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {filtered.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              materialTitle={a.material?.passport.title}
              materialId={a.materialId}
              versionId={a.material?.id}
              onAcknowledge={acknowledgeAssignment}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground" data-testid="no-filtered-results">
              Нет заданий по выбранному фильтру.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AssignmentCard({
  assignment,
  materialTitle,
  materialId,
  versionId,
  onAcknowledge,
}: {
  assignment: NewHireAssignment;
  materialTitle?: string;
  materialId: string;
  versionId?: string;
  onAcknowledge: (assignmentId: string, versionId: string) => void;
}) {
  const isAcknowledged = !!assignment.acknowledgedAt;

  return (
    <Card className={`overflow-hidden ${isAcknowledged ? "opacity-75" : ""}`} data-testid={`card-assignment-${assignment.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isAcknowledged ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <div className="min-w-0">
              <Link href={`/materials/${materialId}`}>
                <span className="text-sm font-semibold hover:underline cursor-pointer" data-testid={`link-assignment-title-${assignment.id}`}>
                  {materialTitle || materialId}
                </span>
              </Link>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Назначено: {new Date(assignment.assignedAt).toLocaleDateString("ru-RU")}</span>
                {isAcknowledged && assignment.acknowledgedAt && (
                  <>
                    <span>·</span>
                    <span className="text-green-600">
                      Ознакомлен: {new Date(assignment.acknowledgedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {isAcknowledged ? (
              <Badge variant="default" className="bg-green-600" data-testid={`badge-acknowledged-${assignment.id}`}>
                Ознакомлен
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => versionId && onAcknowledge(assignment.id, versionId)}
                disabled={!versionId}
                data-testid={`btn-acknowledge-${assignment.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Ознакомлен
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
