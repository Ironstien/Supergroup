# FAB FIVE — Musician Stats

**Locked.** Every musician has exactly five visible stats on their card, on a **0–99** scale.

| Key | Label | Meaning |
|-----|-------|---------|
| `vox` | **VOX** | Singing, lyrics delivery, front-person presence |
| `play` | **PLAY** | Instrument skill (any axe) |
| `groove` | **GROOVE** | Time, pocket, rhythm-section feel |
| `star` | **STAR** | Fame, charisma, headline draw |
| `desk` | **DESK** | Writing, producing, arrangement, sonic vision |

## Design intent

Mirrors 23-0: players see **proxy stats** on pool cards; **slot ratings** (like position ratings) are derived from weighted combinations and mostly hidden until pick or final breakdown.

- Five stats, five band slots — each slot has a “home” stat, with overlap for multi-role artists.
- Stats feed both **slot fit** and **triple-crown** outcomes (Charts, Tour, Reviews).

## Slot lean (primary → secondary)

| Slot | Home stat | Also cares about |
|------|-----------|------------------|
| **Vocals** | VOX | STAR, GROOVE |
| **Guitar** | PLAY | STAR, DESK |
| **Bass** | GROOVE | PLAY |
| **Drums** | GROOVE | PLAY, STAR |
| **Producer / Songwriter (Flex)** | DESK | PLAY, STAR |

## Triple-crown mapping

| Goal | Primary stats |
|------|----------------|
| **#1 Charts** | STAR, DESK, VOX |
| **Sold-out year** | STAR, GROOVE, VOX |
| **3× five-star reviews** | DESK, PLAY |

## Hidden slot rating

Each musician gets a **slot rating** (0–99) per eligible role, computed from FAB FIVE weights. Tune thresholds in playtesting.

| Slot | Weight formula |
|------|----------------|
| **Vocals** | 0.45×VOX + 0.25×STAR + 0.15×GROOVE + 0.10×PLAY + 0.05×DESK |
| **Guitar** | 0.40×PLAY + 0.20×STAR + 0.15×VOX + 0.15×DESK + 0.10×GROOVE |
| **Bass** | 0.35×GROOVE + 0.35×PLAY + 0.15×STAR + 0.10×DESK + 0.05×VOX |
| **Drums** | 0.40×GROOVE + 0.30×PLAY + 0.20×STAR + 0.05×VOX + 0.05×DESK |
| **Producer** | 0.50×DESK + 0.25×PLAY + 0.15×STAR + 0.05×VOX + 0.05×GROOVE |

### Eligibility

A musician is eligible for a slot when **slot rating ≥ 75** (default; tune in playtesting).

- **Instrument slots** (Vocals, Guitar, Bass, Drums): eligible when that slot’s rating meets threshold.
- **Producer / Songwriter (Flex)**: eligible when **Producer slot rating ≥ 75**, or when tagged as a known producer/songwriter in data (tag optional override for icons like Max Martin with moderate DESK on a bad day).

Multi-role example: Dave Grohl — high PLAY + GROOVE + decent VOX → eligible for Drums, Guitar, Vocals.

### Weak link

Lowest slot rating among filled instrument slots caps Tour and can drag Reviews — same “weakest link” lesson as 23-0 ruckmen.

## Card UI

```
[photo]  Beyoncé
         Vocals · Flex
         VOX 98  PLAY 72  GROOVE 85  STAR 99  DESK 88
```

Pool order remains **random**. Stats are always the same five labels for every musician.

## Final breakdown (on submit)

Reveal per-slot ratings and weakest link, 23-0-style:

```
Vocals  — Beyoncé   97
Guitar  — …         82  ← weakest link
…
Charts:  ✓   Tour:  ✓   Reviews: ✗ (2/3 five-star)
```

## Hidden / not on card

| Field | Notes |
|-------|--------|
| **Slot ratings** | Derived; shown on pick or submit |
| **Beef list** | Chemistry warnings only |
| **Ego** | Optional hidden; high STAR correlates; drives beef variance |
| **Genre tags** | From spin pool, not stats |
| **Era** | From spin (Genre · Era) |

## Reference cards (curator targets)

Rough 0–99 scores for calibration:

| Artist | VOX | PLAY | GROOVE | STAR | DESK | Natural slots |
|--------|-----|------|--------|------|------|----------------|
| Beyoncé | 98 | 72 | 85 | 99 | 88 | Vocals, Flex |
| Jimi Hendrix | 65 | 99 | 78 | 95 | 70 | Guitar |
| Flea | 55 | 88 | 92 | 80 | 60 | Bass |
| John Bonham | 40 | 85 | 97 | 88 | 45 | Drums |
| Max Martin | 35 | 50 | 60 | 75 | 99 | Flex |
| Dave Grohl | 78 | 90 | 88 | 92 | 75 | Drums, Guitar, Vocals |

## Curation notes

Hand-scored 0–99 for v1 is fine. Optional inputs when researching an artist:

| Stat | Possible sources |
|------|------------------|
| VOX | Lead-vocal credits, vocal reputation, frontperson identity |
| PLAY | Instrument polls, technical reputation, session work |
| GROOVE | Rhythm-section fame, pocket/balance reputation |
| STAR | Chart peaks, headliner history, normalized popularity |
| DESK | Production/writing credits, critical acclaim for craft |

Consistent curator judgment beats fake precision.

## JSON shape

```json
{
  "id": "beyonce",
  "name": "Beyoncé",
  "stats": {
    "vox": 98,
    "play": 72,
    "groove": 85,
    "star": 99,
    "desk": 88
  },
  "eligibleSlots": ["Vocals", "Producer"],
  "beef": []
}
```

`eligibleSlots` can be stored explicitly or derived at build time from slot ratings. Schema: `data/schemas/musician.schema.json`.
