import { describe, expect, it } from 'vitest'
import { simulateJoltShot } from './joltPog'

describe('Jolt POG engine benchmark', () => {
  it('runs the real-scale 41 mm POG stack without rendering', async () => {
    const result = await simulateJoltShot({
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 3.25,
      lateralFraction: 0.24,
      seed: 'jolt-smoke',
    })

    expect(result.firstImpactMs).not.toBeNull()
    expect(Number.isFinite(result.scatterRadiusCm)).toBe(true)
    expect(result.maxPitchRollRadPerSec).toBeGreaterThan(0)
  }, 20_000)

  it('is deterministic for the same initial state', async () => {
    const input = {
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 4,
      lateralFraction: 0.32,
      seed: 'jolt-repeat',
    }

    const first = await simulateJoltShot(input)
    const second = await simulateJoltShot(input)

    expect(second).toEqual(first)
  }, 30_000)
})
