-- Daily challenge puzzles (UTC date, shared band spins)
create table if not exists public.daily_puzzles (
  puzzle_date date primary key,
  seed bigint not null,
  band_keys text[] not null,
  created_at timestamptz not null default now()
);

-- Optional score log for daily leaderboard
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null,
  player_name text,
  grade text not null check (grade in ('S', 'A', 'B', 'C', 'D', 'F')),
  supergroup boolean not null default false,
  charts_score int not null default 0,
  tour_score int not null default 0,
  reviews_score int not null default 0,
  lineup jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_scores_puzzle_date_idx
  on public.game_scores (puzzle_date, grade);

alter table public.daily_puzzles enable row level security;
alter table public.game_scores enable row level security;

create policy "Anyone can read daily puzzles"
  on public.daily_puzzles for select
  using (true);

create policy "Anyone can read scores"
  on public.game_scores for select
  using (true);

create policy "Anyone can submit a score"
  on public.game_scores for insert
  with check (true);
