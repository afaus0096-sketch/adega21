import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "super_admin" | "admin" | "caixa";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
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
  const [permissoes, setPermissoes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = (uid: string) => {
    setTimeout(async () => {
      const { data: roles } = await supabase.from("user_roles").select("role");
      const list = (roles ?? []) as { role: Role }[];
      const r: Role | null =
        list.find((x) => x.role === "super_admin")?.role ??
        list.find((x) => x.role === "admin")?.role ??
        list.find((x) => x.role === "caixa")?.role ??
        null;
      setRole(r);

      if (r === "super_admin" || r === "admin") {
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
      else { setRole(null); setPermissoes(null); }
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
    <Ctx.Provider value={{ user, session, role, permissoes, loading, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
