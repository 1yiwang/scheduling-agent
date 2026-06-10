-- Scheduling Agent · minimal persistence schema
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Design: one JSON blob per user (mirrors the app's snapshotDBs()).
-- Row-Level Security ensures each signed-in user only ever sees their own row,
-- which is why the public anon key is safe to ship in the frontend.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- A user can read/write only their own row (auth.uid() = the signed-in user id).
drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own" on public.app_state
  for select using (auth.uid() = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own" on public.app_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Phase C · learning tables.
-- app_state remains the compatibility snapshot. These tables make the learning
-- stream queryable for analytics, feedback loops and future ML.

create table if not exists public.pref_store (
  user_id       uuid references auth.users(id) on delete cascade,
  dimension     text not null,
  key           text not null,
  alpha         int not null default 1,
  beta          int not null default 1,
  confidence    real not null default 0.5,
  sample_count  int not null default 0,
  last_updated  timestamptz,
  primary key (user_id, dimension, key)
);

create table if not exists public.interaction_log (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ts            timestamptz not null default now(),
  action        text not null,
  context       jsonb,
  top3          jsonb,
  chosen_idx    int,
  candidate_id  text,
  kind          text,
  source        text,
  involves      text,
  features      jsonb,
  label         int
);
create index if not exists idx_interaction_log_user_ts on public.interaction_log(user_id, ts desc);

create table if not exists public.duration_observations (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              text,
  person            text,
  observed_minutes  int not null,
  ts                timestamptz not null default now()
);
create index if not exists idx_duration_observations_user_ts on public.duration_observations(user_id, ts desc);

alter table public.pref_store enable row level security;
alter table public.interaction_log enable row level security;
alter table public.duration_observations enable row level security;

drop policy if exists "pref_store_select_own" on public.pref_store;
create policy "pref_store_select_own" on public.pref_store
  for select using (auth.uid() = user_id);

drop policy if exists "pref_store_insert_own" on public.pref_store;
create policy "pref_store_insert_own" on public.pref_store
  for insert with check (auth.uid() = user_id);

drop policy if exists "pref_store_update_own" on public.pref_store;
create policy "pref_store_update_own" on public.pref_store
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interaction_log_select_own" on public.interaction_log;
create policy "interaction_log_select_own" on public.interaction_log
  for select using (auth.uid() = user_id);

drop policy if exists "interaction_log_insert_own" on public.interaction_log;
create policy "interaction_log_insert_own" on public.interaction_log
  for insert with check (auth.uid() = user_id);

drop policy if exists "duration_observations_select_own" on public.duration_observations;
create policy "duration_observations_select_own" on public.duration_observations
  for select using (auth.uid() = user_id);

drop policy if exists "duration_observations_insert_own" on public.duration_observations;
create policy "duration_observations_insert_own" on public.duration_observations
  for insert with check (auth.uid() = user_id);
