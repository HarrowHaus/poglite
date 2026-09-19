// Headless Bullet/Ammo real-scale POG benchmark.
// This file deliberately mirrors realScalePog.ts so engine output can be
// compared without changing the game rules or launch envelope.
import AmmoFactory from 'ammojs3'
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

let ammoPromise: Promise<any> | null = null

async function getAmmo() {
  ammoPromise ??= Promise.resolve(AmmoFactory())
  return ammoPromise
}

export interface BulletShotInput {
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

export interface BulletShotMetrics {
  engine: 'bullet'
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

function quatLike(q: any) {
  return { x: q.x(), y: q.y(), z: q.z(), w: q.w() }
}

function vectorLength(v: any) {
  return Math.hypot(v.x(), v.y(), v.z())
}

function pitchRollSpeed(v: any) {
  return Math.hypot(v.x(), v.z())
}

function destroyAll(Ammo: any, objects: any[]) {
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index]
    if (object) Ammo.destroy(object)
  }
}

function makeRigidBody(
  Ammo: any,
  world: any,
  shape: any,
  massKg: number,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  options: {
    friction: number
    restitution: number
    linearDamping?: number
    angularDamping?: number
  },
  owned: any[],
) {
  const transform = new Ammo.btTransform()
  owned.push(transform)
  transform.setIdentity()

  const origin = new Ammo.btVector3(position.x, position.y, position.z)
  owned.push(origin)
  transform.setOrigin(origin)

  const quaternion = new Ammo.btQuaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  )
  owned.push(quaternion)
  transform.setRotation(quaternion)

  const motionState = new Ammo.btDefaultMotionState(transform)
  owned.push(motionState)

  const inertia = new Ammo.btVector3(0, 0, 0)
  owned.push(inertia)
  if (massKg > 0) shape.calculateLocalInertia(massKg, inertia)

  const info = new Ammo.btRigidBodyConstructionInfo(
    massKg,
    motionState,
    shape,
    inertia,
  )
  owned.push(info)

  const body = new Ammo.btRigidBody(info)
  owned.push(body)
  body.setFriction(options.friction)
  body.setRestitution(options.restitution)
  body.setDamping(
    options.linearDamping ?? 0,
    options.angularDamping ?? 0,
  )
  world.addRigidBody(body)

  return body
}

