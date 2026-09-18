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

export interface PredictedPoint {
  x: number
  y: number
  z: number
  t: number
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

export function predictBallisticPath(
  start: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  gravityY: number,
  floorY: number,
  stepSeconds = 0.045,
  maxSeconds = 0.8,
): PredictedPoint[] {
  const points: PredictedPoint[] = []

  for (let t = 0; t <= maxSeconds; t += stepSeconds) {
    const point = {
      x: start.x + velocity.x * t,
      y: start.y + velocity.y * t + 0.5 * gravityY * t * t,
      z: start.z + velocity.z * t,
      t,
    }

    points.push(point)
    if (point.y <= floorY && t > 0) break
  }

  return points
}

export function predictImpactPoint(
  start: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  gravityY: number,
  impactY: number,
): PredictedPoint | null {
  const a = 0.5 * gravityY
  const b = velocity.y
  const c = start.y - impactY

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0 || Math.abs(a) < 1e-9) return null

  const root = Math.sqrt(discriminant)
  const candidates = [
    (-b - root) / (2 * a),
    (-b + root) / (2 * a),
  ].filter((t) => t > 0)

  if (candidates.length === 0) return null
  const t = Math.min(...candidates)

  return {
    x: start.x + velocity.x * t,
    y: impactY,
    z: start.z + velocity.z * t,
    t,
  }
}
