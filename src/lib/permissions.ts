// Lista de telas que podem ser controladas por permissão de funcionário.
// Telas exclusivas do administrador (funcionarios-admin, impressoras,
// configuracoes) NUNCA aparecem aqui — admins têm tudo, funcionários não.

export const PERMISSOES_DISPONIVEIS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pdv", label: "Frente de Caixa (PDV)" },
  { id: "caixa", label: "Abertura/Fechamento de Caixa" },
  { id: "comandas", label: "Contas Abertas" },
  { id: "vendas", label: "Vendas" },
  { id: "produtos", label: "Produtos" },
  { id: "estoque", label: "Estoque" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "financeiro", label: "Financeiro" },
  { id: "fechamento", label: "Fechamento / Relatórios" },
] as const;

export type PermissaoId = (typeof PERMISSOES_DISPONIVEIS)[number]["id"];

export const PERMISSOES_PADRAO: PermissaoId[] = [
  "dashboard",
  "pdv",
  "comandas",
  "vendas",
  "caixa",
];

// Mapa rota -> permissão necessária. Rotas só de admin não estão aqui.
export const ROUTE_PERMISSION: Record<string, PermissaoId> = {
  "/dashboard": "dashboard",
  "/pdv": "pdv",
  "/caixa": "caixa",
  "/comandas": "comandas",
  "/vendas": "vendas",
  "/produtos": "produtos",
  "/estoque": "estoque",
  "/fornecedores": "fornecedores",
  "/financeiro": "financeiro",
  "/fechamento": "fechamento",
};

export function canAccess(
  role: "admin" | "caixa" | "super_admin" | null,
  permissoes: string[] | null,
  pathname: string,
): boolean {
  if (role === "super_admin") return true;
  if (role === "admin") {
    // admin de adega não acessa rota de super admin
    if (pathname.startsWith("/super-admin")) return false;
    return true;
  }
  // Rotas admin-only:
  if (
    pathname.startsWith("/funcionarios-admin") ||
    pathname.startsWith("/impressoras") ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/super-admin")
  ) {
    return false;
  }
  const key = Object.keys(ROUTE_PERMISSION).find((p) => pathname.startsWith(p));
  if (!key) return true;
  return (permissoes ?? []).includes(ROUTE_PERMISSION[key]);
}
