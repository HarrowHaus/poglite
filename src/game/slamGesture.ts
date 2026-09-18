export interface PullVector {
  x: number
  z: number
  power: number
}

export interface ScreenPlaneBasis {
  rightX: number
  rightZ: number
  downX: number
  downZ: number
}

export const MAX_PULL_WORLD = 1.65
export const MIN_RELEASE_POWER = 0.12

export function screenPlaneBasisFromCameraForward(
  forwardX: number,
  forwardZ: number,
): ScreenPlaneBasis {
  const length = Math.hypot(forwardX, forwardZ)
  if (length <= 0.000001) {
    return {
      rightX: 1,
      rightZ: 0,
      downX: 0,
      downZ: 1,
    }
  }

  const fx = forwardX / length
  const fz = forwardZ / length

  // Camera-space screen right on the horizontal XZ plane.
  const rightX = -fz
  const rightZ = fx

  // Positive screen Y points down, which means toward the camera.
  const downX = -fx
  const downZ = -fz

  return {
    rightX,
    rightZ,
    downX,
    downZ,
  }
}

export function pullFromScreenMovement(
  movementX: number,
  movementY: number,
  unitsPerPixelX: number,
  unitsPerPixelY: number,
  basis: ScreenPlaneBasis,
  maxPull = MAX_PULL_WORLD,
): PullVector {
  const horizontalPull = movementX * unitsPerPixelX
  const verticalPull = movementY * unitsPerPixelY

  let x =
    basis.rightX * horizontalPull +
    basis.downX * verticalPull
  let z =
    basis.rightZ * horizontalPull +
    basis.downZ * verticalPull

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

  const horizontal = baseImpulse * (1.15 + pull.power * 0.85)
  const downward = baseImpulse * (0.12 + pull.power * 0.15)

  return {
    x: nx * horizontal,
    y: -downward,
    z: nz * horizontal,
  }
}
