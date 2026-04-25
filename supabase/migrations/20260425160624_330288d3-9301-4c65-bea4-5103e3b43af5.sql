
create or replace function public.join_group_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _group_id uuid;
  _user_id uuid := auth.uid();
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;
  select id into _group_id from public.groups where join_code = upper(trim(_code));
  if _group_id is null then
    return null;
  end if;
  insert into public.group_members (group_id, user_id) values (_group_id, _user_id)
    on conflict (group_id, user_id) do nothing;
  return _group_id;
end;
$$;
