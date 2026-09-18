export interface PullVector {
  x: number
  z: number
  power: number
}

export const MAX_PULL_WORLD = 1.65
export const MIN_RELEASE_POWER = 0.12

export function pullFromMovement(
  movementX: number,
  movementY: number,
  unitsPerPixelX: number,
  unitsPerPixelY: number,
  maxPull = MAX_PULL_WORLD,
): PullVector {
  let x = movementX * unitsPerPixelX
  let z = movementY * unitsPerPixelY
  const length = Math.hypot(x, z)

  if (length > maxPull) {
    const scale = maxPull / length
    x *= scale
    z *= scale
  }

  const clampedLength = Math.hypot(x, z)

  return {
    x,
    z,
    power: Math.min(1, clampedLength / maxPull),
  }
}

export function slammerImpulse(
  pull: PullVector,
  baseImpulse: number,
): { x: number; y: number; z: number } | null {
  const length = Math.hypot(pull.x, pull.z)
  if (pull.power < MIN_RELEASE_POWER || length <= 0.0001) return null

  const nx = -pull.x / length
  const nz = -pull.z / length

  // The pull chooses direction and power. Gravity supplies most of the "slam".
  // This keeps the gesture legible while Rapier still determines the collision.
  const horizontal = baseImpulse * (1.15 + pull.power * 0.85)
  const downward = baseImpulse * (0.12 + pull.power * 0.15)

  return {
    x: nx * horizontal,
    y: -downward,
    z: nz * horizontal,
  }
}
