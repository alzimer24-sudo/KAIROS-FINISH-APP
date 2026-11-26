-- KAIROS CLOUD v0.1: schema PRIVATO, nessun risultato pubblico.
-- Eseguire nel SQL Editor del progetto Supabase scelto dal proprietario.
-- Non inserire password, chiavi service_role o dati reali nel repository.
create extension if not exists pgcrypto;

create table if not exists public.kairos_organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create table if not exists public.kairos_org_members (
 organization_id uuid not null references public.kairos_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','viewer')),
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create table if not exists public.kairos_groups (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.kairos_organizations(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now(),
 unique(id,organization_id)
);
create table if not exists public.kairos_group_members (
 group_id uuid not null references public.kairos_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table if not exists public.kairos_sessions (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.kairos_groups(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120),
 started_on date not null,
 discipline text,
 created_at timestamptz not null default now()
);
create table if not exists public.kairos_results (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.kairos_sessions(id) on delete cascade,
 bib integer not null check(bib between 1 and 99999),
 athlete_name text not null check(length(trim(athlete_name)) between 1 and 140),
 category text not null default '',
 run_number integer not null default 1 check(run_number between 1 and 100),
 elapsed_us bigint check(elapsed_us between 0 and 3600000000),
 status text not null check(status in ('FINISHED','DNF','DSQ','DNS')),
 timing_source text not null default 'HELTEC_CANDIDATE',
 timing_verified boolean not null default false,
 created_at timestamptz not null default now(),
 unique(session_id,bib,run_number)
);
-- Corregge source in ASCII per default (etichetta chiara, non certificazione).
alter table public.kairos_results alter column timing_source set default 'HELTEC_CANDIDATE';

create index if not exists kairos_org_members_user on public.kairos_org_members(user_id,organization_id);
create index if not exists kairos_group_members_user on public.kairos_group_members(user_id,group_id);
create index if not exists kairos_groups_org on public.kairos_groups(organization_id);
create index if not exists kairos_sessions_group on public.kairos_sessions(group_id);
create index if not exists kairos_results_session on public.kairos_results(session_id);

-- Funzioni SECURITY DEFINER limitate a controlli di appartenenza; evitano
-- le ricorsioni RLS sulle membership. Lo schema public è esposto, ma tutti
-- gli input sono parametrizzati e fanno sempre riferimento a auth.uid().
create or replace function public.kairos_can_view_org(p_org uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select auth.uid() is not null and exists(
   select 1 from public.kairos_org_members om
   where om.organization_id = p_org and om.user_id = (select auth.uid())
 );
$$;
create or replace function public.kairos_is_org_admin(p_org uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select auth.uid() is not null and exists(
   select 1 from public.kairos_org_members om
   where om.organization_id = p_org and om.user_id = (select auth.uid())
     and om.role in ('owner','admin')
 );
$$;
create or replace function public.kairos_can_view_group(p_group uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select auth.uid() is not null and (
  exists(
    select 1 from public.kairos_group_members gm
    where gm.group_id=p_group and gm.user_id=(select auth.uid())
  ) or exists(
    select 1 from public.kairos_groups g
    join public.kairos_org_members om on om.organization_id=g.organization_id
    where g.id=p_group and om.user_id=(select auth.uid())
      and om.role in ('owner','admin')
  )
 );
$$;
revoke all on function public.kairos_can_view_org(uuid) from public;
revoke all on function public.kairos_is_org_admin(uuid) from public;
revoke all on function public.kairos_can_view_group(uuid) from public;
grant execute on function public.kairos_can_view_org(uuid) to authenticated;
grant execute on function public.kairos_is_org_admin(uuid) to authenticated;
grant execute on function public.kairos_can_view_group(uuid) to authenticated;

alter table public.kairos_organizations enable row level security;
alter table public.kairos_org_members enable row level security;
alter table public.kairos_groups enable row level security;
alter table public.kairos_group_members enable row level security;
alter table public.kairos_sessions enable row level security;
alter table public.kairos_results enable row level security;

-- Solo lettura per le app degli utenti autorizzati.
-- Nessuna policy di INSERT/UPDATE/DELETE per il client:
-- l'import da FINISH verrà introdotto con backend protetto e controlli server.
create policy "Read my organizations" on public.kairos_organizations
 for select to authenticated using(public.kairos_can_view_org(id));
create policy "Read my org memberships" on public.kairos_org_members
 for select to authenticated using(
  user_id=(select auth.uid()) or public.kairos_is_org_admin(organization_id)
 );
create policy "Read permitted groups" on public.kairos_groups
 for select to authenticated using(public.kairos_can_view_group(id));
create policy "Read permitted group memberships" on public.kairos_group_members
 for select to authenticated using(
  user_id=(select auth.uid()) or public.kairos_can_view_group(group_id)
 );
create policy "Read permitted sessions" on public.kairos_sessions
 for select to authenticated using(public.kairos_can_view_group(group_id));
create policy "Read permitted results" on public.kairos_results
 for select to authenticated using(exists(
  select 1 from public.kairos_sessions s
  where s.id=session_id and public.kairos_can_view_group(s.group_id)
 ));

-- Non dare accesso pubblico anonimo alle tabelle.
revoke all on public.kairos_organizations, public.kairos_org_members,
 public.kairos_groups, public.kairos_group_members, public.kairos_sessions,
 public.kairos_results from anon;
grant select on public.kairos_organizations, public.kairos_org_members,
 public.kairos_groups, public.kairos_group_members, public.kairos_sessions,
 public.kairos_results to authenticated;

-- Bootstrap OWNER (eseguire manualmente SOLO dopo l'iscrizione/invito):
-- 1) Trova UUID utente in Supabase Authentication > Users.
-- 2) In SQL Editor, sostituisci YOUR_AUTH_USER_UUID con l'UUID reale:
-- begin;
-- insert into public.kairos_organizations(name)
-- values ('KAIROS - Proprietario') returning id;
-- insert into public.kairos_org_members(organization_id,user_id,role)
-- values ('ORG_UUID_GENERATO','YOUR_AUTH_USER_UUID','owner');
-- commit;
-- Questa operazione iniziale richiede l'amministratore del progetto Supabase.
