import * as RAPIER from '@dimforge/rapier3d-compat'
import { isFaceUpRotation } from '../game/slamPhysics'
import { seededRng } from '../game/rng'

const CM_PER_METER = 100
const GRAVITY = -9.81 * CM_PER_METER

// Historical / commercial POG dimensions:
// 1 5/8 in diameter, about 3/64 in thick.
const POG_RADIUS = 2.06375
const POG_THICKNESS = 0.1190625
const POG_EDGE_RADIUS = 0.015
const POG_COUNT = 8
const STACK_GAP = 0.008
const STACK_SPACING = POG_THICKNESS + STACK_GAP

const SLAMMER_RADIUS = POG_RADIUS
const DEFAULT_SLAMMER_THICKNESS = 0.9525 // 3/8 in
const TABLE_Y = -0.35
const STACK_BASE_Y = POG_THICKNESS / 2 + 0.002
const STACK_TOP_Y =
  STACK_BASE_Y +
  (POG_COUNT - 1) * STACK_SPACING +
  POG_THICKNESS / 2

const FACE_UP_THRESHOLD = 0.72
const TIMESTEP = 1 / 240
const MAX_SECONDS = 1.25

let initialized: Promise<void> | null = null

async function ensureRapier() {
  initialized ??= RAPIER.init().then(() => undefined)
  await initialized
}

export interface RealScaleShotInput {
  capMassKg: number
  slammerMassKg: number
  slammerThicknessCm?: number
  speedMps: number
  lateralFraction: number
  tiltDeg: number
  spinRadPerSec: number
  seed?: string
  capRestitution?: number
  tableRestitution?: number
  slammerRestitution?: number
  capFriction?: number
  tableFriction?: number
  slammerFriction?: number
}

export interface RealScaleShotMetrics {
  capMassKg: number
  slammerMassKg: number
  speedMps: number
  lateralFraction: number
  tiltDeg: number
  spinRadPerSec: number
  finalFlips: number
  everFaceUpCount: number
  anyFlip: boolean
  anyEverFaceUp: boolean
  maxRiseCm: number
  meanMaxRiseCm: number
  scatterRadiusCm: number
  maxPitchRollRadPerSec: number
  meanPeakPitchRollRadPerSec: number
  firstImpactMs: number | null
  settleMs: number
}

function offset(index: number, seed: string) {
  const rng = seededRng(seed + ':' + index)
  return {
    x: (rng.next() - 0.5) * 0.04,
    z: (rng.next() - 0.5) * 0.04,
  }
}

function pitchRollSpeed(v: { x: number; y: number; z: number }) {
  return Math.hypot(v.x, v.z)
}

function slammerQuaternion(
  tiltDeg: number,
  lateralFraction: number,
): { x: number; y: number; z: number; w: number } {
  const angle = (tiltDeg * Math.PI) / 180
  const direction = lateralFraction < 0 ? -1 : 1
  const half = angle / 2

  // Tilt around Z so the leading left/right edge enters first.
  return {
    x: 0,
    y: 0,
    z: Math.sin(half) * direction,
    w: Math.cos(half),
  }
}

