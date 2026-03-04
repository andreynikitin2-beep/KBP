import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, LogIn, Building2, Shield } from "lucide-react";

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

  const selectedUser = usersList.find((u) => u.id === selectedUserId);

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
                <Label htmlFor="user-select">Сотрудник</Label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : (
                  <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); setError(""); }}>
                    <SelectTrigger id="user-select" data-testid="select-login-user" className="w-full">
                      <SelectValue placeholder="Выберите сотрудника..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id} data-testid={`option-user-${u.id}`}>
                          <div className="flex items-center gap-2">
                            <span>{u.displayName}</span>
                            <span className="text-muted-foreground text-xs">({u.department})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
