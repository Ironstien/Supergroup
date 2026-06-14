# Supergroup — Game Design

Working title. Perfect outcome name: **Supergroup** (triple crown).

## Concept

You fill five slots in a "dream" band:

| Slot | Role |
|------|------|
| Vocals | Lead vocalist |
| Guitar | Guitar |
| Bass | Bass |
| Drums | Drums |
| Flex | Producer / Songwriter (non-performer) |

Each round, the game spins **Genre · Era** (the 23-0 equivalent of **Club · Decade**). You pick one musician from that pool and assign them to an open slot they are eligible for.

Five rounds. Five picks. Five slots filled.

## Mapping from 23-0

| 23-0 | Supergroup |
|------|------------|
| Club | Genre (**16 locked** — see `docs/GENRES.md`) |
| Decade | Era (80s, 90s, 00s, 10s, 20s) |
| DEF / MID / RUC / FWD / UTL | Vocals / Guitar / Bass / Drums / Producer |
| UTL = best remaining | Flex = Producer/Songwriter (different scoring lane) |
| Era rule: 4 decades + 1 repeat | Era rule: 5 decades, each used exactly once |
| Perfect = 23-0 season | Perfect = Supergroup (triple crown) |
| `/api/finalise` sim | Submit → Charts + Tour + Reviews |
| Position rating | Hidden slot rating (derived from FAB FIVE) |
| Fantasy avg in UI | FAB FIVE: VOX, PLAY, GROOVE, STAR, DESK |
| Reroll advisor | 1 genre + 1 era reroll per game |

## Eras

Five eras, aligned with five slots:

- **80s**
- **90s**
- **00s**
- **10s**
- **20s**

**Rule:** Each decade is used **exactly once** across the band. The era comes from the spin (Genre · Era), so each pick automatically represents that decade.

This is stricter than 23-0's "four decades + one wildcard repeat" but fits cleanly: five slots, five decades, no ambiguity.

*May be tuned in playtesting if pools are too thin per Genre · Era.*

## Genres

**Locked: 4 genres**, 20 pools (4 × 5 eras). Full spec: [`docs/GENRES.md`](GENRES.md).

Spin display: **GENRE · ERA** (e.g. `METAL · 90s`). Pool key: `metal|90s`.

| Spin | Key |
|------|-----|
| ROCK, POP, HIP-HOP, R&B | `rock`, `pop`, `hip-hop`, `r&b` |
| COUNTRY, METAL, ELECTRONIC, JAZZ | `country`, `metal`, `electronic`, `jazz` |
| FOLK, PUNK, INDIE, ALT | `folk`, `punk`, `indie`, `alternative` |
| FUNK, BLUES, REGGAE, LATIN | `funk`, `blues`, `reggae`, `latin` |

**Merged for v1:** Gospel → R&B; Afrobeat → Reggae/Latin.

**Multi-tag:** Each musician has 1 peak era and 1–3 genre tags; appears in every matching Genre · Era pool.

## Spins and rounds

1. Five rounds total.
2. Each round: spin **Genre · Era**.
3. Player sees a pool of musicians valid for that genre and era.
4. Pool order is **random** (discovery over sorted optimization).
5. Player picks one musician and assigns to an **open eligible slot**.

### Rerolls

Per game:

- **1 genre reroll** (re-spin genre, keep era or re-spin both — tune in implementation)
- **1 era reroll**

No reroll advisor or policy learning in v1.

## Musician eligibility

- **Real artists only** — any era, any genre in the database.
- Slots are **role-based**, not strict single-role:
  - A musician can be eligible for multiple instrument slots.
  - Example: Dave Grohl → Drums, Guitar, or Vocals.
- **Flex (Producer/Songwriter):** separate eligibility track; non-performer role.

## Musician card UI

Each card in the pool shows:

1. **Image** of the musician
2. **Name**
3. **Valid instruments** (and Producer/Songwriter if applicable)
4. **Stats** — **FAB FIVE** (locked): **VOX, PLAY, GROOVE, STAR, DESK** (0–99 each)

Full spec: [`docs/STATS.md`](STATS.md)

