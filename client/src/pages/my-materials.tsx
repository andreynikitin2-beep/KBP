import { useMemo } from "react";
import { Link } from "wouter";
import { CalendarClock, FileText, FolderOpen } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useKB } from "@/lib/kbStore";
import { daysToNextReview, isOverdue } from "@/lib/kbLogic";

function MaterialCard({ m, users }: { m: any; users: any[] }) {
  const owner = users.find((u) => u.id === m.passport.ownerId);
  const deputy = users.find((u) => u.id === m.passport.deputyId);
  const overdue = isOverdue(m);
  const dueDays = daysToNextReview(m);

  return (
    <Card className="overflow-hidden" data-testid={`card-my-material-${m.materialId}`}>
      <CardContent className="p-4">
        <div className="min-w-0 flex-1">
          <Link href={`/materials/${m.materialId}`}>
            <span className="text-sm font-bold hover:underline cursor-pointer" data-testid={`link-my-material-title-${m.materialId}`}>
              {m.passport.title}
            </span>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              className="kb-chip"
              variant={m.status === "Опубликовано" ? "default" : m.status === "Архив" ? "outline" : "secondary"}
              data-testid={`badge-my-material-status-${m.materialId}`}
            >
              {m.status}
            </Badge>
            <Badge className="kb-chip" variant="outline">
              {m.passport.criticality}
            </Badge>
            <Badge className="kb-chip" variant="outline">
              Версия {m.version}
            </Badge>
            {overdue && (
              <Badge className="kb-chip" variant="destructive">
                <CalendarClock className="mr-1 h-3 w-3" />
                Просрочено
              </Badge>
            )}
            {dueDays !== null && dueDays >= 0 && (
              <Badge className="kb-chip" variant="secondary">
                <CalendarClock className="mr-1 h-3 w-3" />
                Через {dueDays} дн.
              </Badge>
            )}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            Владелец: {owner?.displayName || "—"}
            {deputy ? ` · Заместитель: ${deputy.displayName}` : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyMaterials() {
  const { me, users, visibleMaterials } = useKB();

  const ownerMaterials = useMemo(
    () => visibleMaterials.filter((m) => m.passport.ownerId === me.id),
    [visibleMaterials, me.id],
  );

  const deputyMaterials = useMemo(
    () => visibleMaterials.filter((m) => m.passport.deputyId === me.id),
    [visibleMaterials, me.id],
  );

  return (
    <AppShell
      title="Мои материалы"
      breadcrumbs={[
        { label: "Портал инструкций", href: "/" },
        { label: "Мои материалы" },
      ]}
    >
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-serif text-xl" data-testid="heading-owner-section">Я — владелец</h2>
            <Badge variant="secondary" className="kb-chip ml-1" data-testid="count-owner-materials">
              {ownerMaterials.length}
            </Badge>
          </div>
          {ownerMaterials.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <div className="text-sm text-muted-foreground" data-testid="empty-owner-materials">
                  У вас нет материалов, где вы являетесь владельцем.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2" data-testid="list-owner-materials">
              {ownerMaterials.map((m) => (
                <MaterialCard key={m.id} m={m} users={users} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-xl bg-amber-500/10 p-2">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="font-serif text-xl" data-testid="heading-deputy-section">Я — заместитель владельца</h2>
            <Badge variant="secondary" className="kb-chip ml-1" data-testid="count-deputy-materials">
              {deputyMaterials.length}
            </Badge>
          </div>
          {deputyMaterials.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <div className="text-sm text-muted-foreground" data-testid="empty-deputy-materials">
                  У вас нет материалов, где вы являетесь заместителем владельца.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2" data-testid="list-deputy-materials">
              {deputyMaterials.map((m) => (
                <MaterialCard key={m.id} m={m} users={users} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
