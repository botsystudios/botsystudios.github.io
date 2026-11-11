-- Botsy Studios Client Portal. Secure Discord identity mapping is populated by an Auth trigger.
create extension if not exists pgcrypto;
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 external_order_id text not null unique,
 client_discord_id text not null,
 client_discord_username text,
 service_name text not null,
 status text not null default 'approved',
 claimed_by_discord_id text,
 claimed_by_name text,
 ticket_channel_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_events (
 id uuid primary key default gen_random_uuid(),
 source_event_id text unique,
 order_id uuid not null references public.orders(id) on delete cascade,
 event_type text not null,
 title text not null,
 description text,
 actor_discord_id text,
 actor_name text,
 created_at timestamptz not null default now()
);
create index if not exists orders_client_discord_id_idx on public.orders(client_discord_id);
create index if not exists order_events_order_id_created_at_idx on public.order_events(order_id, created_at desc);

create table if not exists public.discord_identities (
 user_id uuid primary key references auth.users(id) on delete cascade,
 discord_id text not null unique,
 created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.discord_identities enable row level security;
grant select on public.discord_identities to authenticated;

drop policy if exists "Users can read own Discord identity" on public.discord_identities;
create policy "Users can read own Discord identity"
on public.discord_identities for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.handle_new_discord_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare discord_id_value text;
begin
 if new.raw_app_meta_data ->> 'provider' = 'discord' then
  discord_id_value := new.raw_user_meta_data ->> 'provider_id';
  if discord_id_value is not null and discord_id_value <> '' then
   insert into public.discord_identities (user_id, discord_id)
   values (new.id, discord_id_value)
   on conflict (user_id) do update set discord_id = excluded.discord_id;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.handle_new_discord_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_discord on auth.users;
create trigger on_auth_user_created_discord after insert on auth.users
for each row execute function public.handle_new_discord_user();

insert into public.discord_identities (user_id, discord_id)
select id, raw_user_meta_data ->> 'provider_id' from auth.users
where raw_app_meta_data ->> 'provider' = 'discord'
and coalesce(raw_user_meta_data ->> 'provider_id', '') <> ''
on conflict (user_id) do update set discord_id = excluded.discord_id;

drop policy if exists "Clients can read their own orders" on public.orders;
create policy "Clients can read their own orders" on public.orders for select to authenticated
using (exists (
 select 1 from public.discord_identities di
 where di.user_id = (select auth.uid()) and di.discord_id = orders.client_discord_id
));
drop policy if exists "Clients can read events for their own orders" on public.order_events;
create policy "Clients can read events for their own orders" on public.order_events for select to authenticated
using (exists (
 select 1 from public.orders o
 join public.discord_identities di on di.discord_id = o.client_discord_id
 where o.id = order_events.order_id and di.user_id = (select auth.uid())
));
-- No client write policies: only the trusted Edge Function writes order data.
