create table if not exists public.ct_store_pages (
  id uuid primary key default gen_random_uuid(),
  ct_id uuid not null unique references public.centros_treinamento(id) on delete cascade,
  slug text not null unique,
  store_name text not null default '',
  title text not null default '',
  subtitle text not null default '',
  description text not null default '',
  hero_image_url text,
  logo_image_url text,
  background_image_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#f59e0b',
  accent_color text not null default '#ffffff',
  surface_color text not null default '#ffffff',
  text_color text not null default '#111827',
  headline_font_family text not null default 'oswald',
  body_font_family text not null default 'inter',
  hero_layout text not null default 'split',
  button_label text not null default 'Comprar agora',
  contact_phone text,
  instagram_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ct_store_pages_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint ct_store_pages_primary_color_check
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint ct_store_pages_secondary_color_check
    check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint ct_store_pages_accent_color_check
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint ct_store_pages_surface_color_check
    check (surface_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint ct_store_pages_text_color_check
    check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint ct_store_pages_headline_font_family_check
    check (headline_font_family in ('oswald', 'bebas-neue', 'montserrat', 'playfair-display')),
  constraint ct_store_pages_body_font_family_check
    check (body_font_family in ('inter', 'lato', 'open-sans', 'roboto')),
  constraint ct_store_pages_hero_layout_check
    check (hero_layout in ('split', 'centered'))
);
create table if not exists public.ct_store_products (
  id uuid primary key default gen_random_uuid(),
  ct_id uuid not null references public.centros_treinamento(id) on delete cascade,
  store_page_id uuid not null references public.ct_store_pages(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  image_url text,
  checkout_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ct_store_products_store_page_sort_idx
on public.ct_store_products (store_page_id, sort_order asc, created_at asc);
create or replace function public.set_ct_store_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create or replace function public.sync_ct_store_product_ct_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_ct_id uuid;
begin
  select ct_id
  into expected_ct_id
  from public.ct_store_pages
  where id = new.store_page_id;

  if expected_ct_id is null then
    raise exception 'Loja nao encontrada para o produto informado.';
  end if;

  new.ct_id := expected_ct_id;
  return new;
end;
$$;
drop trigger if exists trg_ct_store_pages_updated_at on public.ct_store_pages;
create trigger trg_ct_store_pages_updated_at
before update on public.ct_store_pages
for each row
execute function public.set_ct_store_updated_at();
drop trigger if exists trg_ct_store_products_updated_at on public.ct_store_products;
create trigger trg_ct_store_products_updated_at
before update on public.ct_store_products
for each row
execute function public.set_ct_store_updated_at();
drop trigger if exists trg_ct_store_products_sync_ct_id on public.ct_store_products;
create trigger trg_ct_store_products_sync_ct_id
before insert or update on public.ct_store_products
for each row
execute function public.sync_ct_store_product_ct_id();
alter table public.ct_store_pages enable row level security;
alter table public.ct_store_products enable row level security;
drop policy if exists "Public read published ct store pages" on public.ct_store_pages;
create policy "Public read published ct store pages"
on public.ct_store_pages
for select
to anon, authenticated
using (is_published = true);
drop policy if exists "Admins manage ct store pages" on public.ct_store_pages;
create policy "Admins manage ct store pages"
on public.ct_store_pages
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "CT owners manage own ct store page" on public.ct_store_pages;
create policy "CT owners manage own ct store page"
on public.ct_store_pages
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
);
drop policy if exists "Public read active products from published stores" on public.ct_store_products;
create policy "Public read active products from published stores"
on public.ct_store_products
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.ct_store_pages page
    where page.id = store_page_id
      and page.is_published = true
  )
);
drop policy if exists "Admins manage ct store products" on public.ct_store_products;
create policy "Admins manage ct store products"
on public.ct_store_products
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "CT owners manage own ct store products" on public.ct_store_products;
create policy "CT owners manage own ct store products"
on public.ct_store_products
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
);
insert into storage.buckets (id, name, public)
values ('ct-store-assets', 'ct-store-assets', true)
on conflict (id) do update
set public = true;
drop policy if exists "Admins manage ct-store-assets" on storage.objects;
drop policy if exists "CT owners upload own ct-store-assets" on storage.objects;
drop policy if exists "CT owners update own ct-store-assets" on storage.objects;
drop policy if exists "CT owners delete own ct-store-assets" on storage.objects;
create policy "Admins manage ct-store-assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
create policy "CT owners upload own ct-store-assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_ct_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
create policy "CT owners update own ct-store-assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_ct_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_ct_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
create policy "CT owners delete own ct-store-assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ct-store-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_ct_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
