# Open-source architecture audit

This document exists to enforce a project rule:

> Before writing a substantial generic subsystem, search for maintained open-source tooling. Custom code is reserved for behavior that is specifically Poglite.

Status values:

- **KEEP** — current choice is the right abstraction.
- **ADOPT NOW** — generic code we should stop owning immediately.
- **DEFER** — useful tool, but adopting it before the trigger below would add more complexity than it removes.
- **REJECT** — plausible alternative that does not fit this game/workflow.

## Runtime engine

### React + TypeScript + Vite — KEEP

Browser-native is the product target and lets chat-driven development remain code-first. Vite is already the correct lightweight build layer.

### React Three Fiber + Three.js — KEEP

The game needs real 3D disc rotation, perspective, lighting, shader/material work, and browser deployment. R3F keeps the complete Three.js API while giving us reusable React components.

### Rapier / @react-three/rapier — KEEP

Rigid-body cylinders striking a stack are the signature mechanic. Rapier gives us real 3D rigid-body simulation, collision/contact-force events, fixed stepping, debug rendering, snapshots, and WASM performance. POGs and slammers now use Rapier's native cylinder colliders instead of auto-generated convex hulls; exact primitive shapes are simpler, cheaper, and give mass/inertia from the geometry Rapier actually understands.

Do not replace with:
- Phaser / Matter: primarily 2D.
- PixiJS: rendering, not the required 3D rigid-body engine.
- Cannon: capable, but no benefit over the Rapier foundation already working.
- Godot: capable, but browser export/editor workflow is a worse fit for this chat-first web-native project.

## Input

### @use-gesture/react — KEEP

Adopted for pointer/touch drag lifecycle instead of continuing custom gesture bookkeeping.

Poglite owns only the slingshot rule. Pointer projection itself now uses Three.js Raycaster projection onto the horizontal slammer plane, so perspective/FOV/aspect are not approximated by custom screen-axis math.

## Randomness

### Homegrown PRNG — REPLACED

The first prototype owned a small deterministic PRNG and integer sampling.

### pure-rand — ADOPT NOW

Use a maintained deterministic PRNG plus unbiased uniform integer/float distributions. Preserve our tiny `Rng` wrapper so game code is not coupled to library internals.

## Generated-system testing

### Hand-picked invariant examples — KEEP, but insufficient alone

Example tests remain useful for named regressions.

### fast-check — ADOPT NOW

Use property-based testing for:
- pack guarantees;
- legal slammer rolls;
- deterministic RNG behavior;
- stack invariants;
- camera-space gesture transforms;
- future effect combinations.

Generated content needs generated tests.

## Browser regression testing

### Playwright — ADOPT NOW

The live demo already has project-base routing, persistent local state, mobile pointer behavior, and WebGL. Browser smoke tests should verify the production-base build instead of relying only on TypeScript/unit tests.

Initial scope:
- Pages base loads;
- root canvas mounts;
- stack and binder navigation survive the `/poglite/` base.

Expand to gesture automation only after the pull/release envelope is stable.

## State and persistence

### Zustand — KEEP

Runtime state is small and explicit. XState would currently add ceremony without solving a real problem.

### Zustand persist/localStorage — KEEP

Collection metadata is tiny. IndexedDB/Dexie is unnecessary now.

**Trigger for IndexedDB/Dexie:** large replay history, downloaded asset caches, user-created art blobs, or other data that no longer belongs in localStorage.

### XState — DEFER

**Trigger:** run flow becomes genuinely hierarchical/concurrent (interruptible events, nested encounters, async network states) and boolean/phase transitions become difficult to prove.

## Schemas/content

### Zod — KEEP

Correct fit for authored POG, slammer, enemy, pack, and future content validation.

## Dev tuning UI

### Leva — ADOPTED

Pull/release tuning pushed the Slam Lab past the point where maintaining our own slider/control plumbing made sense. Leva 0.10.1 supports React 19 and now owns the generic dev-control surface.

Poglite continues to own only game-specific measurements and telemetry:
- pull power;
- impact timing/strength;
- miss rate;
- flip distribution;
- resolution timing.

This preserves a clean line between reusable tuning UI and Poglite-specific game instrumentation.

## Visual scene editing

### Triplex — HOLD PENDING LICENSE CLARITY

Triplex is technically attractive for visual R3F scene work, but its repository has had explicit licensing ambiguity and currently should not be treated as a dependency we are free to adopt.

**Trigger:** authored environments/lighting make visual editing materially faster **and** the tool has a clear license suitable for our use.

Until then, use Leva plus the existing code/dev-lab workflow and Blender for authored assets.

## 3D asset pipeline

### Blender — DEFER / EXTERNAL TOOL

Use for final slammer bodies, table props, machines, environment pieces.

### glTF Transform — DEFER

Use for repeatable glTF optimization, compression, cleanup, and build-time processing.

### gltfjsx — DEFER

Use when Blender-authored GLBs enter the repo so assets become typed/reusable R3F components.

### Basis Universal / KTX2 — DEFER

Use when texture payload becomes meaningful. Do not introduce compression infrastructure while almost all art is generated Canvas content.

