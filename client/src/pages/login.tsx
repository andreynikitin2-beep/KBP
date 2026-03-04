import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, LogIn, Building2, Shield, Search, ChevronDown, X } from "lucide-react";

interface UserListItem {
  id: string;
  username: string;
  displayName: string;
  source: string;
  department: string;
  roles: string[];
  isAvailable: boolean;
  deactivatedAt: string | null;
}

export default function LoginPage({ onLogin }: { onLogin: (userId: string) => void }) {
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  useEffect(() => {
    fetch("/api/auth/users-list")
      .then((r) => r.json())
      .then((data) => {
        const active = data.filter((u: UserListItem) => !u.deactivatedAt && u.isAvailable);
        setUsersList(active);
        setLoadingUsers(false);
      })
      .catch(() => setLoadingUsers(false));
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersList;
    const q = searchQuery.toLowerCase().trim();
    return usersList.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [usersList, searchQuery]);

  const selectedUser = usersList.find((u) => u.id === selectedUserId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [searchQuery, dropdownOpen]);

  function selectUser(user: UserListItem) {
    setSelectedUserId(user.id);
    setSearchQuery(user.displayName);
    setDropdownOpen(false);
    setError("");
  }

  function clearSelection() {
    setSelectedUserId("");
    setSearchQuery("");
    setError("");
    inputRef.current?.focus();
  }

  function handleInputChange(value: string) {
    setSearchQuery(value);
    setDropdownOpen(true);
    if (selectedUserId) {
      setSelectedUserId("");
    }
  }

  function handleInputFocus() {
    setDropdownOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!dropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0 && highlightIdx < filteredUsers.length) {
      e.preventDefault();
      selectUser(filteredUsers[highlightIdx]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Выберите пользователя");
      return;
    }
    if (!password) {
      setError("Введите пароль");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка авторизации");
        setLoading(false);
        return;
      }
      onLogin(data.user.id);
    } catch {
      setError("Ошибка соединения с сервером");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-login-title">
            Портал инструкций
          </h1>
          <p className="text-muted-foreground mt-1">База знаний с контролем актуальности</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Авторизация</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-search">Сотрудник</Label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={inputRef}
                        id="user-search"
                        data-testid="input-login-user-search"
                        value={searchQuery}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onFocus={handleInputFocus}
                        onKeyDown={handleKeyDown}
                        placeholder="Введите имя или выберите из списка..."
                        className="pl-9 pr-16"
                        autoComplete="off"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {selectedUserId && (
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-clear-user"
                            tabIndex={-1}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setDropdownOpen(!dropdownOpen); inputRef.current?.focus(); }}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-toggle-dropdown"
                          tabIndex={-1}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {dropdownOpen && (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-60 overflow-y-auto"
                        data-testid="dropdown-user-list"
                      >
                        {filteredUsers.length === 0 ? (
                          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Сотрудники не найдены
                          </div>
                        ) : (
                          filteredUsers.map((u, idx) => (
                            <button
                              key={u.id}
                              type="button"
                              className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                                idx === highlightIdx ? "bg-accent text-accent-foreground" : ""
                              } ${
                                u.id === selectedUserId ? "bg-primary/5 font-medium" : ""
                              } hover:bg-accent hover:text-accent-foreground ${
                                idx > 0 ? "border-t border-border/40" : ""
                              }`}
                              onClick={() => selectUser(u)}
                              onMouseEnter={() => setHighlightIdx(idx)}
                              data-testid={`option-user-${u.id}`}
                            >
                              <div className="min-w-0">
                                <div className="truncate">{u.displayName}</div>
                                <div className="text-xs text-muted-foreground truncate">{u.department}</div>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                {u.source === "ad" ? "AD" : "Лок."}
                              </Badge>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{selectedUser.department}, {selectedUser.source === "ad" ? "Доменная учётная запись" : "Локальная учётная запись"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedUser.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password-input">Пароль</Label>
                <Input
                  id="password-input"
                  data-testid="input-password"
                  type="password"
                  placeholder={selectedUser?.source === "ad" ? "Доменный пароль" : "Пароль"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="text-login-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#e17633]"
                disabled={loading || !selectedUserId || !password}
                data-testid="button-login"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Войти
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
