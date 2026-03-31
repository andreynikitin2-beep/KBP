import { useMemo } from "react";
import { Link } from "wouter";
import { CalendarClock, Heart, HeartOff } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useKB } from "@/lib/kbStore";
import { daysToNextReview, isOverdue } from "@/lib/kbLogic";

export default function Subscriptions() {
  const { me, users, materials, subscriptions, toggleSubscription } = useKB();

  const subscribedMaterials = useMemo(
    () => materials.filter((m) => subscriptions.includes(m.materialId)),
    [materials, subscriptions],
  );

  return (
    <AppShell
      title="Мои подписки"
      breadcrumbs={[
        { label: "Центр знаний ЦОС", href: "/" },
        { label: "Мои подписки" },
      ]}
    >
      <div className="grid gap-4">
        {subscribedMaterials.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Heart className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <div className="text-sm text-muted-foreground" data-testid="empty-subscriptions">
                Вы ещё не подписаны ни на один материал. Перейдите в каталог и нажмите на сердечко в паспорте материала.
              </div>
              <Link href="/catalog">
                <Button variant="outline" className="mt-4 rounded-xl" data-testid="link-go-catalog">
                  Перейти в каталог
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2" data-testid="list-subscriptions">
            <div className="text-sm text-muted-foreground mb-1">
              Вы подписаны на {subscribedMaterials.length} материал(ов). При изменениях вы получите уведомление.
            </div>
            {subscribedMaterials.map((m) => {
              const owner = users.find((u) => u.id === m.passport.ownerId);
              const overdue = isOverdue(m);
              const dueDays = daysToNextReview(m);
              return (
                <Card key={m.id} className="overflow-hidden" data-testid={`card-sub-${m.materialId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/materials/${m.materialId}`}>
                          <span className="text-sm font-bold hover:underline cursor-pointer" data-testid={`link-sub-title-${m.materialId}`}>
                            {m.passport.title}
                          </span>
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            className="kb-chip"
                            variant={m.status === "Опубликовано" ? "default" : "secondary"}
                            data-testid={`badge-sub-status-${m.materialId}`}
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
                          Владелец: {owner?.displayName || "—"} · {m.passport.legalEntity}
                        </div>
                      </div>
                      <Button
                        data-testid={`button-unsub-${m.materialId}`}
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => toggleSubscription(m.materialId)}
                      >
                        <HeartOff className="mr-1.5 h-4 w-4" />
                        Отписаться
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
