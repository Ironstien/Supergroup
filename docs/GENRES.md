# Genres — Spin Pools

**Locked: 4 genres.** Each spin is **Genre · Era** (e.g. `METAL · 90s`).

**Pool count:** 4 genres × 5 eras = **20 pools**.

Pool key format: `{genreKey}|{era}` → e.g. `metal|90s`.

## The 4

| # | Spin label | Key | Covers |
|---|------------|-----|--------|
| 1 | **ROCK** | `rock` | Classic & hard rock, country, blues, roots guitar |
| 2 | **METAL** | `metal` | Heavy, thrash, nu-metal, etc. |
| 3 | **PUNK** | `punk` | Punk & hardcore |
| 4 | **ALT** | `alternative` | Alternative rock radio, grunge-adjacent, post-punk |

## Removed spins (v2.0)

Pop, hip-hop, electronic, indie, and funk were dropped as separate spins. Artists from those worlds are tagged into the four buckets above when curated (e.g. Arctic Monkeys → `rock` + `alternative`).

## Overlap: ROCK vs ALT vs PUNK vs METAL

| Genre | Use when |
|-------|----------|
| **ROCK** | Classic/hard/general rock — not mainly punk, metal, or alt-radio |
| **METAL** | Heavy, thrash, nu-metal, metalcore |
| **PUNK** | Punk & hardcore |
| **ALT** | Alternative radio (Pearl Jam, Radiohead, Foo Fighters) |

## Multi-tag rules

Each musician has:

- **1 peak era** — `80s`, `90s`, `00s`, `10s`, or `20s`
- **1–3 genre tags** from the 4 keys above
- **Role-locked slots** — instrument eligibility from band lineup in `scripts/data/bands.js`
- **Producer** — spare slot in-game; any musician can fill it

An artist appears in every pool matching **any** of their tags × their era.

Examples:

| Artist | Era | Genres | Pools |
|--------|-----|--------|-------|
| Pantera | 90s | `metal` | `metal\|90s` |
| Nirvana | 90s | `alternative` | `alternative\|90s` |
| The Clash | 80s | `punk` | `punk\|80s` |

## Curation targets

| Scale | Musicians | Notes |
|-------|-----------|--------|
| v2.0 roster | **~600** | 147 bands, band-curated lineups |
| Minimum per pool | **~8** | Playable random scroll |
| Comfortable | 1,000+ | Strong daily variety |

## JSON

```json
{
  "id": "phil-anselmo-90s-pantera",
  "name": "Phil Anselmo",
  "band": "Pantera",
  "era": "90s",
  "genres": ["metal"],
  "eligibleSlots": ["Vocals"],
  "stats": { "vox": 86, "play": 99, "groove": 94, "star": 90, "desk": 98 }
}
```

Schema: `data/schemas/musician.schema.json` — `genres` items must be one of the 4 keys.

## Quick reference

```
ROCK          METAL         PUNK          ALT
```

Keys: `rock`, `metal`, `punk`, `alternative`
