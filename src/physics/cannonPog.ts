import {
  Body,
  Box,
  ContactMaterial,
  Cylinder,
  Material,
  Quaternion,
  Vec3,
  World,
  type GSSolver,
} from 'cannon-es'
import { seededRng } from '../game/rng'
import { isFaceUpRotation } from '../game/slamPhysics'

const POG_RADIUS = 0.0206375
const POG_THICKNESS = 0.001190625
const POG_COUNT = 8
const STACK_GAP = 0.00008
const STACK_SPACING = POG_THICKNESS + STACK_GAP
const TABLE_Y = -0.0035
const STACK_BASE_Y = POG_THICKNESS / 2 + 0.00002
const STACK_TOP_Y =
  STACK_BASE_Y +
  (POG_COUNT - 1) * STACK_SPACING +
  POG_THICKNESS / 2
const DEFAULT_SLAMMER_THICKNESS = 0.009525
const FACE_UP_THRESHOLD = 0.72
const TIMESTEP = 1 / 240
const MAX_SECONDS = 1.25

export interface CannonShotInput {
  capMassKg: number
  slammerMassKg: number
  slammerThicknessCm?: number
  speedMps: number
  lateralFraction: number
  tiltDeg: number
  spinRadPerSec: number
  seed?: string
  capFriction?: number
  tableFriction?: number
  slammerFriction?: number
  capRestitution?: number
  tableRestitution?: number
  slammerRestitution?: number
}

export interface CannonShotMetrics {
  engine: 'cannon'
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
    x: (rng.next() - 0.5) * 0.0004,
    z: (rng.next() - 0.5) * 0.0004,
  }
}

function length3(v: Vec3) {
  return Math.hypot(v.x, v.y, v.z)
}

function pitchRollSpeed(v: Vec3) {
  return Math.hypot(v.x, v.z)
}

function makeContact(
  a: Material,
  b: Material,
  friction: number,
  restitution: number,
) {
  return new ContactMaterial(a, b, {
    friction,
    restitution,
    contactEquationStiffness: 1e9,
    contactEquationRelaxation: 3,
    frictionEquationStiffness: 1e9,
    frictionEquationRelaxation: 3,
  })
}

