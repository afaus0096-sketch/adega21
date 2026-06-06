import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { canAccess } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

function Layout() {
  const { user, loading, role, permissoes } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const allowed =
    role == null || // ainda carregando
    canAccess(role, permissoes, location.pathname);

  return (
    <AppShell>
      {allowed ? <Outlet /> : <NoAccess />}
    </AppShell>
  );
}

function NoAccess() {
  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-3">
      <ShieldAlert className="w-12 h-12 mx-auto text-destructive" />
      <h2 className="display text-2xl font-bold">Acesso restrito</h2>
      <p className="text-muted-foreground text-sm">
        Você não tem permissão para acessar esta tela. Fale com o administrador.
      </p>
    </div>
  );
}
