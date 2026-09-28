-- Bd Runner — database schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses "if not exists" / "on conflict" guards throughout.

create extension if not exists "pgcrypto";

-- =========================================================================
-- profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  city text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- safety net if profiles already existed from an earlier partial run
alter table public.profiles add column if not exists is_admin boolean not null default false;

alter table public.profiles enable row level security;

-- =========================================================================
-- admin allowlist — the single source of truth for who is an admin.
-- To add another admin, add their email here and re-run this file.
-- =========================================================================
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_email, '')) = any (array['mediateammadmen@gmail.com']);
$$;

-- checks the CURRENT authenticated request's email — use this in RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.is_admin_email(auth.jwt() ->> 'email');
$$;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- auto-create a profile row whenever someone signs up (email/password or Google)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, city, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'city', ''),
    public.is_admin_email(new.email)
  )
  on conflict (id) do update set is_admin = excluded.is_admin;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- backfill: this trigger only fires on NEW signups, so anyone who signed up
-- before this script ran (or before an email was added to the admin
-- allowlist) needs their profiles row created/updated here too.
insert into public.profiles (id, name, city, is_admin)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  nullif(u.raw_user_meta_data->>'city', ''),
  public.is_admin_email(u.email)
from auth.users u
on conflict (id) do update set is_admin = excluded.is_admin;

-- =========================================================================
-- challenges (admins can create/edit; everyone can read)
-- =========================================================================
create table if not exists public.challenges (
  id text primary key,
  title text not null,
  emoji text not null,
  metric text not null check (metric in ('distance_km', 'distinct_days', 'single_run_km')),
  goal numeric not null,
  description text not null,
  window_label text not null,
  points int not null,
  bonus int not null,
  sort_order int not null default 0,
  starts_at date,
  ends_at date,
  archived boolean not null default false
);

-- safety net for databases created before these columns existed.
-- starts_at / ends_at are inclusive Asia/Dhaka dates; null means open-ended.
-- archived hides a challenge without deleting it, so runners keep their
-- history and points (runs/completions reference it, so a hard delete fails).
alter table public.challenges add column if not exists starts_at date;
alter table public.challenges add column if not exists ends_at date;
alter table public.challenges add column if not exists archived boolean not null default false;

alter table public.challenges enable row level security;
drop policy if exists "challenges are viewable by everyone" on public.challenges;
create policy "challenges are viewable by everyone" on public.challenges for select using (true);

drop policy if exists "admins can insert challenges" on public.challenges;
create policy "admins can insert challenges" on public.challenges for insert with check (public.is_admin());
drop policy if exists "admins can update challenges" on public.challenges;
create policy "admins can update challenges" on public.challenges for update using (public.is_admin());
drop policy if exists "admins can delete challenges" on public.challenges;
create policy "admins can delete challenges" on public.challenges for delete using (public.is_admin());

-- =========================================================================
-- runs — writable ONLY via the log_run() function below, never directly.
-- =========================================================================
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles(id) on delete cascade,
  distance_km numeric not null check (distance_km > 0),
  date date not null,
  source text not null,
  challenge_id text references public.challenges(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists runs_challenge_idx on public.runs(challenge_id);
create index if not exists runs_runner_idx on public.runs(runner_id);
create index if not exists runs_created_idx on public.runs(created_at desc);

alter table public.runs enable row level security;
drop policy if exists "runs are viewable by everyone" on public.runs;
create policy "runs are viewable by everyone" on public.runs for select using (true);

-- =========================================================================
-- completions — one row per runner per challenge, created by log_run() when
-- the goal is reached. It then moves through a review lifecycle:
--
--   awaiting_proof → (runner uploads photos) → pending → (admin) → approved
--                                                          ↘ rejected → (resubmit) → pending
--
-- Points and the champion bonus only count once a completion is approved.
-- Writable only through log_run(), submit_completion_proof() and
-- review_completion(). Visible to its owner and admins only, because it
-- holds photo paths and review notes.
-- =========================================================================
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.challenges(id),
  runner_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  champion boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (challenge_id, runner_id)
);

