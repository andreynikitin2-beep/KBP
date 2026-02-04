import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full kb-hero-grid kb-noise flex items-center justify-center p-6">
      <Card className="w-full max-w-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-destructive/10 p-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="font-serif text-2xl leading-tight">Страница не найдена</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Возможно, ссылка устарела или у вас нет доступа к разделу.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link href="/">
                  <Button data-testid="button-go-home" variant="default">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    На главную
                  </Button>
                </Link>
                <Link href="/catalog">
                  <Button data-testid="button-go-catalog" variant="outline">
                    Каталог
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
