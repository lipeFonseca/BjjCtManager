-- Restrict global login branding to admins only and close storage write access that was
-- previously open to every authenticated user.

drop policy if exists "Mestres can manage login config" on public.layout_config;
drop policy if exists "Auth upload login-assets" on storage.objects;
drop policy if exists "Auth update login-assets" on storage.objects;
drop policy if exists "Auth delete login-assets" on storage.objects;
create policy "Admins upload login-assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'login-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
create policy "Admins update login-assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'login-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'login-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
create policy "Admins delete login-assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'login-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
