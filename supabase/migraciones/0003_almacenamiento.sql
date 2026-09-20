-- =====================================================================
-- 0003: bucket privado para las fotos de las facturas
-- Privado = las imágenes no se sirven por URL directa. La app genera
-- enlaces firmados de corta duración para Jose y Yenny.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas',
  'facturas',
  false,
  10485760,                                              -- 10 MB por foto
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ver archivos de facturas" on storage.objects;
create policy "ver archivos de facturas" on storage.objects
  for select to authenticated
  using (bucket_id = 'facturas' and mi_rol() in ('comprador', 'financista'));

drop policy if exists "subir archivos de facturas" on storage.objects;
create policy "subir archivos de facturas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and mi_rol() = 'comprador');
