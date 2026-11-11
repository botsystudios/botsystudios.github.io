-- Botsy Studios Client Portal. Run in Supabase SQL Editor.
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
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
drop policy if exists "Clients can read their own orders" on public.orders;
create policy "Clients can read their own orders" on public.orders for select to authenticated
using (client_discord_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id'));
drop policy if exists "Clients can read events for their own orders" on public.order_events;
create policy "Clients can read events for their own orders" on public.order_events for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_events.order_id and o.client_discord_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')));
-- No client write policies: only the trusted Edge Function writes order data.
