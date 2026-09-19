import { describe, expect, it } from 'vitest'
import { simulateAmmoShot } from './ammoPog'

describe('Bullet Ammo.js POG engine benchmark', () => {
  it('runs the real-scale 41 mm POG stack without rendering', async () => {
    const result = await simulateAmmoShot({
      capMassKg: 0.0011,
      slammerMassKg: 0.06,
      speedMps: 4,
      lateralFraction: 0.32,
      seed: 'ammo-smoke',
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
      seed: 'ammo-repeat',
    }

    const first = await simulateAmmoShot(input)
    const second = await simulateAmmoShot(input)

    expect(second).toEqual(first)
  }, 30_000)
})
