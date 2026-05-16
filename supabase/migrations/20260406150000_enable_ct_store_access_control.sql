alter table public.centros_treinamento
add column if not exists store_enabled boolean not null default false;
drop policy if exists "Public read published ct store pages" on public.ct_store_pages;
create policy "Public read published ct store pages"
on public.ct_store_pages
for select
to anon, authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.centros_treinamento ct
    where ct.id = ct_store_pages.ct_id
      and ct.store_enabled = true
  )
);
drop policy if exists "CT owners manage own ct store page" on public.ct_store_pages;
create policy "CT owners manage own ct store page"
on public.ct_store_pages
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and exists (
    select 1
    from public.centros_treinamento ct
    where ct.id = ct_store_pages.ct_id
      and ct.store_enabled = true
  )
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and exists (
    select 1
    from public.centros_treinamento ct
    where ct.id = ct_store_pages.ct_id
      and ct.store_enabled = true
  )
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
    join public.centros_treinamento ct on ct.id = page.ct_id
    where page.id = store_page_id
      and page.is_published = true
      and ct.store_enabled = true
  )
);
drop policy if exists "CT owners manage own ct store products" on public.ct_store_products;
create policy "CT owners manage own ct store products"
on public.ct_store_products
for all
to authenticated
using (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and exists (
    select 1
    from public.centros_treinamento ct
    where ct.id = ct_store_products.ct_id
      and ct.store_enabled = true
  )
)
with check (
  public.has_role(auth.uid(), 'mestre'::public.app_role)
  and public.is_ct_owner(auth.uid(), ct_id)
  and exists (
    select 1
    from public.centros_treinamento ct
    where ct.id = ct_store_products.ct_id
      and ct.store_enabled = true
  )
);
