# Poglite

Browser-first collectible physics roguelite built around one tactile action: slam a stack of collectible caps, resolve what flips, collect better loot, and build stronger runs.

## Design contract

- **Simple on the surface.** Slam. Face-up caps activate. Defeat the enemy before it defeats you.
- **Depth lives in content.** Rarity, tiers, affixes, drop weighting, enemy patterns, cap effects, and slammer rolls create variety without adding control complexity.
- **Physics is the randomizer, not the rules manual.** We do not stack hidden random damage rolls on top of the slam.
- **Unlimited content, limited rules.** New content should compose existing primitives before inventing new subsystems.
- **Browser-first, production-minded.** The game is designed for a polished full release, not a throwaway web toy.

The first engineering target is a vertical combat foundation: one table, one slammer, one stack, one enemy, deterministic combat resolution, seeded loot, and developer views for slam tuning and loot inspection.
