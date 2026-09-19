import { describe, expect, it } from 'vitest'
import { simulateBulletShot } from './bulletPog'

describe('Bullet real-scale POG simulation', () => {
  it('runs an 8-cap slam headlessly', async () => {
    const result = await simulateBulletShot({
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

  it('is repeatable for identical initial state', async () => {
    const input = {
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 3.25,
      lateralFraction: 0.24,
      tiltDeg: 0,
      spinRadPerSec: 0,
      seed: 'repeat',
    }

    const a = await simulateBulletShot(input)
    const b = await simulateBulletShot(input)

    expect(b.finalFlips).toBe(a.finalFlips)
    expect(b.scatterRadiusCm).toBeCloseTo(a.scatterRadiusCm, 6)
  }, 30_000)
})
