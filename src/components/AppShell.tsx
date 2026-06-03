import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Receipt,
  Truck, Wallet, LogOut, Wine, Menu, X, FileBarChart2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: false },
  { to: "/pdv", label: "Frente de Caixa", icon: ShoppingCart, admin: false },
  { to: "/produtos", label: "Produtos", icon: Package, admin: false },
  { to: "/estoque", label: "Estoque", icon: Boxes, admin: false },
  { to: "/vendas", label: "Vendas", icon: Receipt, admin: false },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, admin: true },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, admin: true },
  { to: "/fechamento", label: "Fechamento", icon: FileBarChart2, admin: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, role, user } = useAuth();
  const { location } = useRouterState();
  const [open, setOpen] = useState(false);

  const visible = items.filter((i) => !i.admin || role === "admin");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 flex items-center justify-between border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Wine className="w-6 h-6 text-accent" />
            <span className="display text-lg font-bold text-sidebar-foreground">Adega PDV</span>
          </Link>
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visible.map((i) => {
            const active = location.pathname.startsWith(i.to);
            const Icon = i.icon;
            return (
              <Link
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                {i.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 py-1.5 text-xs">
            <div className="text-sidebar-foreground font-medium truncate">{user?.email}</div>
            <div className="text-muted-foreground capitalize">{role ?? "—"}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border p-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2"><Menu className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <Wine className="w-5 h-5 text-accent" />
            <span className="display font-bold">Adega PDV</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
