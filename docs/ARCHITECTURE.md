# Architecture

## Runtime

- React + TypeScript + Vite
- React Three Fiber / Three.js for rendering
- Rapier for rigid-body physics
- Zustand for small runtime state
- Zod for authored content validation
- Vitest for domain tests

## Domain separation

`src/game/` stays render-agnostic wherever possible.

- `combat.ts` resolves combat.
- `loot.ts` generates deterministic rewards.
- `rng.ts` owns seeded randomness.
- `content.ts` owns authored data and validation.
- `store.ts` connects domain logic to the current playable scene.

Physics decides **which POGs activate**. Combat math decides **what those POGs do**. These concerns must stay separate.

## Developer lenses

- `/dev/slam` — tune the physical hit and observe face-up results.
- `/dev/combat` — choose activated POGs manually and inspect exact math.
- `/dev/loot` — inspect 100 generated slammers at once.

These are intentionally small. We add a larger editor only when it removes more complexity than it adds.

## Determinism

Loot is seeded and deterministic. Physics uses a fixed step and should later gain known-slam replay fixtures. The target debugging packet is:

seed + content version + slammer + initial stack + slam input.