## POG art factory

### Browser Canvas visual grammar — KEEP

The deterministic art grammar is specifically Poglite and useful for live candidate inspection.

### Sharp — DEFER

Move selected/locked art into a build-time Sharp pipeline when we need to batch render atlases, WebP/PNG assets, thumbnails, or print exports.

Do not replace the live foundry; add Sharp as the production compiler.

## Audio

### Temporary Web Audio synth feedback — KEEP TEMPORARILY

It exists only to tune event timing and impact feel.

### Howler.js — DEFER, EXPECTED ADOPTION

Howler handles cross-browser/mobile unlocking, caching, sound sprites, simultaneous playback, volume/rate/fades, and Web Audio/HTML5 fallback.

**Trigger:** first real authored impact/UI/music asset enters the game.

At that point presentation events stay unchanged and Howler replaces the temporary oscillator/noise implementation.

## Animation/cinematics

### CSS + simple camera feedback — KEEP

Current needs are small.

### Theatre.js — DEFER

**Trigger:** pack openings, boss intros, machine animations, or reward cameras require authored timelines/curves that are awkward to maintain as hand-written state.

## Rendering effects

### @react-three/postprocessing — DEFER

Likely useful for final pixelation, bloom, vignette, color treatment, and hit effects.

**Trigger:** art direction is sufficiently locked that post-processing is serving a known visual target rather than decorating placeholders.

## Performance

### R3F built-in performance controls — KEEP / USE FIRST

React Three Fiber already exposes performance regression/adaptive-DPR mechanisms. Prefer those before introducing another runtime monitor.

### r3f-perf or other detailed perf panel — DEFER

Useful in dev routes when we need draw-call/GPU inspection, but it is not needed to fix today's gameplay and would add another dependency surface.

**Trigger:** first real environment/postprocessing pass or observed mobile frame drops on target phones.

## R3F scene testing

### @react-three/test-renderer — DEFER

Useful for scene-graph regressions without a real WebGL renderer.

**Trigger:** reusable scene components gain enough conditional geometry/material behavior that pure math tests no longer cover them.

## Routing

### Tiny base-aware route switch — KEEP

Current route count and navigation requirements do not justify a router dependency.

### Wouter / React Router — DEFER

**Trigger:** nested routes, route params, navigation state, history-aware overlays, or protected/user-specific routes.

## Deployment

### GitHub Pages Actions — KEEP

Correct for the current static browser demo. Automatically deploys green `main` builds. Developer routes are lazy-loaded with React/Vite dynamic imports so Leva/foundry tooling is split out of the normal playable entry path.

**Trigger for another host:** server-side accounts, matchmaking, secure inventory/gacha authority, APIs, or edge/server functions.

## Backend

### None — KEEP FOR NOW

Do not add a backend merely because a gacha/collection architecture may eventually need one.

**Trigger:** persistent accounts across devices, authoritative paid/random rewards, async PvP, leaderboards, cloud saves, or trading.

At that point evaluate open-source game backends (including Nakama) before custom API work.

## Balance simulation

### roguelite-core — REJECT AS A DEPENDENCY / HARVEST ARCHITECTURE

The open-source `roguelite-core` project demonstrates a useful pattern: pure deterministic reducers plus a headless batch simulator across thousands of seeds.

Do not import its engine. Its auto-battle, node-map, type/status, evolution, and recruitment mechanics are a different game.

Do copy the architectural idea when Poglite reaches automated balance simulation:

- immutable content snapshot;
- pure combat/run reducers;
- seeded simulation;
- batch runner;
- aggregate win-rate / damage / reward-choice outputs.

Poglite's physical activation probabilities will be supplied by measured slam distributions rather than importing another game's combat engine.

## Analytics / balance telemetry

### Current local dev telemetry — KEEP NOW

The Slam Lab already exposes flip distribution.

### GamePulse — DEFER / WATCH

GamePulse is an MIT self-hosted game-specific telemetry project with progression, economy, retention, and balance-oriented analysis, but it is currently early/alpha.

Do not make an alpha analytics stack a production dependency before we have players.

**Trigger:** meaningful outside playtest cohort. Re-evaluate GamePulse and other current open-source telemetry projects then, before building our own ingestion/dashboard system.

## Summary

### Adopted now
- @use-gesture/react
- pure-rand
- fast-check
- Playwright
- Leva

### Keep
- React / TypeScript / Vite
- Three.js / React Three Fiber
- Rapier
- Zustand + persist
- Zod
- Canvas POG foundry
- GitHub Pages

### Next open-source evaluation triggers
1. Real audio -> Howler.
2. Real 3D assets -> Blender + gltfjsx + glTF Transform.
3. Large texture payload -> Basis/KTX2.
4. Heavy visual tuning -> Leva now; revisit a visual R3F editor only after license clarity.
5. Locked visual direction -> @react-three/postprocessing.
6. Mobile performance pressure -> R3F adaptive performance tooling.
7. UI flow complexity -> router/XState only if proven necessary.
8. Accounts/online economy -> evaluate Nakama/backend options first.
