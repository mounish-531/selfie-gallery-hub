
drop policy if exists "anyone can view group uploads" on storage.objects;
create policy "authenticated can view group uploads" on storage.objects for select to authenticated
  using (bucket_id = 'group-uploads');