-- Completions that existed before reviews were introduced were already
-- awarded, so the column's backfill default is 'approved'; new rows then
-- default to 'awaiting_proof'.
alter table public.completions add column if not exists status text not null default 'approved';
alter table public.completions alter column status set default 'awaiting_proof';
alter table public.completions drop constraint if exists completions_status_check;
alter table public.completions add constraint completions_status_check
  check (status in ('awaiting_proof', 'pending', 'approved', 'rejected'));
alter table public.completions add column if not exists photo_path text;
alter table public.completions add column if not exists proof_path text;
alter table public.completions add column if not exists submitted_at timestamptz;
alter table public.completions add column if not exists reviewed_at timestamptz;
alter table public.completions add column if not exists review_note text;

create index if not exists completions_status_idx on public.completions(status, submitted_at);

alter table public.completions enable row level security;
drop policy if exists "completions are viewable by everyone" on public.completions;
drop policy if exists "runners view own completions" on public.completions;
create policy "runners view own completions" on public.completions for select using (auth.uid() = runner_id);
drop policy if exists "admins view all completions" on public.completions;
create policy "admins view all completions" on public.completions for select using (public.is_admin());

-- =========================================================================
-- champions — one row per challenge, first finisher wins. Writable ONLY via log_run()
-- =========================================================================
create table if not exists public.champions (
  challenge_id text primary key references public.challenges(id),
  runner_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.champions enable row level security;
drop policy if exists "champions are viewable by everyone" on public.champions;
create policy "champions are viewable by everyone" on public.champions for select using (true);

-- =========================================================================
-- rewards (admins can create/edit; everyone can read)
-- =========================================================================
create table if not exists public.rewards (
  id text primary key,
  name text not null,
  emoji text not null,
  cost int not null,
  description text not null,
  sort_order int not null default 0
);

alter table public.rewards enable row level security;
drop policy if exists "rewards are viewable by everyone" on public.rewards;
create policy "rewards are viewable by everyone" on public.rewards for select using (true);

drop policy if exists "admins can insert rewards" on public.rewards;
create policy "admins can insert rewards" on public.rewards for insert with check (public.is_admin());
drop policy if exists "admins can update rewards" on public.rewards;
create policy "admins can update rewards" on public.rewards for update using (public.is_admin());
drop policy if exists "admins can delete rewards" on public.rewards;
create policy "admins can delete rewards" on public.rewards for delete using (public.is_admin());

-- =========================================================================
-- redemptions — writable ONLY via redeem_reward(), except status updates
-- (e.g. marking a reward as fulfilled), which only admins may do.
-- Runners see only their own; admins see everyone's.
-- =========================================================================
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null references public.rewards(id),
  points_cost int not null,
  status text not null default 'Requested',
  redeemed_at timestamptz not null default now()
);

alter table public.redemptions enable row level security;
drop policy if exists "users view own redemptions" on public.redemptions;
create policy "users view own redemptions" on public.redemptions for select using (auth.uid() = runner_id);
drop policy if exists "admins view all redemptions" on public.redemptions;
create policy "admins view all redemptions" on public.redemptions for select using (public.is_admin());
drop policy if exists "admins update redemptions" on public.redemptions;
create policy "admins update redemptions" on public.redemptions for update using (public.is_admin());

