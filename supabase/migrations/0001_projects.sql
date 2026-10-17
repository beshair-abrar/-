-- Jadwa Tech — prepared schema for the Supabase phase. NOT applied yet: the app
-- currently uses LocalProjectStore. Mirrors lib/projects/types.ts and
-- JADWA360_BUILD_PLAN.md §6. Every row is owned by auth.uid() via RLS.

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  sector      text not null check (sector in ('industrial','commercial','services','agricultural','tourism','technology','health','education','real_estate','other')),
  description text not null default '' check (char_length(description) <= 2000),
  status      text not null default 'draft' check (status in ('draft','in_progress','completed')),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_user_updated_idx on public.projects (user_id, updated_at desc);

-- FeasibilityInput as saved (may be invalid while the study is in progress).
create table public.project_inputs (
  project_id   uuid primary key references public.projects(id) on delete cascade,
  payload      jsonb not null,
  input_issues jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Cached FeasibilityOutput. Must be rewritten or deleted in the same transaction
-- as any project_inputs write (CLAUDE.md §3). input_hash ties it to its input.
create table public.project_results (
  project_id  uuid primary key references public.projects(id) on delete cascade,
  payload     jsonb not null,
  input_hash  text not null,
  computed_at timestamptz not null default now()
);

alter table public.projects        enable row level security;
alter table public.project_inputs  enable row level security;
alter table public.project_results enable row level security;

create policy "own projects" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own inputs" on public.project_inputs
  for all using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own results" on public.project_results
  for all using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- Any input write drops the cached result unless the same transaction writes a new one afterwards.
create function public.invalidate_result() returns trigger language plpgsql security invoker as $$
begin
  delete from public.project_results where project_id = new.project_id;
  return new;
end $$;
create trigger project_inputs_invalidate before insert or update on public.project_inputs
  for each row execute function public.invalidate_result();
