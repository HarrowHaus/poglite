import { describe, expect, it } from 'vitest'
import { HAND_SLAM, launchFromHandVelocity } from './handSlam'

describe('hand slam velocity mapping', () => {
  it('does not arm a stationary hand', () => {
    const launch = launchFromHandVelocity({ x: 0, y: 0, z: 0 })
    expect(launch.strength).toBe(0)
    expect(launch.speedMps).toBe(HAND_SLAM.minLaunchSpeedMps)
  })

  it('maps a strong downward stroke to the validated top speed', () => {
    const launch = launchFromHandVelocity({
      x: 0,
      y: -HAND_SLAM.fullDownSpeedCmPerSec,
      z: 0,
    })
    expect(launch.strength).toBe(1)
    expect(launch.speedMps).toBe(HAND_SLAM.maxLaunchSpeedMps)
    expect(launch.velocity.y).toBeLessThan(0)
  })

  it('caps lateral velocity at the validated 32 percent envelope', () => {
    const launch = launchFromHandVelocity({ x: 100, y: -20, z: 0 })
    expect(launch.lateralFraction).toBe(HAND_SLAM.maxLateralFraction)
    expect(Math.abs(launch.velocity.x)).toBeLessThan(
      Math.abs(launch.velocity.y),
    )
  })
})
