# Supergroup

Build a dream band across five spins. Each round gives you a **Genre · Era** pool (e.g. *Metal · 90s*). Pick one real musician per round until **Vocals, Guitar, Bass, Drums**, and **Producer/Songwriter** are filled.

Inspired by the pick-and-build loop of [23-0](https://23-0.com) — same constraint puzzle, different domain.

## Perfect run

Hit all three at once to achieve **Supergroup**:

1. **#1 on the charts**
2. **Sell out every show for a year**
3. **3 five-star reviews** (Rolling Stone, Pitchfork, NME-style outlets)

## Quick rules

| Topic | Rule |
|-------|------|
| **Cast** | Real artists, any era/genre |
| **Spin** | Genre + Era each round → one pick from that pool |
| **Slots** | Vocals, Guitar, Bass, Drums + Flex (Producer/Songwriter) |
| **Eras** | 80s, 90s, 00s, 10s, 20s — each used **exactly once** |
| **Multi-role** | Musicians can qualify for multiple instrument slots (e.g. Dave Grohl: Drums / Guitar / Vocals) |
| **Rerolls** | 1 genre reroll + 1 era reroll per game |
| **Modes** | **Daily** — same 5 spins for everyone; **Practice** — random spins anytime |

## Play locally

```bash
cd app && npm install && npm run dev
```

Or from the repo root: `npm run dev` (after `cd app && npm install` once).

Open the URL Vite prints (usually http://localhost:5173). Choose **Daily** or **Practice**, spin through five Genre · Era rounds, pick musicians, submit, and see Charts / Tour / Reviews.

### Generated album (Gemini API)

After you submit a lineup, the results screen generates **AI band name, album title, and tracklist** (Gemini Flash), then **cover art** and a **30-second vocal preview** (Lyria + image) in parallel.

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` ([get a key](https://aistudio.google.com/apikey)).
2. Run the app **and** API server together:

```bash
npm run dev:full
```

Or in two terminals: `npm run dev:api` and `npm run dev`.

Without an API key, the game still works — the album card shows the local title/tracklist and a setup hint instead of generated media.

## Deploy (Vercel + Supabase)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New query**.
3. Paste and run [`supabase/migrations/20250615000000_initial.sql`](supabase/migrations/20250615000000_initial.sql).
4. In **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

Daily mode uses UTC so everyone gets the same five band spins. Scores can be posted to `/api/scores` once Supabase is wired up.

### 2. Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Other** (uses root `vercel.json`).
3. Add environment variables (Production + Preview):

| Variable | Value |
|----------|--------|
| `GEMINI_API_KEY` | Your Gemini key (album cover + audio) |
| `SUPABASE_URL` | From Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase API settings |

4. Deploy. The static game is served from `app/dist`; `/api/*` routes hit the serverless handler in `api/index.mjs`.

**Local admin tools** (media editor, roster editor, clipboard paste) are disabled on Vercel — they need the local filesystem. Run `npm run dev:full` for those.

**CLI deploy** (after `npm install` at repo root):

```bash
npx vercel
npx vercel --prod
```

Set the same env vars with `npx vercel env add`.

## Project status

**V1 target:** Playable game only — no research bots, Monte Carlo stack, or advisor CLI (that pattern lives in the separate 23Z project).

**Playable web app:** `app/` — Vite + vanilla JS game loop.

**Database:** **1000 individual musicians** in `data/raw/musicians.json` (no bands/groups). Every Genre · Era pool has **≥5** artists (avg ~23).

**Genres (locked):** **9** spins — see `docs/GENRES.md`.

**Musician stats (locked):** FAB FIVE — see `docs/STATS.md`.

Rebuild database: `npm run build-musicians` · Audit pools: `npm run audit-pools`

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md) — Full game design
- [`docs/GENRES.md`](docs/GENRES.md) — 9 genres, pools, multi-tag rules
- [`docs/STATS.md`](docs/STATS.md) — FAB FIVE stat system and slot rating formulas

## Folder layout (planned)

```
Supergroup/
  docs/           Design notes
  data/
    raw/          Musician source data (1000 artists)
    schemas/      JSON Schema for types
  scripts/
    data/starter.js       Hand-curated 140
    data/corpus/          Generated era batches (860)
    build-musicians.js    Merge + enrich → musicians.json
  app/            Web game
  server/         Gemini API (album cover + Lyria preview)
```
