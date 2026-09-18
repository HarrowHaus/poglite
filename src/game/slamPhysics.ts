export interface RotationLike {
  x: number
  y: number
  z: number
  w: number
}

export interface SlamTuning {
  pogFriction: number
  pogRestitution: number
  pogLinearDamping: number
  pogAngularDamping: number
  slammerFriction: number
  slammerRestitution: number
  stackGap: number
  impulseMultiplier: number
  settleMs: number
  faceUpThreshold: number
}

export const DEFAULT_SLAM_TUNING: SlamTuning = {
  pogFriction: 0.78,
  pogRestitution: 0.08,
  pogLinearDamping: 0.28,
  pogAngularDamping: 0.26,
  slammerFriction: 0.72,
  slammerRestitution: 0.08,
  stackGap: 0.005,
  impulseMultiplier: 1,
  settleMs: 1650,
  faceUpThreshold: 0.25,
}

export function capUpDot(rotation: RotationLike): number {
  return 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z)
}

export function isFaceUpRotation(
  rotation: RotationLike,
  threshold = DEFAULT_SLAM_TUNING.faceUpThreshold,
): boolean {
  return capUpDot(rotation) > threshold
}
