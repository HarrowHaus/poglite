# Tooling decisions

Project rule:

> Search maintained open-source tooling before writing substantial generic infrastructure. Keep custom code for Poglite-specific rules, feel, content, and art direction.

## Wired now

- **React + TypeScript + Vite** — browser application/build system; Vite dynamic imports split developer labs from the normal playable route.
- **Three.js + React Three Fiber** — full 3D rendering and the camera/raycast math used by the pull gesture.
- **Rapier + @react-three/rapier** — rigid-body simulation, contact-force events, debug view, and native cylinder colliders for POGs/slammers.
- **@use-gesture/react** — touch/mouse drag lifecycle.
- **Zustand + persist** — run state and the current small local collection save.
- **Zod** — authored content validation.
- **pure-rand** — deterministic PRNG/distributions behind Poglite's small RNG wrapper.
- **Vitest** — unit/domain tests.
- **fast-check** — generated invariants and geometry/property fuzzing.
- **Playwright** — Chromium production-build/Page-base smoke tests.
- **Leva** — generic Slam Lab tuning controls.
- **GitHub Pages Actions** — automatic live demo deployment from green main.

## Intentionally custom

These are product-specific and should not be replaced by generic engines unless they stop being small:

- combat resolver: face-up POGs -> Power/Guard effects;
- slammer loot/content grammar;
- pack/collection rules;
- slingshot impulse rule;
- POG visual grammar/foundry;
- shot telemetry semantics;
- tiny base-aware route switch.

## Deferred with explicit triggers

- **Howler.js** — adopt when real authored sound files arrive; current synth audio is timing scaffolding only.
- **Blender + gltfjsx + glTF Transform** — adopt when final low-poly slammers/environment props replace primitives.
- **Sharp** — add when locked POG art needs build-time atlases/thumbnails/export batches.
- **Basis Universal/KTX2** — add when texture payload justifies GPU compression.
- **Post-processing stack** — add only after visual direction is locked.
- **R3F adaptive performance / detailed perf panel** — use when target-phone profiling shows pressure; use R3F's built-in adaptive controls before adding a monitor library.
- **IndexedDB/Dexie** — only when save data grows beyond collection metadata into replay/blob/cache territory.
- **Nakama or another game backend** — only when accounts, authoritative economy, async PvP, leaderboards, or cloud saves become real requirements.
- **Theatre.js** — only when authored pack/boss/camera timelines become cumbersome in normal React/CSS.
- **Storybook** — only if component-state coverage outgrows the existing purpose-built dev routes.

## Held / not adopted

- **Triplex** — useful conceptually, but hold until its licensing is explicit and suitable.
- **XState** — run flow is still small enough that Zustand + explicit phases is easier to understand.
- **React Router/Wouter** — current route needs do not justify another router.
- **ECS frameworks (Miniplex/Koota)** — object count and entity behavior are far too small to warrant ECS complexity.
- **roguelite-core** — useful architectural reference for future headless simulation, not a compatible gameplay engine.
- **Phaser/Matter/Pixi/Cannon/Godot** — no advantage over the current browser-native Three/Rapier architecture for the signature 3D cap physics.

## Audit checkpoint

Re-run this audit before adding any substantial new subsystem: real audio, environment art, account/backend, multiplayer, telemetry ingestion, large-scale balance simulation, or procedural content tooling.