export async function simulateRealScaleShot(
  input: RealScaleShotInput,
): Promise<RealScaleShotMetrics> {
  await ensureRapier()

  const seed = input.seed ?? 'real-scale'
  const lateralFraction = Math.max(-0.75, Math.min(0.75, input.lateralFraction))
  const speedCmPerSec = input.speedMps * CM_PER_METER
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 })
  world.timestep = TIMESTEP
  world.lengthUnit = CM_PER_METER
  world.numSolverIterations = 12
  world.maxCcdSubsteps = 6

  const tableRestitution = input.tableRestitution ?? 0.12
  const capRestitution = input.capRestitution ?? 0.08
  const slammerRestitution = input.slammerRestitution ?? 0.18
  const tableFriction = input.tableFriction ?? 0.32
  const capFriction = input.capFriction ?? 0.18
  const slammerFriction = input.slammerFriction ?? 0.9

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(15, 0.35, 15)
      .setTranslation(0, TABLE_Y, 0)
      .setFriction(tableFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(tableRestitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
  )

  const caps: RAPIER.RigidBody[] = []
  const startY: number[] = []
  const maxRise = new Array(POG_COUNT).fill(0) as number[]
  const peakPitchRoll = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]

  for (let index = 0; index < POG_COUNT; index += 1) {
    const jitter = offset(index, seed)
    const y = STACK_BASE_Y + index * STACK_SPACING
    startY.push(y)

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(jitter.x, y, jitter.z)
        .setRotation({ x: 1, y: 0, z: 0, w: 0 })
        .setLinearDamping(0.035)
        .setAngularDamping(0.045)
        .setAdditionalSolverIterations(3),
    )

    world.createCollider(
      RAPIER.ColliderDesc.roundCylinder(
        POG_THICKNESS / 2 - POG_EDGE_RADIUS,
        POG_RADIUS - POG_EDGE_RADIUS,
        POG_EDGE_RADIUS,
      )
        .setMass(input.capMassKg)
        .setFriction(capFriction)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(capRestitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setContactSkin(0.003),
      body,
    )

    caps.push(body)
  }

  const slammerThickness =
    input.slammerThicknessCm ?? DEFAULT_SLAMMER_THICKNESS
  const startYSl = STACK_TOP_Y + 7.5

  const slammer = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, startYSl, 0)
      .setRotation(slammerQuaternion(input.tiltDeg, lateralFraction))
      .setLinearDamping(0.01)
      .setAngularDamping(0.04)
      .setAdditionalSolverIterations(6)
      .setCcdEnabled(true),
  )

  world.createCollider(
    RAPIER.ColliderDesc.cylinder(
      slammerThickness / 2,
      SLAMMER_RADIUS,
    )
      .setMass(input.slammerMassKg)
      .setFriction(slammerFriction)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(slammerRestitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    slammer,
  )

  slammer.setLinvel(
    {
      x: lateralFraction * speedCmPerSec,
      y: -verticalFraction * speedCmPerSec,
      z: 0,
    },
    true,
  )
  slammer.setAngvel(
    {
      x: 0,
      y: input.spinRadPerSec,
      z: 0,
    },
    true,
  )

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    world.step()
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      const slammerPos = slammer.translation()
      if (slammerPos.y <= STACK_TOP_Y + slammerThickness) {
        const movingCaps = caps.some((cap) => {
          const v = cap.linvel()
          return Math.hypot(v.x, v.y, v.z) > 5
        })
        if (movingCaps) firstImpactMs = elapsedMs
      }
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      const p = cap.translation()
      const av = cap.angvel()
      const pr = pitchRollSpeed(av)
      peakPitchRoll[index] = Math.max(peakPitchRoll[index], pr)
      maxPitchRollRadPerSec = Math.max(maxPitchRollRadPerSec, pr)
      maxRise[index] = Math.max(maxRise[index], p.y - startY[index])

      if (isFaceUpRotation(cap.rotation(), FACE_UP_THRESHOLD)) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) {
        cap.setLinearDamping(0.45)
        cap.setAngularDamping(0.6)
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every((cap) => {
        const lv = cap.linvel()
        const av = cap.angvel()
        return (
          Math.hypot(lv.x, lv.y, lv.z) < 8 &&
          Math.hypot(av.x, av.y, av.z) < 2
        )
      })

      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= 8) {
        settleMs = elapsedMs
        break
      }
    }
  }

  const finalFlips = caps.filter((cap) =>
    isFaceUpRotation(cap.rotation(), FACE_UP_THRESHOLD),
  ).length

  const scatterRadiusCm = Math.max(
    ...caps.map((cap) => {
      const p = cap.translation()
      return Math.hypot(p.x, p.z)
    }),
  )

  const result: RealScaleShotMetrics = {
    capMassKg: input.capMassKg,
    slammerMassKg: input.slammerMassKg,
    speedMps: input.speedMps,
    lateralFraction,
    tiltDeg: input.tiltDeg,
    spinRadPerSec: input.spinRadPerSec,
    finalFlips,
    everFaceUpCount: everFaceUp.filter(Boolean).length,
    anyFlip: finalFlips > 0,
    anyEverFaceUp: everFaceUp.some(Boolean),
    maxRiseCm: Math.max(...maxRise),
    meanMaxRiseCm:
      maxRise.reduce((sum, value) => sum + value, 0) / maxRise.length,
    scatterRadiusCm,
    maxPitchRollRadPerSec,
    meanPeakPitchRollRadPerSec:
      peakPitchRoll.reduce((sum, value) => sum + value, 0) /
      peakPitchRoll.length,
    firstImpactMs,
    settleMs,
  }

  world.free()
  return result
}
