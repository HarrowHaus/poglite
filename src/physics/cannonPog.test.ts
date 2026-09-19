import { describe, expect, it } from 'vitest'
import { simulateCannonShot } from './cannonPog'

describe('Cannon-es real-scale POG simulation', () => {
  it('runs a real-scale 8-cap slam headlessly', async () => {
    const result = await simulateCannonShot({
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 4,
      lateralFraction: 0.32,
      tiltDeg: 0,
      spinRadPerSec: 0,
      seed: 'smoke',
    })

    expect(result.firstImpactMs).not.toBeNull()
    expect(result.finalFlips).toBeGreaterThanOrEqual(0)
    expect(result.finalFlips).toBeLessThanOrEqual(8)
    expect(result.maxPitchRollRadPerSec).toBeGreaterThan(0)
  }, 30_000)

  it('is repeatable for an identical initial state', async () => {
    const input = {
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 3.25,
      lateralFraction: 0.24,
      tiltDeg: 0,
      spinRadPerSec: 0,
      seed: 'repeat',
    }

    const a = await simulateCannonShot(input)
    const b = await simulateCannonShot(input)

    expect(b.finalFlips).toBe(a.finalFlips)
    expect(b.scatterRadiusCm).toBeCloseTo(a.scatterRadiusCm, 8)
  }, 30_000)
})
