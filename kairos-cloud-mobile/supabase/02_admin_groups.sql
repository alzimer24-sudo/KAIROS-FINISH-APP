-- KAIROS CLOUD - MIGRAZIONE 02
-- Eseguire in Supabase SQL Editor DOPO schema.sql.
-- Consente la creazione e la gestione dei gruppi dalla app Android/iPhone.
-- NON conferisce ai client permessi diretti di scrittura sulle tabelle.

create or replace function public.kairos_create_group(
  p_organization_id uuid, p_name text
) returns public.kairos_groups
language plpgsql security definer set search_path = ''
as $$
declare v_row public.kairos_groups;
begin
  if (select auth.uid()) is null
    or not public.kairos_is_org_admin(p_organization_id) then
    raise exception 'Non autorizzato a creare gruppi' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 120 then
    raise exception 'Nome gruppo non valido' using errcode='22023';
  end if;
  insert into public.kairos_groups(organization_id,name)
  values(p_organization_id,btrim(p_name)) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.kairos_add_group_member(
  p_group_id uuid, p_email text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_user uuid; v_email text;
begin
  select organization_id into v_org from public.kairos_groups
    where id=p_group_id;
  if v_org is null or (select auth.uid()) is null
    or not public.kairos_is_org_admin(v_org) then
    raise exception 'Non autorizzato a gestire questo gruppo' using errcode='42501';
  end if;

  v_email := lower(btrim(coalesce(p_email,'')));
  if length(v_email) not between 3 and 254
     or position('@' in v_email)<=1 then
    raise exception 'Email non valida' using errcode='22023';
  end if;
  select id into v_user from auth.users
  where lower(email)=v_email and deleted_at is null
  order by created_at desc limit 1;
  if v_user is null then
    -- L'invito dei nuovi account sarà gestito da un endpoint separato.
    raise exception 'Utente non ancora registrato. Va prima invitato.' using errcode='P0002';
  end if;

  insert into public.kairos_org_members(organization_id,user_id,role)
  values(v_org,v_user,'viewer')
  on conflict(organization_id,user_id) do nothing;
  insert into public.kairos_group_members(group_id,user_id)
  values(p_group_id,v_user) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.kairos_list_group_members(
  p_group_id uuid
) returns table(user_id uuid,email text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.kairos_groups where id=p_group_id;
  if v_org is null or (select auth.uid()) is null
    or not public.kairos_is_org_admin(v_org) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;
  return query select gm.user_id, au.email::text
    from public.kairos_group_members gm
    join auth.users au on au.id=gm.user_id
    where gm.group_id=p_group_id
    order by au.email;
end;
$$;

create or replace function public.kairos_remove_group_member(
  p_group_id uuid, p_user_id uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.kairos_groups where id=p_group_id;
  if v_org is null or (select auth.uid()) is null
    or not public.kairos_is_org_admin(v_org) then
    raise exception 'Non autorizzato' using errcode='42501';
  end if;
  delete from public.kairos_group_members
   where group_id=p_group_id and user_id=p_user_id;
  -- La membership di organizzazione rimane: può appartenere ad altri gruppi.
  return true;
end;
$$;

revoke all on function public.kairos_create_group(uuid,text) from public,anon;
revoke all on function public.kairos_add_group_member(uuid,text) from public,anon;
revoke all on function public.kairos_list_group_members(uuid) from public,anon;
revoke all on function public.kairos_remove_group_member(uuid,uuid) from public,anon;

grant execute on function public.kairos_create_group(uuid,text) to authenticated;
grant execute on function public.kairos_add_group_member(uuid,text) to authenticated;
grant execute on function public.kairos_list_group_members(uuid) to authenticated;
grant execute on function public.kairos_remove_group_member(uuid,uuid) to authenticated;

-- Verificare con due utenze di club diversi che non possano vedere né gestire
-- gruppi reciprocamente (test RLS/RPC necessari prima dell'uso reale).
