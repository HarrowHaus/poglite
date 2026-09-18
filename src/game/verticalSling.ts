export interface VerticalSlingPull {
  x: number
  y: number
  z: number
  power: number
}

export interface VerticalSlingConfig {
  maxVerticalPull: number
  lateralRatio: number
  minVerticalPull: number
}

export const DEFAULT_VERTICAL_SLING: VerticalSlingConfig = {
  maxVerticalPull: 1.55,
  lateralRatio: 0.48,
  minVerticalPull: 0.12,
}

export function constrainVerticalPull(
  deltaX: number,
  deltaY: number,
  deltaZ: number,
  config: VerticalSlingConfig = DEFAULT_VERTICAL_SLING,
): VerticalSlingPull {
  const up = Math.max(0, Math.min(config.maxVerticalPull, deltaY))

  const lateralLength = Math.hypot(deltaX, deltaZ)
  const maxLateral = up * config.lateralRatio

  let x = deltaX
  let z = deltaZ

  if (lateralLength > maxLateral && lateralLength > 0.000001) {
    const scale = maxLateral / lateralLength
    x *= scale
    z *= scale
  }

  return {
    x,
    y: up,
    z,
    power: up / config.maxVerticalPull,
  }
}

export function verticalSlamImpulse(
  pull: VerticalSlingPull,
  baseImpulse: number,
): { x: number; y: number; z: number } | null {
  if (pull.y < DEFAULT_VERTICAL_SLING.minVerticalPull || pull.power <= 0) {
    return null
  }

  const length = Math.hypot(pull.x, pull.y, pull.z)
  if (length <= 0.000001) return null

  const magnitude = baseImpulse * (0.7 + 1.15 * pull.power)

  return {
    x: (-pull.x / length) * magnitude,
    y: (-pull.y / length) * magnitude,
    z: (-pull.z / length) * magnitude,
  }
}
