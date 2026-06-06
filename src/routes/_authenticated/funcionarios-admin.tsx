import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, KeyRound, Power, Trash2, Users, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listFuncionarios, createFuncionario, resetFuncionarioPin,
  setFuncionarioAtivo, deleteFuncionario, setFuncionarioPermissoes,
} from "@/lib/funcionarios.functions";
import { PERMISSOES_DISPONIVEIS, PERMISSOES_PADRAO } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/funcionarios-admin")({
  component: FuncionariosAdminPage,
});

type Funcionario = {
  id: string;
  nome: string;
  username: string;
  ativo: boolean;
  permissoes: string[] | null;
  created_at: string;
};

function FuncionariosAdminPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listFuncionarios);
  const create = useServerFn(createFuncionario);
  const resetPin = useServerFn(resetFuncionarioPin);
  const toggleAtivo = useServerFn(setFuncionarioAtivo);
  const del = useServerFn(deleteFuncionario);
  const setPerms = useServerFn(setFuncionarioPermissoes);

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [role, loading, navigate]);

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: () => list() as Promise<Funcionario[]>,
    enabled: role === "admin",
  });

  const [openNew, setOpenNew] = useState(false);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [novaPerms, setNovaPerms] = useState<string[]>(PERMISSOES_PADRAO as unknown as string[]);

  const [resetTarget, setResetTarget] = useState<Funcionario | null>(null);
  const [newPin, setNewPin] = useState("");

  const [permsTarget, setPermsTarget] = useState<Funcionario | null>(null);
  const [permsList, setPermsList] = useState<string[]>([]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["funcionarios"] });

  const togglePerm = (
    list: string[], set: (l: string[]) => void, id: string,
  ) => {
    set(list.includes(id) ? list.filter((p) => p !== id) : [...list, id]);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const r: any = await create({ data: { nome, username, pin } });
      if (r?.id) {
        await setPerms({ data: { id: r.id, permissoes: novaPerms } });
      }
      return r;
    },
    onSuccess: () => {
      toast.success(`Funcionário ${username} criado.`);
      setOpenNew(false);
      setNome(""); setUsername(""); setPin("");
      setNovaPerms(PERMISSOES_PADRAO as unknown as string[]);
      refresh();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetPin({ data: { id: resetTarget!.id, pin: newPin } }),
    onSuccess: () => {
      toast.success("PIN atualizado.");
      setResetTarget(null); setNewPin("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao resetar"),
  });

  const toggleMut = useMutation({
    mutationFn: (f: Funcionario) => toggleAtivo({ data: { id: f.id, ativo: !f.ativo } }),
    onSuccess: () => { toast.success("Status atualizado."); refresh(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Funcionário removido."); refresh(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const permsMut = useMutation({
    mutationFn: () => setPerms({ data: { id: permsTarget!.id, permissoes: permsList } }),
    onSuccess: () => { toast.success("Permissões atualizadas."); setPermsTarget(null); refresh(); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-3xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-accent" /> Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">
            Crie acessos de caixa com PIN numérico de 6 dígitos.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Novo funcionário
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : funcionarios.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum funcionário cadastrado.</TableCell></TableRow>
            ) : funcionarios.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell className="font-mono text-sm">{f.username}</TableCell>
                <TableCell>
                  {f.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-1 space-y-1">
                  <Button size="sm" variant="outline" onClick={() => {
                    setPermsTarget(f);
                    setPermsList((f.permissoes as string[] | null) ?? []);
                  }}>
                    <Shield className="w-3.5 h-3.5 mr-1" /> Permissões
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetTarget(f)}>
                    <KeyRound className="w-3.5 h-3.5 mr-1" /> PIN
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleMut.mutate(f)}>
                    <Power className="w-3.5 h-3.5 mr-1" /> {f.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (confirm(`Remover ${f.username}? Essa ação não pode ser desfeita.`)) deleteMut.mutate(f.id);
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Novo funcionário */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João da Silva" />
            </div>
            <div className="space-y-2">
              <Label>Usuário (login)</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="joao"
              />
              <p className="text-xs text-muted-foreground">Letras minúsculas, números, _ . -</p>
            </div>
            <div className="space-y-2">
              <Label>PIN (6 dígitos)</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resetar PIN */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar PIN de {resetTarget?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo PIN (6 dígitos)</Label>
            <Input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
              {resetMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
