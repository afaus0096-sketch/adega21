
# Multi-tenant — Adegas

## 1. Banco de dados (migração única)

**Nova tabela `adegas`**
- `id`, `nome`, `slug` (único), `ativo`, `created_at`, `created_by`

**Novo role `super_admin`** (adicionado ao enum `app_role`).
- Único usuário com poder de criar adegas e cadastrar o primeiro ADM de cada uma.
- Não pertence a nenhuma adega.

**Coluna `adega_id` adicionada em todas as tabelas de negócio:**
`produtos`, `categorias`, `fornecedores`, `vendas`, `itens_venda`, `fluxo_caixa`, `comandas`, `itens_comanda`, `caixas`, `caixa_logs`, `movimentacoes_estoque`, `funcionarios`, `profiles`, `app_settings`.

**`user_roles`** ganha `adega_id` (nullable apenas para `super_admin`). Um usuário ADM/caixa só pertence a uma adega.

**Funções de segurança (SECURITY DEFINER):**
- `current_adega_id()` — lê a adega do usuário logado a partir de `user_roles`.
- `is_super_admin()` — true se o usuário tem role `super_admin`.
- `has_role_in_adega(uid, role, adega)` — substitui o `has_role` atual.

**RLS reescrita** em todas as tabelas acima: SELECT/INSERT/UPDATE/DELETE só passam quando `adega_id = current_adega_id()` (ou `is_super_admin()`). `vendas.user_id`, `comandas.user_id` etc. continuam validados.

**Seed:** cria uma adega "Adega Principal" e migra todos os dados existentes para ela; o ADM atual recebe `adega_id` dessa adega. Promovo o primeiro ADM existente a `super_admin` também (assim você não fica trancado de fora).

## 2. Tela de login

- Dropdown público "Selecione a adega" no topo, listando `adegas` ativas (consulta sem autenticação via server function pública usando `supabaseAdmin`, retornando só `id, nome, slug`).
- Abas existentes (Master ADM / Funcionário) ficam abaixo. O login valida que o usuário pertence à adega escolhida; se não pertencer, erro.
- Aba extra **"Super Admin"** discreta, sem dropdown de adega, só email + senha.

## 3. Painel Super Admin (`/super-admin`)

Visível só para `super_admin` no menu lateral. Permite:
- Listar adegas (ativa/inativa, ativar/desativar).
- **Criar nova adega**: nome, slug, e cria o **primeiro ADM** (email + senha) já vinculado a ela.
- **Importar catálogo**: ao criar nova adega, opção "Copiar produtos de uma adega existente" (select). Copia `categorias` + `produtos` (sem estoque, sem fornecedores) via server function admin.

## 4. Configurações (ADM normal)
- Continua com a senha Broken Caixa, agora escopada por adega.

## 5. AppShell / contexto
- `useAuth` passa a expor `adegaId` e `adegaNome`.
- Header lateral mostra o nome da adega abaixo do logo.
- Toda query do app já é filtrada automaticamente pela RLS — não preciso reescrever telas de PDV/estoque/etc., só garantir que inserts populam `adega_id` (faço isso com `DEFAULT current_adega_id()` nas colunas, então o front nem muda).

## 6. Arquivos
- **Migração:** 1 arquivo SQL grande.
- **Server functions novas:** `src/lib/adegas.functions.ts` (list pública, create, copy-catalog, create-first-admin).
- **Rotas novas:** `src/routes/_authenticated/super-admin.tsx`.
- **Editados:** `src/routes/login.tsx`, `src/lib/auth.tsx`, `src/components/AppShell.tsx`, `src/routes/_authenticated/route.tsx` (gate super admin), `src/routes/_authenticated/funcionarios-admin.tsx` (insert popula adega_id implicitamente via default).

## Riscos / observações
- Migração é destrutiva-ish nas policies (DROP + recreate). Os dados existentes ficam preservados e vinculados à "Adega Principal".
- O dropdown de adegas no login é público (qualquer um vê a lista de nomes). Você confirmou que isso é OK — se preferir esconder no futuro, troco por slug digitado.
- Funcionário existente: migro `permissoes` mantendo tudo; ele fica preso à Adega Principal.
