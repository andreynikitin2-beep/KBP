import { Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  FilePlus2,
  LayoutGrid,
  LockKeyhole,
  Search,
  Settings2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useKB } from "@/lib/kbStore";
import { demoUsers } from "@/lib/mockData";

const nav = [
  { href: "/", label: "Главная", icon: LayoutGrid },
  { href: "/catalog", label: "Каталог", icon: BookOpen },
  { href: "/materials/new", label: "Создать", icon: FilePlus2 },
  { href: "/admin", label: "Администрирование", icon: Settings2 },
];

function RolePills() {
  const { me } = useKB();
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="list-my-roles">
      {me.roles.map((r) => (
        <Badge key={r} variant="secondary" className="kb-chip" data-testid={`badge-role-${r}`}>
          {r}
        </Badge>
      ))}
    </div>
  );
}

function UserSwitch() {
  const { me, setMeId } = useKB();
  const [open, setOpen] = useState(false);
  const label = `${me.displayName} · ${me.legalEntity} / ${me.branch}`;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden lg:block">
        <div className="text-sm font-medium" data-testid="text-user-name">
          {me.displayName}
        </div>
        <div className="text-xs text-muted-foreground" data-testid="text-user-scope">
          {me.legalEntity} · {me.branch} · {me.department}
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            data-testid="button-switch-user"
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Building2 className="h-4 w-4" />
            Профиль
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[420px] sm:w-[460px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-serif text-xl">Демо-пользователи</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Переключайте роли, юр.лицо и филиал, чтобы увидеть ограничения доступа.
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            {demoUsers.map((u) => {
              const active = u.id === me.id;
              return (
                <Card
                  key={u.id}
                  className={
                    "p-3 transition hover:shadow-sm " +
                    (active ? "border-primary/50 bg-accent/30" : "")
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold" data-testid={`text-demo-user-${u.id}`}>
                        {u.displayName}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u.email}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant={active ? "default" : "secondary"}
                            className="kb-chip"
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {u.legalEntity} · {u.branch} · {u.department}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant={u.isAvailable ? "secondary" : "destructive"}
                        className="kb-chip"
                        data-testid={`status-availability-${u.id}`}
                      >
                        {u.isAvailable ? "Доступен" : "Недоступен"}
                      </Badge>
                      <Button
                        data-testid={`button-use-user-${u.id}`}
                        disabled={active}
                        size="sm"
                        onClick={() => {
                          setMeId(u.id);
                          setOpen(false);
                        }}
                      >
                        {active ? "Вы выбраны" : "Войти"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Separator className="my-4" />
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Интеграция с AD (конфиг)</div>
                <div className="mt-1 text-xs text-muted-foreground" data-testid="text-ad-hint">
                  В демо отключено. Предусмотрены режимы SAML/OIDC/LDAP и маппинг атрибутов.
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AppShell({
  title,
  children,
  search,
  onSearch,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  search?: string;
  onSearch?: (v: string) => void;
  actions?: React.ReactNode;
}) {
  const [location] = useLocation();
  const active = useMemo(() => nav.find((n) => n.href === location)?.href, [location]);

  return (
    <div className="min-h-screen kb-hero-grid kb-noise">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg leading-none" data-testid="text-app-title">
                Портал инструкций
              </div>
              <div className="mt-0.5 hidden sm:block text-xs text-muted-foreground">
                База знаний с контролем актуальности
              </div>
            </div>
          </div>

          <div className="ml-2 hidden md:flex items-center gap-1.5">
            {nav.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.href;
              return (
                <Link key={n.href} href={n.href}>
                  <Button
                    data-testid={`link-nav-${n.href}`}
                    variant={isActive ? "secondary" : "ghost"}
                    className={
                      "gap-2 rounded-xl " +
                      (isActive ? "bg-accent/50" : "hover:bg-accent/40")
                    }
                    size="sm"
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {onSearch ? (
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="input-global-search"
                  value={search || ""}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Поиск по названию, паспорту, тегам и содержимому…"
                  className="w-[460px] rounded-2xl pl-9"
                />
              </div>
            ) : null}

            {actions}

            <Button data-testid="button-notifications" variant="ghost" size="icon" className="rounded-xl">
              <Bell className="h-4 w-4" />
            </Button>
            <UserSwitch />

            <Sheet>
              <SheetTrigger asChild>
                <Button data-testid="button-open-menu" variant="outline" size="icon" className="md:hidden rounded-xl">
                  <LockKeyhole className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] p-0">
                <div className="p-4">
                  <div className="font-serif text-xl">Навигация</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Разделы, каталог, создание материалов и администрирование.
                  </p>
                </div>
                <Separator />
                <ScrollArea className="h-[calc(100vh-120px)] px-2 pb-6">
                  <div className="space-y-1 p-2">
                    {nav.map((n) => {
                      const Icon = n.icon;
                      const isActive = active === n.href;
                      return (
                        <Link key={n.href} href={n.href}>
                          <Button
                            data-testid={`link-nav-mobile-${n.href}`}
                            variant={isActive ? "secondary" : "ghost"}
                            className="w-full justify-start gap-2 rounded-xl"
                          >
                            <Icon className="h-4 w-4" />
                            {n.label}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                  <Separator className="my-3" />
                  <div className="px-4">
                    <div className="text-xs font-medium text-muted-foreground">Моя роль</div>
                    <div className="mt-2">
                      <RolePills />
                    </div>
                    <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                      <div className="flex items-start gap-2">
                        <ClipboardCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="font-medium">Контроль актуальности</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Просрочка → «На пересмотре», напоминания и эскалации по email.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl leading-tight" data-testid="text-page-title">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Каталог «Раздел → Подраздел → Материал», статусы, версии, RFC, аудит и уведомления.
            </p>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </main>

      <footer className="border-t bg-background/50">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-semibold">Портал инструкций</div>
              <div className="mt-1 text-xs text-muted-foreground">
                MVP‑прототип: все данные в памяти браузера. Email‑уведомления логируются.
              </div>
            </div>
            <div className="md:justify-self-center">
              <div className="text-xs text-muted-foreground">Режимы контента</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="kb-chip" variant="secondary">
                  PDF/DOCX
                </Badge>
                <Badge className="kb-chip" variant="secondary">
                  Страница портала
                </Badge>
                <Badge className="kb-chip" variant="secondary">
                  Глубокие ссылки
                </Badge>
              </div>
            </div>
            <div className="md:justify-self-end">
              <div className="text-xs text-muted-foreground">Безопасность</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge className="kb-chip" variant="secondary">
                  RBAC
                </Badge>
                <Badge className="kb-chip" variant="secondary">
                  Юр.лицо/филиал
                </Badge>
                <Badge className="kb-chip" variant="secondary">
                  Аудит
                </Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            © Демо. Интеграции AD/SAML/OIDC/LDAP и SMTP предусмотрены как точки расширения.
          </div>
        </div>
      </footer>
    </div>
  );
}
