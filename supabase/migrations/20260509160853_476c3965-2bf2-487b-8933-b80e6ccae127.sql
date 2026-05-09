ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_uploader_id_fkey;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_uploader_id_fkey;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_uploader_id_fkey;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.events
  ADD CONSTRAINT events_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;