export async function simulateBulletShot(
  input: BulletShotInput,
): Promise<BulletShotMetrics> {
  const Ammo = await getAmmo()
  const owned: any[] = []
  const bodies: any[] = []

  const collisionConfiguration =
    new Ammo.btDefaultCollisionConfiguration()
  const dispatcher = new Ammo.btCollisionDispatcher(
    collisionConfiguration,
  )
  const broadphase = new Ammo.btDbvtBroadphase()
  const solver = new Ammo.btSequentialImpulseConstraintSolver()
  const world = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration,
  )
  owned.push(
    collisionConfiguration,
    dispatcher,
    broadphase,
    solver,
    world,
  )

  const gravity = new Ammo.btVector3(0, -9.81, 0)
  owned.push(gravity)
  world.setGravity(gravity)

  const solverInfo = world.getSolverInfo?.()
  solverInfo?.set_m_numIterations?.(12)

  const tableFriction = input.tableFriction ?? 0.32
  const capFriction = input.capFriction ?? 0.18
  const slammerFriction = input.slammerFriction ?? 0.9
  const tableRestitution = input.tableRestitution ?? 0.12
  const capRestitution = input.capRestitution ?? 0.08
  const slammerRestitution = input.slammerRestitution ?? 0.18

  const tableHalfExtents = new Ammo.btVector3(0.15, 0.0035, 0.15)
  owned.push(tableHalfExtents)
  const tableShape = new Ammo.btBoxShape(tableHalfExtents)
  owned.push(tableShape)
  tableShape.setMargin(0.00005)

  const table = makeRigidBody(
    Ammo,
    world,
    tableShape,
    0,
    { x: 0, y: TABLE_Y, z: 0 },
    { x: 0, y: 0, z: 0, w: 1 },
    {
      friction: tableFriction,
      restitution: tableRestitution,
    },
    owned,
  )
  bodies.push(table)

  const capHalfExtents = new Ammo.btVector3(
    POG_RADIUS,
    POG_THICKNESS / 2,
    POG_RADIUS,
  )
  owned.push(capHalfExtents)
  const capShape = new Ammo.btCylinderShape(capHalfExtents)
  owned.push(capShape)
  capShape.setMargin(0.00003)

  const caps: any[] = []
  const startY: number[] = []
  const maxRise = new Array(POG_COUNT).fill(0) as number[]
  const peakPitchRoll = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]
  const seed = input.seed ?? 'bullet'

  for (let index = 0; index < POG_COUNT; index += 1) {
    const jitter = offset(index, seed)
    const y = STACK_BASE_Y + index * STACK_SPACING
    startY.push(y)

    const cap = makeRigidBody(
      Ammo,
      world,
      capShape,
      input.capMassKg,
      { x: jitter.x, y, z: jitter.z },
      { x: 1, y: 0, z: 0, w: 0 },
      {
        friction: capFriction,
        restitution: capRestitution,
        linearDamping: 0.035,
        angularDamping: 0.045,
      },
      owned,
    )
    caps.push(cap)
    bodies.push(cap)
  }

  const slammerThickness =
    input.slammerThicknessCm === undefined
      ? DEFAULT_SLAMMER_THICKNESS
      : input.slammerThicknessCm * 0.01

  const slammerHalfExtents = new Ammo.btVector3(
    POG_RADIUS,
    slammerThickness / 2,
    POG_RADIUS,
  )
  owned.push(slammerHalfExtents)
  const slammerShape = new Ammo.btCylinderShape(slammerHalfExtents)
  owned.push(slammerShape)
  slammerShape.setMargin(0.00004)

  const tilt = (input.tiltDeg * Math.PI) / 180
  const direction = input.lateralFraction < 0 ? -1 : 1
  const halfTilt = tilt / 2

  const slammer = makeRigidBody(
    Ammo,
    world,
    slammerShape,
    input.slammerMassKg,
    { x: 0, y: STACK_TOP_Y + 0.075, z: 0 },
    {
      x: 0,
      y: 0,
      z: Math.sin(halfTilt) * direction,
      w: Math.cos(halfTilt),
    },
    {
      friction: slammerFriction,
      restitution: slammerRestitution,
      linearDamping: 0.01,
      angularDamping: 0.04,
    },
    owned,
  )
  bodies.push(slammer)

  // Enable Bullet CCD for the fast, thin slammer/stack contact.
  slammer.setCcdMotionThreshold?.(0.0002)
  slammer.setCcdSweptSphereRadius?.(0.00045)

  const lateralFraction = Math.max(
    -0.75,
    Math.min(0.75, input.lateralFraction),
  )
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  const linearVelocity = new Ammo.btVector3(
    lateralFraction * input.speedMps,
    -verticalFraction * input.speedMps,
    0,
  )
  owned.push(linearVelocity)
  slammer.setLinearVelocity(linearVelocity)

  const angularVelocity = new Ammo.btVector3(0, input.spinRadPerSec, 0)
  owned.push(angularVelocity)
  slammer.setAngularVelocity(angularVelocity)

  const transformScratch = new Ammo.btTransform()
  owned.push(transformScratch)

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    world.stepSimulation(TIMESTEP, 1, TIMESTEP)
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      slammer.getMotionState().getWorldTransform(transformScratch)
      const y = transformScratch.getOrigin().y()

      if (y <= STACK_TOP_Y + slammerThickness) {
        const movingCaps = caps.some(
          (cap) => vectorLength(cap.getLinearVelocity()) > 0.05,
        )
        if (movingCaps) firstImpactMs = elapsedMs
      }
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      cap.getMotionState().getWorldTransform(transformScratch)
      const origin = transformScratch.getOrigin()
      const rotation = transformScratch.getRotation()
      const angular = cap.getAngularVelocity()
      const pr = pitchRollSpeed(angular)

      peakPitchRoll[index] = Math.max(peakPitchRoll[index], pr)
      maxPitchRollRadPerSec = Math.max(maxPitchRollRadPerSec, pr)
      maxRise[index] = Math.max(
        maxRise[index],
        (origin.y() - startY[index]) * 100,
      )

      if (isFaceUpRotation(quatLike(rotation), FACE_UP_THRESHOLD)) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) cap.setDamping(0.45, 0.6)
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every(
        (cap) =>
          vectorLength(cap.getLinearVelocity()) < 0.08 &&
          vectorLength(cap.getAngularVelocity()) < 2,
      )

      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= 8) {
        settleMs = elapsedMs
        break
      }
    }
  }

  let finalFlips = 0
  let scatterRadiusCm = 0

  for (const cap of caps) {
    cap.getMotionState().getWorldTransform(transformScratch)
    const p = transformScratch.getOrigin()
    const q = transformScratch.getRotation()

    if (isFaceUpRotation(quatLike(q), FACE_UP_THRESHOLD)) {
      finalFlips += 1
    }

    scatterRadiusCm = Math.max(
      scatterRadiusCm,
      Math.hypot(p.x(), p.z()) * 100,
    )
  }

  const result: BulletShotMetrics = {
    engine: 'bullet',
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

  for (const body of bodies) world.removeRigidBody(body)
  destroyAll(Ammo, owned)

  return result
}