Players do **not** see hidden slot ratings in the pool unless we choose to reveal on pick or on final breakdown (23-0 shows fantasy in pool; true position rating on finalise).

## Flex slot — Producer / Songwriter

- **Non-performer** — does not drive live show energy the same way instruments do.
- Primarily boosts **Charts** and **Reviews** (album/critical side).
- Weaker direct contribution to **sold-out tour** unless tuned in playtesting.
- Equal structural weight as fifth slot, but different scoring lane.

## Scoring and perfect run

On submit, the game evaluates three goals:

| Goal | Fantasy |
|------|---------|
| **Charts** | Debut (or supergroup album) hits **#1** |
| **Tour** | **Sell out every show for a year** |
| **Reviews** | **3 five-star reviews** from major outlets |

**Supergroup** = all three achieved in the same simulated outcome.

### Scoring model (draft)

**Deterministic layer:**

- Each filled slot gets a **slot rating** derived from FAB FIVE weights (see `docs/STATS.md`).
- Producer/Songwriter contributes to Charts + Reviews more than Tour.
- Band-level sub-scores: Chart power, Live draw, Critical acclaim (names TBD).

**Variance layer:**

- Outcomes are **mostly fixed** from ratings (unlike 23-0's heavy sim variance on every submit).
- **Beef** between band members adds variance — same lineup can flop or become legendary.

### Beef / chemistry

- Each artist has a short list of other artists they have **"beef"** with.
- **Visible chemistry warnings** before submit (e.g. "⚠ A ↔ B — tour variance increased").
- When beef pairs are in the band: **increases outcome variance** — could miss Supergroup on a meltdown run or nail it on a chaos-legend run.
- Thematic replacement for 23-0's random season simulation.

## Game modes

| Mode | Behavior |
|------|----------|
| **Daily** | Everyone gets the **same 5 Genre · Era spins** |
| **Practice** | **Unlimited** random spins anytime |

Daily enables shared challenge and comparison; Practice is for learning pools and testing lineups.

## Share / results screen

After submit, players can share:

1. **Band card** — names, genres, eras, triple scores (Charts / Tour / Reviews)
2. **Generated album** — fake cover art + tracklist themed to the band

Optional later: emoji grid (Wordle-style) for each of the three goals.

## V1 scope

**Ship first:**

- Playable web game loop (spin → pick × 5 → submit → results → share)
- Curated musician database (size TBD)
- Daily + Practice modes
- Rerolls, beef warnings, triple-crown scoring

**Explicitly out of v1:**

- 23Z-style research stack (fetch scripts, Monte Carlo CLI, auto-play bots, rating matrix builder, session learnings aggregator)
- Pick advisor / recommend CLI
- Leaderboard (can add soon after daily mode)

## Data pipeline (deferred)

How to build the musician database — **decide later**:

- Hand-curated JSON (~500–1000 artists)
- MusicBrainz / Discogs API + manual role/era tags
- Spotify API for popularity + manual tags
- Wikipedia-style lists → spreadsheet cleanup
- Tiny seed (~100) + community growth

## Design risks (playtest early)

1. **Five forced decades** — need large enough pools per Genre · Era.
2. **Producer on Flex** — players may undervalue tour; consider small tour synergy from elite producers.
3. **Real artists** — image licensing (press photos vs silhouettes vs generated art).
4. **Daily same spins** — genre variety so daily pools don't feel identical.

## Player loop (v1)

```
Landing → Daily or Practice
  → Round 1–5: Genre · Era spin → browse random musician cards → pick → assign slot
  → Optional: use genre or era reroll (once each)
  → Review beef warnings
  → Submit
  → Charts / Tour / Reviews breakdown + weak link + grade
  → Share band card + generated album
```

## Open decisions

- [ ] Musician data source and curation workflow
- [ ] Numeric thresholds for #1 / sold-out year / 5★×3
- [ ] Beef graph density (2–3 rivals per icon vs sparse)
- [ ] Album generator: silly random titles vs genre/era templates
- [ ] Slot rating eligibility threshold (default 75) and whether ego stays hidden
