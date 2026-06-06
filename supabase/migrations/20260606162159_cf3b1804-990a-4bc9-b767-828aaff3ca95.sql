
create or replace function public.crypt_hash(pwd text)
returns text language sql security definer set search_path = public, extensions, pg_temp as $$
  select extensions.crypt(pwd, extensions.gen_salt('bf'));
$$;

create or replace function public.crypt_check(pwd text, hash text)
returns boolean language sql security definer set search_path = public, extensions, pg_temp as $$
  select extensions.crypt(pwd, hash) = hash;
$$;

revoke all on function public.crypt_hash(text) from public, anon, authenticated;
revoke all on function public.crypt_check(text, text) from public, anon, authenticated;
grant execute on function public.crypt_hash(text) to service_role;
grant execute on function public.crypt_check(text, text) to service_role;
