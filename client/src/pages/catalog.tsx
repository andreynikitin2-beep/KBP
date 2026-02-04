import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Folder, Lock, Search } from "lucide-react";
import { AppShell } from "@/components/kb/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useKB } from "@/lib/kbStore";
import { catalog } from "@/lib/mockData";
import { withinScope } from "@/lib/kbLogic";

export default function Catalog() {
  const { me, materials } = useKB();
  const [q, setQ] = useState("");

  const sections = useMemo(() => catalog.filter((n) => n.type === "section"), []);

  const allowed = useMemo(() => {
    const set = new Set(catalog.filter((n) => withinScope(me, n)).map((n) => n.id));
    return set;
  }, [me]);

  const byParent = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    catalog
      .filter((n) => n.type === "subsection")
      .forEach((n) => {
        const key = n.parentId!;
        map.set(key, [...(map.get(key) || []), { id: n.id, title: n.title }]);
      });
    return map;
  }, []);

  const materialCountByNode = useMemo(() => {
    const map = new Map<string, number>();
    materials.forEach((m) => {
      map.set(m.passport.sectionId, (map.get(m.passport.sectionId) || 0) + 1);
    });
    return map;
  }, [materials]);

  const matches = (title: string) => title.toLowerCase().includes(q.trim().toLowerCase());

  return (
    <AppShell
      title="Каталог"
      search={q}
      onSearch={setQ}
      actions={
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-catalog-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти раздел или подраздел…"
            className="w-[340px] rounded-2xl pl-9"
          />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="grid gap-4">
            {sections
              .filter((s) => (q ? matches(s.title) : true))
              .map((s) => {
                const sAllowed = allowed.has(s.id);
                const subs = (byParent.get(s.id) || []).filter((x) => (q ? matches(x.title) || matches(s.title) : true));
                return (
                  <Card key={s.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-2 text-base" data-testid={`text-section-${s.id}`}>
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            {s.title}
                          </CardTitle>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {sAllowed ? "Доступно" : "Ограничено политиками доступа"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!sAllowed ? (
                            <Badge className="kb-chip" variant="secondary" data-testid={`status-restricted-${s.id}`}>
                              <Lock className="mr-1 h-3.5 w-3.5" />
                              Ограничено
                            </Badge>
                          ) : (
                            <Badge className="kb-chip" variant="secondary">
                              Юр.лицо/филиал
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-4">
                      <div className="grid gap-2">
                        {subs.map((sub) => {
                          const count = materialCountByNode.get(sub.id) || 0;
                          const subAllowed = sAllowed && allowed.has(sub.id);
                          return (
                            <div
                              key={sub.id}
                              className={
                                "flex items-center justify-between rounded-2xl border p-3 transition " +
                                (subAllowed ? "hover:bg-accent/30" : "opacity-70")
                              }
                              data-testid={`row-subsection-${sub.id}`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  <div className="truncate text-sm font-semibold">{sub.title}</div>
                                  <Badge variant="secondary" className="kb-chip" data-testid={`badge-count-${sub.id}`}>
                                    {count}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {count ? (
                                  <Link href={subAllowed ? `/catalog#${sub.id}` : "/admin"}>
                                    <Button
                                      data-testid={`button-open-subsection-${sub.id}`}
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-xl"
                                      disabled={!subAllowed}
                                    >
                                      Открыть
                                    </Button>
                                  </Link>
                                ) : (
                                  <Link href="/materials/new">
                                    <Button data-testid={`button-create-in-${sub.id}`} size="sm" className="rounded-xl">
                                      Создать материал
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!subs.length ? (
                          <div className="rounded-2xl border bg-muted/30 p-6 text-sm text-muted-foreground" data-testid="empty-catalog">
                            Нет подразделов по вашему фильтру.
                          </div>
                        ) : null}
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
                <div className="text-xs font-medium text-muted-foreground">Правила доступа</div>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• По роли (RBAC)</li>
                  <li>• По юр.лицу и филиалу</li>
                  <li>• По разделам</li>
                </ul>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Поддержка глубоких ссылок</div>
                <div className="mt-2 text-sm">
                  Для страниц — якоря (#anchor). Для PDF — ссылка на страницу (в демо: имитация).
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <div className="text-xs font-medium text-muted-foreground">Фильтры и витрины</div>
                <div className="mt-2 text-sm">Новое / Популярное / Просрочено / Скоро пересмотр / Для моей роли.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
