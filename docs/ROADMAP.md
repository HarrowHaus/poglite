# Production plan

This is a full-game architecture built in proof order, not a throwaway MVP plan.

## Gate 1 — Slam feel

One table, eight placeholder caps, one slammer.

Acceptance:

- touch/mouse input is obvious;
- the hit produces readable scatter and flips;
- repeated slams remain physically stable;
- face-up detection is reliable enough to tune.

## Gate 2 — Combat grammar

One enemy. HP, Power, Guard. Face-up POGs activate. Enemy retaliates if alive.

Acceptance:

- combat resolution is pure and tested;
- the result can be explained in one short breakdown;
- physics contains no damage math.

## Gate 3 — Loot grammar

Slammer family + level + rarity + compatible affixes.

Acceptance:

- seeded rolls reproduce exactly;
- the 100-roll view makes rarity and affix distribution inspectable;
- player-facing descriptions stay short.

## Gate 4 — Content test

20 serious POGs, 6 slammer families, several enemies. Determine whether repeated slam → resolve → reward creates the desired one-more-fight loop.

## Gate 5 — Run structure

Build the complete run cadence on the same tabletop: encounter, reward, upgrade, harder encounter, boss.

## Gate 6 — Collection factory

Binder, pack/gacha-like collection loop, print variants, procedural art grammar, permanent unlocks.

## Gate 7 — Scale and polish

Scale content through the grammar; replace primitives with final art/audio; harden performance, accessibility, save/persistence, telemetry, and backend only when the single-player loop deserves them.
