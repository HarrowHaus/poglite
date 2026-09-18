import { REAL_WORLD } from './pogPhysicalProfile'

export interface HandVelocity {
  x: number
  y: number
  z: number
}

export const HAND_SLAM = {
  minDownSpeedCmPerSec: 10,
  fullDownSpeedCmPerSec: 65,
  minLaunchSpeedMps: 2.35,
  maxLaunchSpeedMps: 4.25,
  maxLateralFraction: 0.32,
} as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function launchFromHandVelocity(velocity: HandVelocity) {
  const downward = Math.max(0, -velocity.y)
  const strength = clamp(
    (downward - HAND_SLAM.minDownSpeedCmPerSec) /
      (HAND_SLAM.fullDownSpeedCmPerSec -
        HAND_SLAM.minDownSpeedCmPerSec),
    0,
    1,
  )

  const speedMps =
    HAND_SLAM.minLaunchSpeedMps +
    (HAND_SLAM.maxLaunchSpeedMps -
      HAND_SLAM.minLaunchSpeedMps) *
      strength

  const lateralSpeed = Math.hypot(velocity.x, velocity.z)
  const rawLateralFraction =
    downward > 0.001 ? lateralSpeed / downward : 0
  const lateralFraction = Math.min(
    HAND_SLAM.maxLateralFraction,
    rawLateralFraction,
  )

  const lateralLength = Math.hypot(velocity.x, velocity.z)
  const dirX = lateralLength > 0.001 ? velocity.x / lateralLength : 0
  const dirZ = lateralLength > 0.001 ? velocity.z / lateralLength : 0

  const speedCmPerSec = speedMps * REAL_WORLD.unitsPerMeter
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  return {
    strength,
    speedMps,
    lateralFraction,
    velocity: {
      x: dirX * lateralFraction * speedCmPerSec,
      y: -verticalFraction * speedCmPerSec,
      z: dirZ * lateralFraction * speedCmPerSec,
    },
  }
}
