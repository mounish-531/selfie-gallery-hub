
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  join_code text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

-- group_members
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);
alter table public.group_members enable row level security;

-- security definer to avoid recursion
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group_id and user_id = _user_id)
$$;

create or replace function public.is_group_creator(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups where id = _group_id and creator_id = _user_id)
$$;

-- groups policies
create policy "members can view their groups" on public.groups for select to authenticated
  using (creator_id = auth.uid() or public.is_group_member(id, auth.uid()));
create policy "anyone authenticated can create group" on public.groups for insert to authenticated
  with check (creator_id = auth.uid());
create policy "creator can update group" on public.groups for update to authenticated
  using (creator_id = auth.uid());
create policy "creator can delete group" on public.groups for delete to authenticated
  using (creator_id = auth.uid());

-- group_members policies
create policy "members view membership of their groups" on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid()));
create policy "users can join groups themselves" on public.group_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "users can leave groups" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_creator(group_id, auth.uid()));

-- photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  caption text,
  custom_message text,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;
create policy "members view photos" on public.photos for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid()));
create policy "members upload photos" on public.photos for insert to authenticated
  with check (uploader_id = auth.uid() and (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid())));
create policy "uploader updates own photo" on public.photos for update to authenticated using (uploader_id = auth.uid());
create policy "uploader deletes own photo" on public.photos for delete to authenticated using (uploader_id = auth.uid());

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz,
  location text,
  invite_url text,
  custom_message text,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "members view events" on public.events for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid()));
create policy "members create events" on public.events for insert to authenticated
  with check (uploader_id = auth.uid() and (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid())));
create policy "uploader updates own event" on public.events for update to authenticated using (uploader_id = auth.uid());
create policy "uploader deletes own event" on public.events for delete to authenticated using (uploader_id = auth.uid());

-- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  custom_message text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "members view posts" on public.posts for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid()));
create policy "members create posts" on public.posts for insert to authenticated
  with check (uploader_id = auth.uid() and (public.is_group_member(group_id, auth.uid()) or public.is_group_creator(group_id, auth.uid())));
create policy "uploader updates own post" on public.posts for update to authenticated using (uploader_id = auth.uid());
create policy "uploader deletes own post" on public.posts for delete to authenticated using (uploader_id = auth.uid());

-- notification preferences
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  notify_photos boolean not null default true,
  notify_events boolean not null default true,
  notify_posts boolean not null default true,
  unique(user_id, group_id)
);
alter table public.notification_preferences enable row level security;
create policy "users view own prefs" on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy "users insert own prefs" on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "users update own prefs" on public.notification_preferences for update to authenticated using (user_id = auth.uid());
create policy "users delete own prefs" on public.notification_preferences for delete to authenticated using (user_id = auth.uid());

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- auto-add creator as member when creating group
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.creator_id);
  insert into public.notification_preferences (user_id, group_id) values (new.creator_id, new.id);
  return new;
end; $$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- auto-create notification prefs when joining
create or replace function public.handle_new_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_preferences (user_id, group_id)
  values (new.user_id, new.group_id)
  on conflict (user_id, group_id) do nothing;
  return new;
end; $$;

create trigger on_member_joined
  after insert on public.group_members
  for each row execute function public.handle_new_member();

-- storage bucket for photos and event invites
insert into storage.buckets (id, name, public) values ('group-uploads', 'group-uploads', true);

create policy "authenticated can upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'group-uploads');
create policy "anyone can view group uploads" on storage.objects for select to public
  using (bucket_id = 'group-uploads');
create policy "users delete own uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'group-uploads' and owner = auth.uid());
