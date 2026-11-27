-- LINE bot key-value store (replaces the suspended Vercel Blob store).
-- The table sits in a schema the REST API does not expose. The bot reaches it only
-- through the ssj_kv_* functions, and each call must carry the bot secret.
-- Only the secret's sha256 is kept here.
create schema if not exists ssj_private;
revoke all on schema ssj_private from public, anon, authenticated;

create table if not exists ssj_private.kv (
  key text primary key,
  body bytea not null,
  content_type text not null default 'application/octet-stream',
  updated_at timestamptz not null default now()
);
create index if not exists kv_key_prefix on ssj_private.kv (key text_pattern_ops);

create table if not exists ssj_private.bot_secret (
  id int primary key default 1 check (id = 1),
  sha256 text not null
);
alter table ssj_private.kv enable row level security;
alter table ssj_private.bot_secret enable row level security;

create or replace function ssj_private.check_secret(p_secret text) returns void
language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
begin
  if p_secret is null or not exists (
    select 1 from ssj_private.bot_secret where sha256 = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  ) then
    raise exception 'bad secret' using errcode = '28000';
  end if;
end $$;

create or replace function public.ssj_kv_put(p_secret text, p_key text, p_body text, p_type text)
returns void language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
begin
  perform ssj_private.check_secret(p_secret);
  insert into ssj_private.kv (key, body, content_type, updated_at)
  values (p_key, decode(p_body, 'base64'), coalesce(p_type, 'application/octet-stream'), now())
  on conflict (key) do update set body = excluded.body, content_type = excluded.content_type, updated_at = now();
end $$;

create or replace function public.ssj_kv_put_if_absent(p_secret text, p_key text, p_body text, p_type text)
returns boolean language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
declare n int;
begin
  perform ssj_private.check_secret(p_secret);
  insert into ssj_private.kv (key, body, content_type)
  values (p_key, decode(p_body, 'base64'), coalesce(p_type, 'application/octet-stream'))
  on conflict (key) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.ssj_kv_get(p_secret text, p_key text)
returns text language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
declare b bytea;
begin
  perform ssj_private.check_secret(p_secret);
  select body into b from ssj_private.kv where key = p_key;
  if b is null then return null; end if;
  return translate(encode(b, 'base64'), E'\n', '');
end $$;

create or replace function public.ssj_kv_list(p_secret text, p_prefix text)
returns setof text language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
begin
  perform ssj_private.check_secret(p_secret);
  return query select key from ssj_private.kv where starts_with(key, coalesce(p_prefix, '')) order by key;
end $$;

create or replace function public.ssj_kv_delete(p_secret text, p_key text)
returns void language plpgsql security definer set search_path = ssj_private, pg_catalog as $$
begin
  perform ssj_private.check_secret(p_secret);
  delete from ssj_private.kv where key = p_key;
end $$;

revoke all on function ssj_private.check_secret(text) from public, anon, authenticated;
revoke all on function public.ssj_kv_put(text, text, text, text) from public, authenticated;
revoke all on function public.ssj_kv_put_if_absent(text, text, text, text) from public, authenticated;
revoke all on function public.ssj_kv_get(text, text) from public, authenticated;
revoke all on function public.ssj_kv_list(text, text) from public, authenticated;
revoke all on function public.ssj_kv_delete(text, text) from public, authenticated;
grant execute on function public.ssj_kv_put(text, text, text, text) to anon;
grant execute on function public.ssj_kv_put_if_absent(text, text, text, text) to anon;
grant execute on function public.ssj_kv_get(text, text) to anon;
grant execute on function public.ssj_kv_list(text, text) to anon;
grant execute on function public.ssj_kv_delete(text, text) to anon;
