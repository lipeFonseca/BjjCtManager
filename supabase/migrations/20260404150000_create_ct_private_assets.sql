insert into storage.buckets (id, name, public)
values ('ct-private-assets', 'ct-private-assets', false)
on conflict (id) do update
set public = false;
drop policy if exists "Admins manage ct-private-assets" on storage.objects;
drop policy if exists "Admins read ct-private-assets" on storage.objects;
drop policy if exists "CT members read own ct-private-assets" on storage.objects;
drop policy if exists "Mestres upload own ct-private-assets" on storage.objects;
drop policy if exists "Mestres update own ct-private-assets" on storage.objects;
drop policy if exists "Mestres delete own ct-private-assets" on storage.objects;
create policy "Admins manage ct-private-assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
create policy "CT members read own ct-private-assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ct-private-assets'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
  )
);
create policy "Mestres upload own ct-private-assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
);
create policy "Mestres update own ct-private-assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
)
with check (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
);
create policy "Mestres delete own ct-private-assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ct-private-assets'
  and public.has_role(auth.uid(), 'mestre'::public.app_role)
  and (storage.foldername(name))[1] = public.get_user_ct(auth.uid())::text
);
