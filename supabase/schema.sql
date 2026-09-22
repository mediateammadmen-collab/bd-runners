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
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

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
  insert into public.profiles (id, name, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'city', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- challenges (read-only catalogue)
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
  sort_order int not null default 0
);

alter table public.challenges enable row level security;
drop policy if exists "challenges are viewable by everyone" on public.challenges;
create policy "challenges are viewable by everyone" on public.challenges for select using (true);

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
-- completions — writable ONLY via log_run()
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

alter table public.completions enable row level security;
drop policy if exists "completions are viewable by everyone" on public.completions;
create policy "completions are viewable by everyone" on public.completions for select using (true);

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
-- rewards (read-only catalogue)
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

-- =========================================================================
-- redemptions — writable ONLY via redeem_reward(). Only visible to their owner.
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

-- =========================================================================
-- log_run() — the only way runs/completions/champions get written.
-- Runs as SECURITY DEFINER so it can bypass RLS for the insert, but it
-- always uses auth.uid() for the runner — a caller can never log a run for
-- someone else. Completion + "fastest finisher" bonus are awarded
-- atomically in the same transaction via unique-constraint ON CONFLICT,
-- which is race-safe under concurrent finishers without any app-level lock.
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
  v_runner uuid := auth.uid();
  v_run_id uuid;
  v_challenge public.challenges%rowtype;
  v_progress numeric;
  v_completion_id uuid;
  v_champion boolean := false;
  v_points int := 0;
  v_champ_runner uuid;
begin
  if v_runner is null then
    raise exception 'not authenticated';
  end if;
  if p_distance_km is null or p_distance_km <= 0 then
    raise exception 'distance must be greater than 0';
  end if;
  if p_date > current_date then
    raise exception 'date cannot be in the future';
  end if;

  insert into public.runs (runner_id, distance_km, date, source, challenge_id, note)
  values (v_runner, p_distance_km, p_date, p_source, p_challenge_id, nullif(p_note, ''))
  returning id into v_run_id;

  if p_challenge_id is null then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found then
    raise exception 'unknown challenge';
  end if;

  if v_challenge.metric = 'distance_km' then
    select coalesce(sum(distance_km), 0) into v_progress
      from public.runs where runner_id = v_runner and challenge_id = p_challenge_id;
  elsif v_challenge.metric = 'distinct_days' then
    select count(distinct date) into v_progress
      from public.runs where runner_id = v_runner and challenge_id = p_challenge_id;
  else
    select coalesce(max(distance_km), 0) into v_progress
      from public.runs where runner_id = v_runner and challenge_id = p_challenge_id;
  end if;

  if v_progress < v_challenge.goal then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  insert into public.completions (challenge_id, runner_id, points, champion)
  values (p_challenge_id, v_runner, v_challenge.points, false)
  on conflict (challenge_id, runner_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object('run_id', v_run_id, 'completed', false);
  end if;

  insert into public.champions (challenge_id, runner_id)
  values (p_challenge_id, v_runner)
  on conflict (challenge_id) do nothing
  returning runner_id into v_champ_runner;

  v_champion := (v_champ_runner = v_runner);
  v_points := v_challenge.points + (case when v_champion then v_challenge.bonus else 0 end);

  update public.completions set points = v_points, champion = v_champion
    where id = v_completion_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'completed', true,
    'champion', v_champion,
    'points', v_points,
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

  select coalesce(sum(points), 0) into v_earned from public.completions where runner_id = v_runner;
  select coalesce(sum(points_cost), 0) into v_spent from public.redemptions where runner_id = v_runner;
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
insert into public.challenges (id, title, emoji, metric, goal, description, window_label, points, bonus, sort_order) values
  ('hatirjheel-50', 'Hatirjheel 50', '🟢', 'distance_km', 50, 'Run 50 km anywhere in Bangladesh this month. Every kilometre counts.', 'This month', 250, 150, 1),
  ('dawn-streak-10', 'Dawn Streak', '🌅', 'distinct_days', 10, 'Get out for a run on 10 different days this month — consistency over speed.', 'This month', 150, 100, 2),
  ('road-to-dhaka25k', 'Road to Dhaka 25K', '🏅', 'distance_km', 100, 'Build toward Dhaka''s biggest road race — log 100 km of training.', 'Next 8 weeks', 500, 250, 3),
  ('first-5k', 'First 5K', '🎽', 'single_run_km', 5, 'New to running? Complete one 5 km run, at any pace, to earn your first badge.', 'Anytime', 50, 50, 4)
on conflict (id) do update set
  title = excluded.title, emoji = excluded.emoji, metric = excluded.metric, goal = excluded.goal,
  description = excluded.description, window_label = excluded.window_label,
  points = excluded.points, bonus = excluded.bonus, sort_order = excluded.sort_order;

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
