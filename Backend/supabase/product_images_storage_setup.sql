-- Flora product image upload setup (run once in Supabase SQL Editor)
-- The bucket is public for storefront display; uploads require a signed-in user.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "Flora product images public read" on storage.objects;
create policy "Flora product images public read" on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "Flora product images authenticated upload" on storage.objects;
drop policy if exists "Flora product images admin upload" on storage.objects;
create policy "Flora product images admin upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
