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

-- Phase C target schema (draft only; do NOT run yet).
-- The app currently uses app_state as a Phase 1 compatibility blob. Once the
-- learning paths are clean, migrate learning data into these append/aggregate
-- tables so analytics, feedback loops and future ML are queryable.
--
-- create table public.pref_store (
--   user_id uuid references auth.users(id) on delete cascade,
--   dimension text not null,
--   key text not null,
--   alpha int default 1,
--   beta int default 1,
--   confidence real default 0.5,
--   sample_count int default 0,
--   last_updated timestamptz,
--   primary key (user_id, dimension, key)
-- );
--
-- create table public.interaction_log (
--   id bigint generated always as identity primary key,
--   user_id uuid references auth.users(id) on delete cascade,
--   ts timestamptz not null default now(),
--   action text not null,
--   context jsonb,
--   top3 jsonb,
--   chosen_idx int,
--   candidate_id text,
--   kind text,
--   source text,
--   involves text,
--   features jsonb,
--   label int
-- );
-- create index idx_interaction_log_user_ts on public.interaction_log(user_id, ts desc);
--
-- create table public.duration_observations (
--   id bigint generated always as identity primary key,
--   user_id uuid references auth.users(id) on delete cascade,
--   kind text,
--   person text,
--   observed_minutes int not null,
--   ts timestamptz not null default now()
-- );
