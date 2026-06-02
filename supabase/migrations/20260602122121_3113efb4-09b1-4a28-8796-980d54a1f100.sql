
-- ===== ENUMS =====
create type public.app_role as enum ('admin', 'caixa');
create type public.movimento_tipo as enum ('entrada_compra','entrada_ajuste','entrada_inventario','saida_venda','saida_perda','saida_quebra','saida_ajuste');
create type public.pagamento_forma as enum ('dinheiro','pix','debito','credito');
create type public.fluxo_tipo as enum ('entrada','saida');

-- ===== PROFILES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- ===== USER ROLES =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles_select_auth" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- ===== CATEGORIAS =====
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.categorias to authenticated;
grant insert, update, delete on public.categorias to authenticated;
grant all on public.categorias to service_role;
alter table public.categorias enable row level security;
create policy "cat_select" on public.categorias for select to authenticated using (true);
create policy "cat_admin_all" on public.categorias for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== FORNECEDORES =====
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.fornecedores to authenticated;
grant all on public.fornecedores to service_role;
alter table public.fornecedores enable row level security;
create policy "forn_select" on public.fornecedores for select to authenticated using (true);
create policy "forn_admin_all" on public.fornecedores for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== PRODUTOS =====
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text not null unique,
  codigo_barras text unique,
  nome text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  marca text,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  preco_custo numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  estoque numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.produtos(nome);
create index on public.produtos(codigo_barras);
grant select, insert, update, delete on public.produtos to authenticated;
grant all on public.produtos to service_role;
alter table public.produtos enable row level security;
create policy "prod_select" on public.produtos for select to authenticated using (true);
create policy "prod_admin_all" on public.produtos for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== MOVIMENTAÇÕES ESTOQUE =====
create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo movimento_tipo not null,
  quantidade numeric(12,3) not null,
  observacao text,
  user_id uuid references auth.users(id),
  venda_id uuid,
  created_at timestamptz not null default now()
);
create index on public.movimentacoes_estoque(produto_id);
create index on public.movimentacoes_estoque(created_at desc);
grant select, insert on public.movimentacoes_estoque to authenticated;
grant all on public.movimentacoes_estoque to service_role;
alter table public.movimentacoes_estoque enable row level security;
create policy "mov_select" on public.movimentacoes_estoque for select to authenticated using (true);
create policy "mov_insert" on public.movimentacoes_estoque for insert to authenticated with check (auth.uid() = user_id);

-- ===== VENDAS =====
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  numero serial not null,
  user_id uuid not null references auth.users(id),
  total numeric(12,2) not null,
  forma_pagamento pagamento_forma not null,
  valor_recebido numeric(12,2),
  troco numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.vendas(created_at desc);
grant select, insert on public.vendas to authenticated;
grant all on public.vendas to service_role;
alter table public.vendas enable row level security;
create policy "venda_select" on public.vendas for select to authenticated using (true);
create policy "venda_insert" on public.vendas for insert to authenticated with check (auth.uid() = user_id);

-- ===== ITENS VENDA =====
create table public.itens_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  produto_nome text not null,
  quantidade numeric(12,3) not null,
  preco_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null
);
create index on public.itens_venda(venda_id);
grant select, insert on public.itens_venda to authenticated;
grant all on public.itens_venda to service_role;
alter table public.itens_venda enable row level security;
create policy "iv_select" on public.itens_venda for select to authenticated using (true);
create policy "iv_insert" on public.itens_venda for insert to authenticated with check (true);

-- ===== FLUXO CAIXA =====
create table public.fluxo_caixa (
  id uuid primary key default gen_random_uuid(),
  tipo fluxo_tipo not null,
  categoria text not null,
  descricao text,
  valor numeric(12,2) not null,
  venda_id uuid references public.vendas(id) on delete set null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.fluxo_caixa(created_at desc);
grant select, insert, delete on public.fluxo_caixa to authenticated;
grant all on public.fluxo_caixa to service_role;
alter table public.fluxo_caixa enable row level security;
create policy "fx_select" on public.fluxo_caixa for select to authenticated using (true);
create policy "fx_insert" on public.fluxo_caixa for insert to authenticated with check (true);
create policy "fx_admin_delete" on public.fluxo_caixa for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== TRIGGER: auto-create profile + default role =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  -- primeiro usuário vira admin; demais = caixa
  if (select count(*) from public.user_roles) = 0 then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'caixa');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== TRIGGER: vendas atualizam estoque + fluxo =====
create or replace function public.aplicar_venda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- reduz estoque
  update public.produtos set estoque = estoque - new.quantidade where id = new.produto_id;
  -- registra movimentação
  insert into public.movimentacoes_estoque(produto_id, tipo, quantidade, observacao, user_id, venda_id)
  values (new.produto_id, 'saida_venda', new.quantidade, 'Venda automática', auth.uid(), new.venda_id);
  return new;
end;
$$;

create trigger on_item_venda_insert
  after insert on public.itens_venda
  for each row execute function public.aplicar_venda();

create or replace function public.registrar_fluxo_venda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.fluxo_caixa(tipo, categoria, descricao, valor, venda_id, user_id)
  values ('entrada', 'Venda', 'Venda #' || new.numero, new.total, new.id, new.user_id);
  return new;
end;
$$;

create trigger on_venda_insert
  after insert on public.vendas
  for each row execute function public.registrar_fluxo_venda();

-- ===== SEED CATEGORIAS =====
insert into public.categorias(nome) values
('Cervejas'),('Destilados'),('Vinhos'),('Refrigerantes'),('Energéticos'),
('Água'),('Gelo'),('Carvão'),('Salgadinhos'),('Doces'),('Tabacaria'),('Conveniência');
