-- Add developer accounts to projects without deleting their Supabase account
-- when they are later removed from a project.
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique check (char_length(username) between 3 and 30),
    created_at timestamptz not null default now()
);

create table if not exists public.project_members (
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (project_id, user_id)
);
create index if not exists project_members_user_id_idx on public.project_members(user_id);

alter table public.tasks add column if not exists assignee_id uuid references public.profiles(id) on delete set null;
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;

create or replace function public.is_project_member(target_project uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.project_members m where m.project_id = target_project and m.user_id = target_user)
      or exists (select 1 from public.projects p where p.id = target_project and p.user_id = target_user);
$$;
revoke all on function public.is_project_member(uuid, uuid) from public;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;

-- Keep the project owner's existing workspace permissions.
drop policy if exists "Users manage own projects" on public.projects;
create policy "Users manage own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks" on public.tasks
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists "Project members view projects" on public.projects;
drop policy if exists "Owners manage projects and members view" on public.projects;
create policy "Project members view projects" on public.projects
  for select using (public.is_project_member(id));
drop policy if exists "Project members view tasks" on public.tasks;
create policy "Project members view tasks" on public.tasks
  for select using (public.is_project_member(project_id));
drop policy if exists "Project members update tasks" on public.tasks;
drop policy if exists "Project members view and update tasks" on public.tasks;
create policy "Project members update tasks" on public.tasks
  for update using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
drop policy if exists "Project members read roster" on public.project_members;
drop policy if exists "Members read project roster" on public.project_members;
create policy "Project members read roster" on public.project_members
  for select using (user_id = auth.uid() or public.is_project_member(project_id));
drop policy if exists "Project owners remove roster members" on public.project_members;
drop policy if exists "Owners manage project roster" on public.project_members;
create policy "Project owners remove roster members" on public.project_members
  for delete using (
    owner_id = auth.uid() and exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
    )
  );
drop policy if exists "Project members read profiles" on public.profiles;
create policy "Project members read profiles" on public.profiles
  for select using (
    id = auth.uid() or exists (
      select 1 from public.project_members m
      where m.user_id = profiles.id and public.is_project_member(m.project_id)
    )
  );
