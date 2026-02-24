import { Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  Heart,
  LayoutGrid,
  LockKeyhole,
  Search,
  Settings2,
  LogOut,
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

const allNav = [
  { href: "/", label: "Главная", icon: LayoutGrid, roles: null },
  { href: "/catalog", label: "Каталог", icon: BookOpen, roles: null },
  { href: "/subscriptions", label: "Мои подписки", icon: Heart, roles: null },
  { href: "/my-materials", label: "Мои материалы", icon: ClipboardCheck, roles: ["Владелец", "Заместитель владельца"] as string[] },
  { href: "/my-onboarding", label: "Адаптация", icon: GraduationCap, roles: null },
  { href: "/materials/new", label: "Создать", icon: FilePlus2, roles: ["Автор", "Владелец", "Заместитель владельца", "Администратор"] as string[] },
  { href: "/admin", label: "Администрирование", icon: Settings2, roles: ["Администратор"] as string[] },
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
  const { me, logout } = useKB();

  return (
    <div className="flex items-center gap-2 border-l pl-2 ml-1">
      <div className="text-right hidden sm:block">
        <div className="text-xs font-bold" data-testid="text-user-name">
          {me.displayName}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium" data-testid="text-user-scope">
          {me.legalEntity}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-destructive"
        onClick={logout}
        data-testid="button-logout"
        title="Выйти"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type Breadcrumb = { label: string; href?: string };

export function AppShell({
  title,
  children,
  search,
  onSearch,
  actions,
  breadcrumbs,
}: {
  title: string;
  children: React.ReactNode;
  search?: string;
  onSearch?: (v: string) => void;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}) {
  const [location] = useLocation();
  const { me } = useKB();
  const nav = useMemo(
    () => allNav.filter((n) => n.roles === null || n.roles.some((r) => me.roles.includes(r as any))),
    [me.roles],
  );
  const active = useMemo(() => nav.find((n) => n.href === location)?.href, [nav, location]);

  return (
    <div className="min-h-screen kb-hero-grid kb-noise">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-[#0ea5e9] text-white shadow-sm">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight" data-testid="text-app-title">
                Портал инструкций
              </div>
              <div className="mt-0 hidden sm:block text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                база знаний
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
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  data-testid="input-global-search"
                  value={search || ""}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-[200px] h-9 rounded-lg pl-9 bg-muted/40 border-none text-sm"
                />
              </div>
            ) : null}

            {actions && (
              <div className="hidden md:block">
                {actions}
              </div>
            )}

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
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground" data-testid="nav-breadcrumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground/70">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl leading-tight" data-testid="text-page-title">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </main>

      <footer className="border-t bg-background/50">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="text-sm font-semibold">Портал инструкций</div>
          <div className="mt-2 text-xs text-muted-foreground">
            По всем вопросам использования системы или технической поддержки обращайтесь в службу технической поддержки по адресу{" "}
            <a href="mailto:hd@progorod.veb.ru" className="text-primary underline">hd@progorod.veb.ru</a>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Портал инструкций
          </div>
        </div>
      </footer>
    </div>
  );
}
