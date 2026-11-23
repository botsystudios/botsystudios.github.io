-- Local setup draft for public reviews submitted by Inventor /review.
-- Review rows are written only by the trusted Edge Function using service_role.
create table if not exists public.website_reviews (
  id uuid primary key default gen_random_uuid(),
  source_event_id text not null unique,
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 80),
  service_name text not null check (char_length(service_name) between 2 and 100),
  staff_rating smallint not null check (staff_rating between 1 and 5),
  efficiency_rating smallint not null check (efficiency_rating between 1 and 5),
  final_product_rating smallint not null check (final_product_rating between 1 and 5),
  feedback text not null check (char_length(feedback) between 5 and 1000),
  created_at timestamptz not null default now(),
  published boolean not null default true
);

create index if not exists website_reviews_published_created_idx
  on public.website_reviews (created_at desc)
  where published = true;

alter table public.website_reviews enable row level security;
revoke all on public.website_reviews from anon, authenticated;
grant select (
  id, reviewer_name, service_name, staff_rating, efficiency_rating,
  final_product_rating, feedback, created_at
) on public.website_reviews to anon, authenticated;
grant all on public.website_reviews to service_role;

drop policy if exists "Anyone can read published website reviews" on public.website_reviews;
create policy "Anyone can read published website reviews"
  on public.website_reviews for select to anon, authenticated
  using (published = true);

-- There is intentionally no public insert/update/delete policy.
