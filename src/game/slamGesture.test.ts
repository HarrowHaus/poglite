import { describe, expect, it } from 'vitest'
import {
  MAX_PULL_WORLD,
  pullFromMovement,
  slammerImpulse,
} from './slamGesture'

describe('pull-and-release slam gesture', () => {
  it('clamps pull distance while preserving direction', () => {
    const pull = pullFromMovement(1000, 1000, 0.01, 0.01)

    expect(Math.hypot(pull.x, pull.z)).toBeCloseTo(MAX_PULL_WORLD, 5)
    expect(pull.power).toBe(1)
    expect(pull.x).toBeCloseTo(pull.z, 5)
  })

  it('launches opposite the pull like a slingshot', () => {
    const pull = { x: -0.5, z: 1, power: 0.7 }
    const impulse = slammerImpulse(pull, 8)

    expect(impulse).not.toBeNull()
    expect(impulse!.x).toBeGreaterThan(0)
    expect(impulse!.z).toBeLessThan(0)
    expect(impulse!.y).toBeLessThan(0)
  })

  it('ignores tiny accidental releases', () => {
    expect(slammerImpulse({ x: 0.02, z: 0.02, power: 0.02 }, 8)).toBeNull()
  })
})
