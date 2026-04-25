CREATE OR REPLACE FUNCTION public.handle_new_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.group_members (group_id, user_id)
    values (new.id, new.creator_id)
    on conflict (group_id, user_id) do nothing;
  insert into public.notification_preferences (user_id, group_id)
    values (new.creator_id, new.id)
    on conflict (user_id, group_id) do nothing;
  return new;
end; $function$;