export async function simulateCannonShot(
  input: CannonShotInput,
): Promise<CannonShotMetrics> {
  const world = new World({
    gravity: new Vec3(0, -9.81, 0),
    allowSleep: true,
    quatNormalizeSkip: 0,
    quatNormalizeFast: false,
  })

  const solver = world.solver as GSSolver
  solver.iterations = 12
  solver.tolerance = 1e-10

  const tableFriction = input.tableFriction ?? 0.32
  const capFriction = input.capFriction ?? 0.18
  const slammerFriction = input.slammerFriction ?? 0.9
  const tableRestitution = input.tableRestitution ?? 0.12
  const capRestitution = input.capRestitution ?? 0.08
  const slammerRestitution = input.slammerRestitution ?? 0.18

  const capMaterial = new Material('cap')
  const tableMaterial = new Material('table')
  const slammerMaterial = new Material('slammer')

  // Match the effective pair rules used in the Rapier benchmark:
  // cap-cap = cap properties, cap-table = lower friction / higher restitution,
  // cap-slammer = high grip / higher restitution.
  world.addContactMaterial(
    makeContact(
      capMaterial,
      capMaterial,
      capFriction,
      capRestitution,
    ),
  )
  world.addContactMaterial(
    makeContact(
      capMaterial,
      tableMaterial,
      Math.min(capFriction, tableFriction),
      Math.max(capRestitution, tableRestitution),
    ),
  )
  world.addContactMaterial(
    makeContact(
      capMaterial,
      slammerMaterial,
      Math.max(capFriction, slammerFriction),
      Math.max(capRestitution, slammerRestitution),
    ),
  )

  const table = new Body({
    mass: 0,
    type: Body.STATIC,
    material: tableMaterial,
    position: new Vec3(0, TABLE_Y, 0),
    shape: new Box(new Vec3(0.15, 0.0035, 0.15)),
  })
  world.addBody(table)

  // 48 segments keeps the collider close to a real round POG while still
  // using Cannon's native convex-cylinder implementation.
  const capShape = new Cylinder(
    POG_RADIUS,
    POG_RADIUS,
    POG_THICKNESS,
    48,
  )

  const caps: Body[] = []
  const startY: number[] = []
  const maxRise = new Array(POG_COUNT).fill(0) as number[]
  const peakPitchRoll = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]
  const seed = input.seed ?? 'cannon'

  for (let index = 0; index < POG_COUNT; index += 1) {
    const jitter = offset(index, seed)
    const y = STACK_BASE_Y + index * STACK_SPACING
    startY.push(y)

    const cap = new Body({
      mass: input.capMassKg,
      material: capMaterial,
      position: new Vec3(jitter.x, y, jitter.z),
      quaternion: new Quaternion(1, 0, 0, 0),
      shape: capShape,
      linearDamping: 0.035,
      angularDamping: 0.045,
      allowSleep: true,
      sleepSpeedLimit: 0.008,
      sleepTimeLimit: 0.25,
    })

    world.addBody(cap)
    caps.push(cap)
  }

  const slammerThickness =
    input.slammerThicknessCm === undefined
      ? DEFAULT_SLAMMER_THICKNESS
      : input.slammerThicknessCm * 0.01

  const slammerShape = new Cylinder(
    POG_RADIUS,
    POG_RADIUS,
    slammerThickness,
    48,
  )

  const tilt = (input.tiltDeg * Math.PI) / 180
  const direction = input.lateralFraction < 0 ? -1 : 1
  const halfTilt = tilt / 2

  const slammer = new Body({
    mass: input.slammerMassKg,
    material: slammerMaterial,
    position: new Vec3(0, STACK_TOP_Y + 0.075, 0),
    quaternion: new Quaternion(
      0,
      0,
      Math.sin(halfTilt) * direction,
      Math.cos(halfTilt),
    ),
    shape: slammerShape,
    linearDamping: 0.01,
    angularDamping: 0.04,
    allowSleep: false,
  })

  const lateralFraction = Math.max(
    -0.75,
    Math.min(0.75, input.lateralFraction),
  )
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  slammer.velocity.set(
    lateralFraction * input.speedMps,
    -verticalFraction * input.speedMps,
    0,
  )
  slammer.angularVelocity.set(0, input.spinRadPerSec, 0)
  world.addBody(slammer)

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    world.step(TIMESTEP)
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      if (slammer.position.y <= STACK_TOP_Y + slammerThickness) {
        const movingCaps = caps.some(
          (cap) => length3(cap.velocity) > 0.05,
        )
        if (movingCaps) firstImpactMs = elapsedMs
      }
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      const pr = pitchRollSpeed(cap.angularVelocity)

      peakPitchRoll[index] = Math.max(peakPitchRoll[index], pr)
      maxPitchRollRadPerSec = Math.max(maxPitchRollRadPerSec, pr)
      maxRise[index] = Math.max(
        maxRise[index],
        (cap.position.y - startY[index]) * 100,
      )

      if (
        isFaceUpRotation(
          {
            x: cap.quaternion.x,
            y: cap.quaternion.y,
            z: cap.quaternion.z,
            w: cap.quaternion.w,
          },
          FACE_UP_THRESHOLD,
        )
      ) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) {
        cap.linearDamping = 0.45
        cap.angularDamping = 0.6
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every(
        (cap) =>
          length3(cap.velocity) < 0.08 &&
          length3(cap.angularVelocity) < 2,
      )

      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= 8) {
        settleMs = elapsedMs
        break
      }
    }
  }

  const finalFlips = caps.filter((cap) =>
    isFaceUpRotation(
      {
        x: cap.quaternion.x,
        y: cap.quaternion.y,
        z: cap.quaternion.z,
        w: cap.quaternion.w,
      },
      FACE_UP_THRESHOLD,
    ),
  ).length

  const scatterRadiusCm = Math.max(
    ...caps.map((cap) =>
      Math.hypot(cap.position.x, cap.position.z) * 100,
    ),
  )

  return {
    engine: 'cannon',
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
}
