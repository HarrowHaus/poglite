# Poglite

Browser-first collectible physics roguelite built around one tactile action: **slam a stack of collectible caps, resolve what flips, collect better loot, and build stronger runs.**

## Design contract

- **Simple on the surface.** Slam. Face-up caps activate. Defeat the enemy before it defeats you.
- **Depth lives in content.** Rarity, tiers, affixes, drop weighting, enemy patterns, cap effects, and slammer rolls create variety without adding control complexity.
- **Physics is the randomizer, not the rules manual.** No extra random damage roll after the slam.
- **Unlimited content, limited rules.** New content composes existing primitives before adding subsystems.
- **Browser-first, production-minded.** This is structured for a polished full game, not a disposable web toy.

## Current foundation

- real 3D cap/slammer rigid bodies with Rapier;
- face-up detection feeds a pure combat resolver;
- HP / Power / Guard only;
- seeded slammer family + level + rarity + affix generation;
- five-fight run cadence with a three-slammer reward choice between encounters;
- one permanent five-POG completion pack per cleared run;
- persistent binder with duplicate counts and cosmetic print variants;
- persistent eight-POG run stack built only from owned unique POG designs;
- authored POG definitions validated with Zod;
- domain tests for combat and loot;
- visual developer lenses for slam feel, combat math, and 100-roll loot inspection.

## Run

```bash
npm install
npm run dev
```

Routes:

- `/` — current playable combat foundation
- `/dev/slam` — physics feel/tuning
- `/dev/combat` — combat math
- `/dev/loot` — 100-roll loot wall
- `/dev/catalog` — all POGs and slammer families at a glance
- `/dev/pack` — deterministic pack reveal and odds inspection
- `/binder` — persistent permanent collection
- `/stack` — choose the eight owned POGs used in runs

Verification:

```bash
npm test
npm run build
```

Read `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` before expanding mechanics.
