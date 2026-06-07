import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "caixa" | "super_admin";

interface Adega { id: string; nome: string; slug: string }

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  isSuperAdmin: boolean;
  adega: Adega | null;
  permissoes: string[] | null; // null = admin (acesso total)
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adega, setAdega] = useState<Adega | null>(null);
  const [permissoes, setPermissoes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = (uid: string) => {
    setTimeout(async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, adega_id");
      const list = (roles ?? []) as { role: Role; adega_id: string | null }[];
      const superA = list.some((r) => r.role === "super_admin");
      setIsSuperAdmin(superA);

      // Role principal (na adega)
      const tenantRole = list.find((r) => r.role === "admin" || r.role === "caixa");
      const r: Role | null = superA
        ? "super_admin"
        : tenantRole?.role ?? null;
      setRole(r);

      // Carrega adega
      const adegaId = tenantRole?.adega_id ?? null;
      if (adegaId) {
        const { data: a } = await supabase
          .from("adegas")
          .select("id, nome, slug")
          .eq("id", adegaId)
          .maybeSingle();
        setAdega(a ?? null);
      } else {
        setAdega(null);
      }

      // Permissões
      if (r === "admin" || r === "super_admin") {
        setPermissoes(null);
      } else if (r === "caixa") {
        const { data: f } = await supabase
          .from("funcionarios")
          .select("permissoes")
          .eq("id", uid)
          .maybeSingle();
        setPermissoes((f?.permissoes as string[] | undefined) ?? []);
      } else {
        setPermissoes([]);
      }
    }, 0);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      else { setRole(null); setIsSuperAdmin(false); setAdega(null); setPermissoes(null); }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };
  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { nome } },
    });
    return { error: error?.message };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, session, role, isSuperAdmin, adega, permissoes, loading, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
