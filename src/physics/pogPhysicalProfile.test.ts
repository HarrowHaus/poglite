import { describe, expect, it } from 'vitest'
import {
  launchFromRealScalePull,
  REAL_PULL,
  REAL_WORLD,
} from './pogPhysicalProfile'

describe('real-scale vertical launch profile', () => {
  it('maps medium pull into the validated low-3 m/s regime', () => {
    const launch = launchFromRealScalePull({
      x: 0,
      y: REAL_PULL.maxVerticalPullCm * 0.5,
      z: 0,
      power: 0.5,
    })

    expect(launch.speedMps).toBeCloseTo(3.25, 6)
    expect(launch.lateralFraction).toBe(0)
    expect(launch.velocityCmPerSec.y).toBeLessThan(0)
  })

  it('caps lateral launch at the validated 32% regime', () => {
    const pullY = REAL_PULL.maxVerticalPullCm
    const launch = launchFromRealScalePull({
      x: pullY * REAL_PULL.lateralRatio,
      y: pullY,
      z: 0,
      power: 1,
    })

    expect(launch.lateralFraction).toBeCloseTo(0.32, 8)
    expect(Math.abs(launch.velocityCmPerSec.x)).toBeGreaterThan(0)
    expect(Math.abs(launch.velocityCmPerSec.x)).toBeLessThan(
      Math.abs(launch.velocityCmPerSec.y),
    )
  })

  it('uses centimeter gravity units consistently with the Rapier world', () => {
    expect(REAL_WORLD.unitsPerMeter).toBe(100)
    expect(REAL_WORLD.gravityCmPerSec2).toBe(-981)
  })
})
