
-- pgcrypto for password hashing
create extension if not exists pgcrypto;

-- app_settings (admin-only key/value)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
grant select, insert, update, delete on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy app_settings_admin_all on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- caixa status enum
do $$ begin
  create type public.caixa_status as enum ('aberto','fechado');
exception when duplicate_object then null; end $$;

-- caixas
create table if not exists public.caixas (
  id uuid primary key default gen_random_uuid(),
  data_dia date not null,
  opened_by uuid not null,
  opened_by_nome text,
  opened_at timestamptz not null default now(),
  closed_by uuid,
  closed_by_nome text,
  closed_at timestamptz,
  status public.caixa_status not null default 'aberto',
  total_vendas numeric not null default 0,
  qtd_vendas integer not null default 0,
  broken_used boolean not null default false,
  observacao text
);
create index if not exists caixas_data_dia_idx on public.caixas(data_dia desc);
create unique index if not exists caixas_aberto_unico on public.caixas(status) where status = 'aberto';

grant select, insert, update on public.caixas to authenticated;
grant all on public.caixas to service_role;
alter table public.caixas enable row level security;
create policy caixas_select on public.caixas for select to authenticated using (true);
create policy caixas_insert on public.caixas for insert to authenticated with check (auth.uid() = opened_by);
create policy caixas_update on public.caixas for update to authenticated using (true) with check (true);

-- caixa logs
create table if not exists public.caixa_logs (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid,
  acao text not null,
  user_id uuid,
  user_nome text,
  detalhe text,
  created_at timestamptz not null default now()
);
grant select on public.caixa_logs to authenticated;
grant insert on public.caixa_logs to authenticated;
grant all on public.caixa_logs to service_role;
alter table public.caixa_logs enable row level security;
create policy caixa_logs_select_admin on public.caixa_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy caixa_logs_insert on public.caixa_logs for insert to authenticated with check (true);

-- permissoes column on funcionarios
alter table public.funcionarios
  add column if not exists permissoes text[] not null
  default array['dashboard','pdv','comandas','vendas','caixa']::text[];
