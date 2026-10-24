-- Fixes: "Could not find a relationship between 'reviews' and 'products' in the schema cache"
-- Run this once in the Supabase SQL Editor. Safe to re-run.

-- 1) Make sure the reviews table exists (does nothing if it already does).
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null,
  author_name text not null default '',
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

-- 2) Remove reviews that point at products that no longer exist (they would block the key).
delete from public.reviews r
 where not exists (select 1 from public.products p where p.id = r.product_id);

-- 3) Add the missing foreign key reviews.product_id -> products.id.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reviews'::regclass
       and contype = 'f'
       and confrelid = 'public.products'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_product_id_fkey
      foreign key (product_id) references public.products (id) on delete cascade;
  end if;
end $$;

-- 4) Row-level security so everyone can read and customers can write their own.
alter table public.reviews enable row level security;
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read" on public.reviews for select using (true);
drop policy if exists "reviews: self insert" on public.reviews;
create policy "reviews: self insert" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews: self update" on public.reviews;
create policy "reviews: self update" on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reviews: self delete" on public.reviews;
create policy "reviews: self delete" on public.reviews for delete using (auth.uid() = user_id);

-- 5) Tell the API to reload its schema cache.
notify pgrst, 'reload schema';