-- =========================================================================
-- challenge_progress — each runner's progress on each challenge, computed
-- in the database (only counting runs inside the challenge's date window).
-- The app reads this instead of pulling raw runs and summing them in the
-- browser, which silently undercounted once there were more rows than one
-- request returns. log_run() uses the same view, so both always agree.
-- =========================================================================
drop view if exists public.challenge_stats;
drop view if exists public.challenge_progress;

create view public.challenge_progress
with (security_invoker = on) as
select
  r.challenge_id,
  r.runner_id,
  p.name as runner_name,
  case c.metric
    when 'distance_km' then coalesce(sum(r.distance_km), 0)
    when 'distinct_days' then count(distinct r.date)::numeric
    else coalesce(max(r.distance_km), 0)
  end as progress
from public.runs r
join public.challenges c on c.id = r.challenge_id
join public.profiles p on p.id = r.runner_id
where (c.starts_at is null or r.date >= c.starts_at)
  and (c.ends_at is null or r.date <= c.ends_at)
group by r.challenge_id, r.runner_id, p.name, c.metric;

-- Deliberately NOT security_invoker: completions are private per runner, but
-- everyone should see accurate totals. This view exposes only counts.
create view public.challenge_stats as
select
  c.id as challenge_id,
  (select count(*) from public.challenge_progress cp where cp.challenge_id = c.id) as participants,
  (select count(*) from public.completions co where co.challenge_id = c.id and co.status = 'approved') as completions,
  (select count(*) from public.completions co where co.challenge_id = c.id and co.status = 'pending') as pending_reviews
from public.challenges c;

grant select on public.challenge_progress to anon, authenticated;
grant select on public.challenge_stats to anon, authenticated;

-- Headline numbers for the public landing page.
create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'runners', (select count(*) from public.profiles),
    'km', (select coalesce(round(sum(distance_km)), 0) from public.runs),
    'runs_this_week', (select count(*) from public.runs where created_at >= now() - interval '7 days'),
    'challenges', (
      select count(*) from public.challenges
      where not archived
        and (ends_at is null or ends_at >= (now() at time zone 'Asia/Dhaka')::date)
    )
  );
$$;

grant execute on function public.public_stats() to anon, authenticated;

-- Admin dashboard numbers, including redemption figures regular users can't see.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return public.public_stats() || jsonb_build_object(
    'points_issued', (select coalesce(sum(points), 0) from public.completions where status = 'approved'),
    'points_redeemed', (select coalesce(sum(points_cost), 0) from public.redemptions where status <> 'Rejected'),
    'pending', (select count(*) from public.redemptions where status = 'Requested'),
    'pending_reviews', (select count(*) from public.completions where status = 'pending')
  );
end;
$$;

grant execute on function public.admin_stats() to authenticated;

