import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VERTICAL_SLING,
  constrainVerticalPull,
  verticalSlamImpulse,
} from './verticalSling'

describe('vertical Angry-Birds-style slam', () => {
  it('requires upward charge instead of allowing a horizontal toss', () => {
    const pull = constrainVerticalPull(2, 0.02, 2)
    expect(pull.power).toBeLessThan(0.02)
    expect(verticalSlamImpulse(pull, 8)).toBeNull()
  })

  it('keeps lateral aim subordinate to vertical slam charge', () => {
    const pull = constrainVerticalPull(10, 1, 10)
    const lateral = Math.hypot(pull.x, pull.z)

    expect(lateral).toBeLessThanOrEqual(
      pull.y * DEFAULT_VERTICAL_SLING.lateralRatio + 1e-9,
    )
  })

  it('launches opposite the pull with dominant downward motion', () => {
    const pull = constrainVerticalPull(0.25, 1.2, -0.15)
    const impulse = verticalSlamImpulse(pull, 8)

    expect(impulse).not.toBeNull()
    expect(impulse!.y).toBeLessThan(0)
    expect(Math.abs(impulse!.y)).toBeGreaterThan(Math.hypot(impulse!.x, impulse!.z))
  })

  it('never exceeds configured vertical charge', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        (x, y, z) => {
          const pull = constrainVerticalPull(x, y, z)
          expect(pull.y).toBeGreaterThanOrEqual(0)
          expect(pull.y).toBeLessThanOrEqual(DEFAULT_VERTICAL_SLING.maxVerticalPull)
          expect(pull.power).toBeGreaterThanOrEqual(0)
          expect(pull.power).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 200 },
    )
  })
})
