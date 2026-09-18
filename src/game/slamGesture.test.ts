import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  MAX_PULL_WORLD,
  pullFromWorldDelta,
  slammerImpulse,
} from './slamGesture'

describe('pull-and-release slam gesture', () => {
  it('clamps exact world-space pull distance while preserving direction', () => {
    const pull = pullFromWorldDelta(10, 10)

    expect(Math.hypot(pull.x, pull.z)).toBeCloseTo(MAX_PULL_WORLD, 5)
    expect(pull.power).toBe(1)
    expect(pull.x).toBeCloseTo(pull.z, 5)
  })

  it('launches opposite the world-space pull like a slingshot', () => {
    const pull = { x: -0.5, z: 1, power: 0.7 }
    const impulse = slammerImpulse(pull, 8)

    expect(impulse).not.toBeNull()
    expect(impulse!.x).toBeGreaterThan(0)
    expect(impulse!.z).toBeLessThan(0)
    expect(impulse!.y).toBeLessThan(0)
  })

  it('responds predictably to a tuned launch envelope', () => {
    const pull = { x: 0, z: 1, power: 0.75 }
    const soft = slammerImpulse(pull, 8, {
      horizontalBase: 0.5,
      horizontalPower: 0.5,
      downwardBase: 0.05,
      downwardPower: 0.05,
    })
    const hard = slammerImpulse(pull, 8, {
      horizontalBase: 1.5,
      horizontalPower: 1,
      downwardBase: 0.2,
      downwardPower: 0.2,
    })

    expect(soft).not.toBeNull()
    expect(hard).not.toBeNull()
    expect(Math.hypot(hard!.x, hard!.z)).toBeGreaterThan(Math.hypot(soft!.x, soft!.z))
    expect(Math.abs(hard!.y)).toBeGreaterThan(Math.abs(soft!.y))
  })

  it('ignores tiny accidental releases', () => {
    expect(slammerImpulse({ x: 0.02, z: 0.02, power: 0.02 }, 8)).toBeNull()
  })

  it('never returns pull power outside zero-to-one', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        (x, z) => {
          const pull = pullFromWorldDelta(x, z)
          expect(pull.power).toBeGreaterThanOrEqual(0)
          expect(pull.power).toBeLessThanOrEqual(1)
          expect(Math.hypot(pull.x, pull.z)).toBeLessThanOrEqual(MAX_PULL_WORLD + 1e-9)
        },
      ),
      { numRuns: 150 },
    )
  })
})
