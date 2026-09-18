import type { VerticalSlingPull } from '../game/verticalSling'

export const REAL_POG = {
  radiusCm: 2.06375,
  thicknessCm: 0.1190625,
  edgeRadiusCm: 0.015,
  massKg: 0.0011,
  stackGapCm: 0.008,
  faceUpThreshold: 0.72,
  capFriction: 0.18,
  tableFriction: 0.32,
  capRestitution: 0.08,
  tableRestitution: 0.12,
  slammerFriction: 0.9,
  slammerRestitution: 0.18,
} as const

export const REAL_WORLD = {
  unitsPerMeter: 100,
  gravityCmPerSec2: -981,
  tableHalfSizeCm: 15,
  tableHalfHeightCm: 0.35,
  timestep: 1 / 240,
  solverIterations: 12,
  ccdSubsteps: 6,
} as const

export interface RealSlammerProfile {
  massKg: number
  radiusCm: number
  thicknessCm: number
  spinRadPerSec: number
}

const profiles: Record<string, RealSlammerProfile> = {
  'steel-puncher': {
    massKg: 0.06,
    radiusCm: REAL_POG.radiusCm,
    thicknessCm: 0.9525,
    spinRadPerSec: 0,
  },
  'wide-acrylic': {
    massKg: 0.03,
    radiusCm: REAL_POG.radiusCm * 1.03,
    thicknessCm: 0.65,
    spinRadPerSec: 0,
  },
  'brass-drop': {
    massKg: 0.09,
    radiusCm: REAL_POG.radiusCm,
    thicknessCm: 1.20,
    spinRadPerSec: 0,
  },
  'resin-wheel': {
    massKg: 0.04,
    radiusCm: REAL_POG.radiusCm * 1.02,
    thicknessCm: 0.76,
    spinRadPerSec: 0,
  },
  'micro-slam': {
    massKg: 0.05,
    radiusCm: REAL_POG.radiusCm * 0.96,
    thicknessCm: 0.90,
    spinRadPerSec: 0,
  },
  'ceramic-club': {
    massKg: 0.075,
    radiusCm: REAL_POG.radiusCm,
    thicknessCm: 1.10,
    spinRadPerSec: 0,
  },
}

export function realSlammerProfile(familyId: string): RealSlammerProfile {
  return profiles[familyId] ?? profiles['steel-puncher']
}

export const REAL_PULL = {
  maxVerticalPullCm: 4,
  lateralRatio: 0.48,
  minVerticalPullCm: 0.35,
  maxLateralVelocityFraction: 0.32,
  minSpeedMps: 2.25,
  speedGainMps: 2,
} as const

export interface RealLaunch {
  speedMps: number
  lateralFraction: number
  velocityCmPerSec: { x: number; y: number; z: number }
}

export function launchFromRealScalePull(pull: VerticalSlingPull): RealLaunch {
  const horizontalLength = Math.hypot(pull.x, pull.z)
  const horizontalShare =
    pull.y > 0.0001
      ? Math.min(
          1,
          horizontalLength / (pull.y * REAL_PULL.lateralRatio),
        )
      : 0

  const lateralFraction =
    horizontalShare * REAL_PULL.maxLateralVelocityFraction

  const speedMps =
    REAL_PULL.minSpeedMps + REAL_PULL.speedGainMps * pull.power

  const speedCmPerSec = speedMps * REAL_WORLD.unitsPerMeter
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  const dirX = horizontalLength > 0.0001 ? pull.x / horizontalLength : 0
  const dirZ = horizontalLength > 0.0001 ? pull.z / horizontalLength : 0

  return {
    speedMps,
    lateralFraction,
    velocityCmPerSec: {
      x: -dirX * lateralFraction * speedCmPerSec,
      y: -verticalFraction * speedCmPerSec,
      z: -dirZ * lateralFraction * speedCmPerSec,
    },
  }
}
