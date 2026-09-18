# Tooling decisions

## Wired now

- **React Three Fiber + Three.js** — browser-native 3D with code as source of truth.
- **Rapier** — physically simulated slammer and caps.
- **Zustand** — small runtime state without a framework-sized state machine.
- **Zod** — validate authored content.
- **Vitest** — pure combat and generator tests.

## Deliberately deferred

Useful tools that are not yet justified as dependencies:

- **Triplex** — visual R3F scene work when environment/art placement begins.
- **Leva** — live parameter panels when slam tuning outgrows the current native control.
- **Storybook** — reward/binder/shop UI workbench once those screens exist.
- **glTF Transform + gltfjsx** — Blender asset pipeline when primitives are replaced.
- **Sharp** — procedural POG print/face compiler after the art grammar is locked.
- **fast-check** — generative invariant testing once effect/affix combinations become numerous.
- **Playwright** — browser/mobile regression once interaction stops changing daily.

The rule: add infrastructure when it removes more complexity than it introduces.
