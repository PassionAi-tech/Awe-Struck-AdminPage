-- Awe-Struck shared workspace database schema
-- Run in the SQL Editor of Supabase project knnviulwnsoynxfznhck.
-- Each signed-up user gets a private workspace. Add family users to the same
-- workspace using the owner-only SQL procedure in README after their account exists.

create table public.awestruck_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Awe-Struck',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.awestruck_members (
  workspace_id uuid not null references public.awestruck_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index awestruck_members_user_id_idx on public.awestruck_members(user_id);

create table public.awestruck_workspace_data (
  workspace_id uuid primary key references public.awestruck_workspaces(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.awestruck_workspaces enable row level security;
alter table public.awestruck_members enable row level security;
alter table public.awestruck_workspace_data enable row level security;

-- Membership reads are restricted to the signed-in user's own membership row.
create policy "Users can view their own workspace memberships"
on public.awestruck_members for select to authenticated
using (user_id = (select auth.uid()));

create policy "Members can view their workspaces"
on public.awestruck_workspaces for select to authenticated
using (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspaces.id
    and m.user_id = (select auth.uid())
));

create policy "Workspace owners can update workspace details"
on public.awestruck_workspaces for update to authenticated
using (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspaces.id
    and m.user_id = (select auth.uid()) and m.role = 'owner'
))
with check (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspaces.id
    and m.user_id = (select auth.uid()) and m.role = 'owner'
));

create policy "Members can read shared workspace data"
on public.awestruck_workspace_data for select to authenticated
using (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspace_data.workspace_id
    and m.user_id = (select auth.uid())
));

create policy "Members can create shared workspace data"
on public.awestruck_workspace_data for insert to authenticated
with check (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspace_data.workspace_id
    and m.user_id = (select auth.uid())
));

create policy "Members can update shared workspace data"
on public.awestruck_workspace_data for update to authenticated
using (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspace_data.workspace_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.awestruck_members m
  where m.workspace_id = awestruck_workspace_data.workspace_id
    and m.user_id = (select auth.uid())
));

grant select, update on public.awestruck_workspaces to authenticated;
grant select on public.awestruck_members to authenticated;
grant select, insert, update on public.awestruck_workspace_data to authenticated;
revoke all on public.awestruck_workspaces from anon;
revoke all on public.awestruck_members from anon;
revoke all on public.awestruck_workspace_data from anon;

create or replace function public.awestruck_create_workspace_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.awestruck_workspaces (name, owner_id)
  values ('Awe-Struck', new.id)
  returning id into new_workspace_id;

  insert into public.awestruck_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.awestruck_workspace_data (workspace_id, payload, updated_by)
  values (new_workspace_id, '{}'::jsonb, new.id);

  return new;
end;
$$;
revoke all on function public.awestruck_create_workspace_for_new_user() from public, anon, authenticated;

create trigger awestruck_create_workspace_after_signup
after insert on auth.users
for each row execute function public.awestruck_create_workspace_for_new_user();