-- =========================================================================
-- log_run() — the only way runs get written. Runs as SECURITY DEFINER so it
-- can bypass RLS for the insert, but it always uses auth.uid() for the
-- runner — a caller can never log a run for someone else. When a run
-- pushes the runner past the goal it opens an 'awaiting_proof' completion;
-- points and the champion bonus are only granted by review_completion().
-- =========================================================================
create or replace function public.log_run(
  p_distance_km numeric,
  p_date date,
  p_source text,
  p_challenge_id text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Anti-abuse limits: points convert to real cashback, so cap what a
  -- self-reported run can be worth.
  c_max_run_km constant numeric := 100;
  c_max_day_km constant numeric := 150;

  v_runner uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_day_total numeric;
  v_run_id uuid;
  v_challenge public.challenges%rowtype;
  v_progress numeric;
  v_completion_id uuid;
begin
  if v_runner is null then
    raise exception 'not authenticated';
  end if;
  if p_distance_km is null or p_distance_km <= 0 then
    raise exception 'Distance must be greater than 0 km.';
  end if;
  if p_distance_km > c_max_run_km then
    raise exception 'A single run can''t be more than % km.', c_max_run_km;
  end if;
  if p_date is null or p_date > v_today then
    raise exception 'Date can''t be in the future.';
  end if;

  -- Serialise this runner's writes so two concurrent requests can't both
  -- slip under the daily cap.
  perform 1 from public.profiles where id = v_runner for update;

  select coalesce(sum(distance_km), 0) into v_day_total
    from public.runs where runner_id = v_runner and date = p_date;
  if v_day_total + p_distance_km > c_max_day_km then
    raise exception 'That would put you over % km logged for %. Double-check the distance.', c_max_day_km, p_date;
  end if;

  if p_challenge_id is not null then
    select * into v_challenge from public.challenges where id = p_challenge_id;
    if not found or v_challenge.archived then
      raise exception 'That challenge isn''t available.';
    end if;
    if v_challenge.starts_at is not null and p_date < v_challenge.starts_at then
      raise exception '% starts on %. Runs before then don''t count.', v_challenge.title, v_challenge.starts_at;
    end if;
    if v_challenge.ends_at is not null and p_date > v_challenge.ends_at then
      raise exception '% ended on %.', v_challenge.title, v_challenge.ends_at;
    end if;
  end if;

  insert into public.runs (runner_id, distance_km, date, source, challenge_id, note)
  values (v_runner, p_distance_km, p_date, p_source, p_challenge_id, nullif(p_note, ''))
  returning id into v_run_id;

  if p_challenge_id is null then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  select progress into v_progress
    from public.challenge_progress
    where challenge_id = p_challenge_id and runner_id = v_runner;
  v_progress := coalesce(v_progress, 0);

  if v_progress < v_challenge.goal then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  -- Goal reached: open a completion awaiting proof. Nothing is awarded yet —
  -- points and the champion bonus are granted in review_completion().
  insert into public.completions (challenge_id, runner_id, points, champion, status)
  values (p_challenge_id, v_runner, v_challenge.points, false, 'awaiting_proof')
  on conflict (challenge_id, runner_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  return jsonb_build_object(
    'run_id', v_run_id,
    'completed', true,
    'needs_proof', true,
    'points', v_challenge.points,
    'challenge_id', p_challenge_id
  );
end;
$$;

grant execute on function public.log_run(numeric, date, text, text, text) to authenticated;

-- =========================================================================
-- redeem_reward() — the only way redemptions get written. Re-checks the
-- balance server-side so a client can never redeem more than it has earned.
-- =========================================================================
create or replace function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runner uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_earned int;
  v_spent int;
  v_balance int;
begin
  if v_runner is null then
    raise exception 'not authenticated';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id;
  if not found then
    raise exception 'unknown reward';
  end if;

  -- Lock this runner's profile row for the rest of the transaction. A second
  -- concurrent redemption waits here until the first commits, then sees its
  -- deduction — so a double-click can't spend the same points twice.
  perform 1 from public.profiles where id = v_runner for update;

  -- Only approved completions count; unreviewed claims can't be spent.
  select coalesce(sum(points), 0) into v_earned
    from public.completions where runner_id = v_runner and status = 'approved';
  -- Rejected redemptions give their points back.
  select coalesce(sum(points_cost), 0) into v_spent
    from public.redemptions where runner_id = v_runner and status <> 'Rejected';
  v_balance := v_earned - v_spent;

  if v_balance < v_reward.cost then
    raise exception 'not enough points';
  end if;

  insert into public.redemptions (runner_id, reward_id, points_cost, status)
  values (v_runner, p_reward_id, v_reward.cost, 'Requested');

  return jsonb_build_object('ok', true, 'balance', v_balance - v_reward.cost);
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;

-- =========================================================================
-- completion-proofs storage — PRIVATE. Photos live at
-- <runner_id>/<challenge_id>/<file>. A runner can upload into and read only
-- their own folder; admins can read everything (to review).
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('completion-proofs', 'completion-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "runners upload own proofs" on storage.objects;
create policy "runners upload own proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'completion-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "runners and admins read proofs" on storage.objects;
create policy "runners and admins read proofs" on storage.objects for select to authenticated
  using (
    bucket_id = 'completion-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- =========================================================================
-- submit_completion_proof() — runner attaches their photos to a completion
-- that is awaiting proof (or was rejected), moving it to 'pending'.
-- Distance challenges also require a tracker screenshot.
-- =========================================================================
create or replace function public.submit_completion_proof(
  p_challenge_id text,
  p_photo_path text,
  p_proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runner uuid := auth.uid();
  v_prefix text;
  v_completion public.completions%rowtype;
  v_metric text;
begin
  if v_runner is null then
    raise exception 'not authenticated';
  end if;
  -- Files must come from the runner's own storage folder, so nobody can
  -- submit someone else's photo by guessing its path.
  v_prefix := v_runner::text || '/';

  select * into v_completion from public.completions
    where challenge_id = p_challenge_id and runner_id = v_runner
    for update;
  if not found then
    raise exception 'You haven''t reached this challenge''s goal yet.';
  end if;
  if v_completion.status = 'pending' then
    raise exception 'Your proof is already under review.';
  end if;
  if v_completion.status = 'approved' then
    raise exception 'This challenge is already approved.';
  end if;

  if p_photo_path is null or left(p_photo_path, length(v_prefix)) <> v_prefix then
    raise exception 'Please upload your finish-line photo.';
  end if;
  if p_proof_path is not null and left(p_proof_path, length(v_prefix)) <> v_prefix then
    raise exception 'That tracker screenshot upload isn''t valid — please try again.';
  end if;

  select metric into v_metric from public.challenges where id = p_challenge_id;
  if v_metric in ('distance_km', 'single_run_km') and p_proof_path is null then
    raise exception 'Please also upload a screenshot from your tracker showing the distance.';
  end if;

  update public.completions
    set status = 'pending',
        photo_path = p_photo_path,
        proof_path = p_proof_path,
        submitted_at = now(),
        reviewed_at = null,
        review_note = null
    where id = v_completion.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_completion_proof(text, text, text) to authenticated;

-- =========================================================================
-- review_completion() — admin approves or rejects a pending submission.
-- Approval grants the points, and the champion bonus if nobody holds the
-- title yet. Each challenge's queue must be approved oldest-first, so the
-- bonus always goes to the earliest submission that passes review — no
-- matter what order the admin happens to click in.
-- =========================================================================
create or replace function public.review_completion(
  p_completion_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completion public.completions%rowtype;
  v_challenge public.challenges%rowtype;
  v_champ_runner uuid;
  v_champion boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_completion from public.completions where id = p_completion_id for update;
  if not found then
    raise exception 'Submission not found.';
  end if;
  if v_completion.status <> 'pending' then
    raise exception 'This submission has already been reviewed.';
  end if;

  if not p_approve then
    update public.completions
      set status = 'rejected', reviewed_at = now(), review_note = nullif(trim(p_note), '')
      where id = p_completion_id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if exists (
    select 1 from public.completions
    where challenge_id = v_completion.challenge_id
      and status = 'pending'
      and submitted_at < v_completion.submitted_at
  ) then
    raise exception 'Review the older submissions for this challenge first — the champion bonus goes to the earliest approved submission.';
  end if;

  select * into v_challenge from public.challenges where id = v_completion.challenge_id;

  insert into public.champions (challenge_id, runner_id)
  values (v_completion.challenge_id, v_completion.runner_id)
  on conflict (challenge_id) do nothing
  returning runner_id into v_champ_runner;
  -- null when someone already holds the title → not champion
  v_champion := coalesce(v_champ_runner = v_completion.runner_id, false);

  update public.completions
    set status = 'approved',
        reviewed_at = now(),
        review_note = nullif(trim(p_note), ''),
        champion = v_champion,
        points = v_challenge.points + (case when v_champion then v_challenge.bonus else 0 end)
    where id = p_completion_id;

  return jsonb_build_object('ok', true, 'status', 'approved', 'champion', v_champion);
end;
$$;

grant execute on function public.review_completion(uuid, boolean, text) to authenticated;

-- =========================================================================
-- running_zones — a crowd-sourced directory of good running spots per
-- district. Anyone can browse; only signed-in users can add a spot, and
-- only under their own name (self-reported, same trust model as runs).
-- =========================================================================
create table if not exists public.running_zones (
  id uuid primary key default gen_random_uuid(),
  district text not null,
  name text not null,
  description text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (district, name)
);

create index if not exists running_zones_district_idx on public.running_zones(district);

alter table public.running_zones enable row level security;
drop policy if exists "running zones are viewable by everyone" on public.running_zones;
create policy "running zones are viewable by everyone" on public.running_zones for select using (true);

drop policy if exists "users can add running zones" on public.running_zones;
create policy "users can add running zones" on public.running_zones for insert with check (auth.uid() = submitted_by);

-- =========================================================================
-- seed data — same 4 challenges / 4 rewards as the original prototype
-- =========================================================================
-- "do nothing" on conflict: once a challenge exists, the Admin page owns it,
-- and re-running this file must not undo an admin's edits.
insert into public.challenges (id, title, emoji, metric, goal, description, window_label, points, bonus, sort_order, starts_at, ends_at) values
  ('hatirjheel-50', 'Hatirjheel 50', '🟢', 'distance_km', 50, 'Run 50 km anywhere in Bangladesh this month. Every kilometre counts.', 'This month', 250, 150, 1, '2026-09-01', '2026-09-30'),
  ('dawn-streak-10', 'Dawn Streak', '🌅', 'distinct_days', 10, 'Get out for a run on 10 different days this month — consistency over speed.', 'This month', 150, 100, 2, '2026-09-01', '2026-09-30'),
  ('road-to-dhaka25k', 'Road to Dhaka 25K', '🏅', 'distance_km', 100, 'Build toward Dhaka''s biggest road race — log 100 km of training.', 'Next 8 weeks', 500, 250, 3, '2026-09-01', '2026-10-26'),
  ('first-5k', 'First 5K', '🎽', 'single_run_km', 5, 'New to running? Complete one 5 km run, at any pace, to earn your first badge.', 'Anytime', 50, 50, 4, null, null)
on conflict (id) do nothing;

-- One-time backfill for databases seeded before date windows existed: give
-- the seeded challenges windows that match their labels. Only touches rows
-- that still have no dates, so it never overrides an admin's choice.
update public.challenges set starts_at = '2026-09-01', ends_at = '2026-09-30'
  where id in ('hatirjheel-50', 'dawn-streak-10') and starts_at is null and ends_at is null;
update public.challenges set starts_at = '2026-09-01', ends_at = '2026-10-26'
  where id = 'road-to-dhaka25k' and starts_at is null and ends_at is null;

insert into public.rewards (id, name, emoji, cost, description, sort_order) values
  ('icecream', 'Ice Cream Treat', '🍦', 150, 'A voucher for a scoop or two at a partner ice-cream shop.', 1),
  ('cashback200', 'Cashback ৳200', '💵', 400, 'Sent to your bKash or Nagad wallet.', 2),
  ('cashback500', 'Cashback ৳500', '💵', 900, 'Sent to your bKash or Nagad wallet.', 3),
  ('flight', 'Domestic Flight Ticket', '✈️', 5000, 'A one-way domestic ticket with a partner airline — the big stretch reward.', 4)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, cost = excluded.cost,
  description = excluded.description, sort_order = excluded.sort_order;

-- A handful of well-known running spots to seed the directory. Most of
-- Bangladesh's 64 districts are intentionally left for the community to
-- fill in via the Maps page rather than guessing at unfamiliar local spots.
insert into public.running_zones (district, name, description) values
  ('Dhaka', 'Hatirjheel Lake Loop', 'A popular paved loop around the lake in central Dhaka — well-lit, flat, and busy with runners and walkers most mornings and evenings.'),
  ('Dhaka', 'Ramna Park', 'A large shaded park near Shahbagh with looping paths — a longtime favorite for early-morning runners in the city.'),
  ('Chattogram', 'CRB (Circuit House) Hillside', 'Hilly, green, tree-lined roads around the old Chittagong Railway Building — a well-known spot for morning walks and runs.'),
  ('Chattogram', 'Patenga Beach Promenade', 'The beachfront promenade at Patenga — flat, open, and popular for sunrise and sunset runs.'),
  ('Cumilla', 'Dharmasagar Dighi', 'A large historic pond in the middle of Cumilla city with a walking path looping the water — a well-known local landmark.'),
  ('Cox''s Bazar', 'Cox''s Bazar Beach', 'The world''s longest natural sea beach — an obvious, unmistakable running route along the sand for miles.'),
  ('Sylhet', 'Osmani Udyan', 'A central park in Sylhet city, named after M. A. G. Osmani — shaded paths popular with local walkers and runners.'),
  ('Rajshahi', 'Padma Riverside (T-Bandh)', 'The T-shaped embankment along the Padma River — a well-known Rajshahi gathering spot with a long riverside walking stretch.'),
  ('Mymensingh', 'Bipin Park (Brahmaputra Riverside)', 'A riverside park along the Brahmaputra in Mymensingh town, popular for evening walks and runs.')
on conflict (district, name) do nothing;

-- =========================================================================
-- realtime — let the leaderboard / feed subscribe to live changes
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'runs'
  ) then
    alter publication supabase_realtime add table public.runs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'completions'
  ) then
    alter publication supabase_realtime add table public.completions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'champions'
  ) then
    alter publication supabase_realtime add table public.champions;
  end if;
end $$;
