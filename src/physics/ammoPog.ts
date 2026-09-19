import AmmoFactory from 'ammojs3'
import { isFaceUpRotation } from '../game/slamPhysics'
import { seededRng } from '../game/rng'

const POG_RADIUS_M = 0.0206375
const POG_THICKNESS_M = 0.001190625
const POG_COUNT = 8
const STACK_GAP_M = 0.00008
const STACK_SPACING_M = POG_THICKNESS_M + STACK_GAP_M
const STACK_BASE_Y_M = POG_THICKNESS_M / 2 + 0.00002
const STACK_TOP_Y_M =
  STACK_BASE_Y_M +
  (POG_COUNT - 1) * STACK_SPACING_M +
  POG_THICKNESS_M / 2
const SLAMMER_RADIUS_M = POG_RADIUS_M
const DEFAULT_SLAMMER_THICKNESS_M = 0.009525
const FACE_UP_THRESHOLD = 0.72
const TIMESTEP = 1 / 240
const MAX_SECONDS = 1.25

let ammoPromise: ReturnType<typeof AmmoFactory> | null = null

async function getAmmo() {
  ammoPromise ??= AmmoFactory()
  return ammoPromise
}

export interface AmmoShotInput {
  capMassKg: number
  slammerMassKg: number
  speedMps: number
  lateralFraction: number
  spinRadPerSec?: number
  slammerThicknessM?: number
  seed?: string
  capFriction?: number
  capRestitution?: number
  tableFriction?: number
  tableRestitution?: number
  slammerFriction?: number
  slammerRestitution?: number
  capMarginM?: number
  tableMarginM?: number
  slammerMarginM?: number
}

export interface AmmoShotMetrics {
  finalFlips: number
  everFaceUpCount: number
  maxRiseCm: number
  meanMaxRiseCm: number
  scatterRadiusCm: number
  maxPitchRollRadPerSec: number
  meanPeakPitchRollRadPerSec: number
  firstImpactMs: number | null
  settleMs: number
}

interface BodyHandle {
  body: any
  motionState: any
  shape: any
}

function quatOf(transform: any) {
  const q = transform.getRotation()
  return { x: q.x(), y: q.y(), z: q.z(), w: q.w() }
}

function pitchRollSpeed(v: any) {
  return Math.hypot(v.x(), v.z())
}

function makeRigidBody(
  Ammo: any,
  world: any,
  shape: any,
  mass: number,
  position: [number, number, number],
  rotation: [number, number, number, number],
  friction: number,
  restitution: number,
  linearDamping: number,
  angularDamping: number,
): BodyHandle {
  const transform = new Ammo.btTransform()
  transform.setIdentity()

  const origin = new Ammo.btVector3(...position)
  const quat = new Ammo.btQuaternion(...rotation)
  transform.setOrigin(origin)
  transform.setRotation(quat)

  const motionState = new Ammo.btDefaultMotionState(transform)
  const inertia = new Ammo.btVector3(0, 0, 0)
  if (mass > 0) shape.calculateLocalInertia(mass, inertia)

  const info = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    inertia,
  )
  const body = new Ammo.btRigidBody(info)
  body.setFriction(friction)
  body.setRestitution(restitution)
  body.setDamping(linearDamping, angularDamping)
  world.addRigidBody(body)

  Ammo.destroy(info)
  Ammo.destroy(inertia)
  Ammo.destroy(quat)
  Ammo.destroy(origin)
  Ammo.destroy(transform)

  return { body, motionState, shape }
}

function destroyRigidBody(Ammo: any, world: any, handle: BodyHandle) {
  world.removeRigidBody(handle.body)
  Ammo.destroy(handle.body)
  Ammo.destroy(handle.motionState)
  Ammo.destroy(handle.shape)
}

export async function simulateAmmoShot(
  input: AmmoShotInput,
): Promise<AmmoShotMetrics> {
  const Ammo = await getAmmo()

  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
  const broadphase = new Ammo.btDbvtBroadphase()
  const solver = new Ammo.btSequentialImpulseConstraintSolver()
  const world = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration,
  )

  const gravity = new Ammo.btVector3(0, -9.81, 0)
  world.setGravity(gravity)
  Ammo.destroy(gravity)

  const capFriction = input.capFriction ?? 0.18
  const capRestitution = input.capRestitution ?? 0.08
  const tableFriction = input.tableFriction ?? 0.32
  const tableRestitution = input.tableRestitution ?? 0.12
  const slammerFriction = input.slammerFriction ?? 0.9
  const slammerRestitution = input.slammerRestitution ?? 0.18
  const seed = input.seed ?? 'ammo'

  const handles: BodyHandle[] = []
  const caps: BodyHandle[] = []

  const tableHalfExtents = new Ammo.btVector3(0.15, 0.0035, 0.15)
  const tableShape = new Ammo.btBoxShape(tableHalfExtents)
  Ammo.destroy(tableHalfExtents)
  tableShape.setMargin(input.tableMarginM ?? 0.0005)
  const table = makeRigidBody(
    Ammo,
    world,
    tableShape,
    0,
    [0, -0.0035, 0],
    [0, 0, 0, 1],
    tableFriction,
    tableRestitution,
    0,
    0,
  )
  handles.push(table)

  const startY: number[] = []
  const maxRise = new Array(POG_COUNT).fill(0) as number[]
  const peakPitchRoll = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]

  for (let index = 0; index < POG_COUNT; index += 1) {
    const rng = seededRng(seed + ':' + index)
    const x = (rng.next() - 0.5) * 0.0004
    const z = (rng.next() - 0.5) * 0.0004
    const y = STACK_BASE_Y_M + index * STACK_SPACING_M
    startY.push(y)

    const capHalfExtents = new Ammo.btVector3(
      POG_RADIUS_M,
      POG_THICKNESS_M / 2,
      POG_RADIUS_M,
    )
    const shape = new Ammo.btCylinderShape(capHalfExtents)
    Ammo.destroy(capHalfExtents)
    shape.setMargin(input.capMarginM ?? 0.00005)

    const cap = makeRigidBody(
      Ammo,
      world,
      shape,
      input.capMassKg,
      [x, y, z],
      [1, 0, 0, 0],
      capFriction,
      capRestitution,
      0.035,
      0.045,
    )

    handles.push(cap)
    caps.push(cap)
  }

  const lateral = Math.max(-0.75, Math.min(0.75, input.lateralFraction))
  const speed = input.speedMps
  const vertical = Math.sqrt(Math.max(0.001, 1 - lateral * lateral))
  const slammerThickness =
    input.slammerThicknessM ?? DEFAULT_SLAMMER_THICKNESS_M

  const slammerHalfExtents = new Ammo.btVector3(
    SLAMMER_RADIUS_M,
    slammerThickness / 2,
    SLAMMER_RADIUS_M,
  )
  const slammerShape = new Ammo.btCylinderShape(slammerHalfExtents)
  Ammo.destroy(slammerHalfExtents)
  slammerShape.setMargin(input.slammerMarginM ?? 0.0002)

  const slammer = makeRigidBody(
    Ammo,
    world,
    slammerShape,
    input.slammerMassKg,
    [0, STACK_TOP_Y_M + 0.075, 0],
    [0, 0, 0, 1],
    slammerFriction,
    slammerRestitution,
    0.01,
    0.04,
  )
  handles.push(slammer)

  const linear = new Ammo.btVector3(lateral * speed, -vertical * speed, 0)
  const angular = new Ammo.btVector3(0, input.spinRadPerSec ?? 0, 0)
  slammer.body.setLinearVelocity(linear)
  slammer.body.setAngularVelocity(angular)
  slammer.body.setCcdMotionThreshold(0.001)
  slammer.body.setCcdSweptSphereRadius(SLAMMER_RADIUS_M * 0.35)
  slammer.body.activate(true)
  Ammo.destroy(linear)
  Ammo.destroy(angular)

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const transform = new Ammo.btTransform()
  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    world.stepSimulation(TIMESTEP, 1, TIMESTEP)
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      slammer.body.getMotionState().getWorldTransform(transform)
      const slammerY = transform.getOrigin().y()

      if (slammerY <= STACK_TOP_Y_M + slammerThickness) {
        const movingCaps = caps.some((cap) => {
          const v = cap.body.getLinearVelocity()
          return Math.hypot(v.x(), v.y(), v.z()) > 0.05
        })
        if (movingCaps) firstImpactMs = elapsedMs
      }
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      cap.body.getMotionState().getWorldTransform(transform)
      const p = transform.getOrigin()
      const av = cap.body.getAngularVelocity()
      const pr = pitchRollSpeed(av)

      peakPitchRoll[index] = Math.max(peakPitchRoll[index], pr)
      maxPitchRollRadPerSec = Math.max(maxPitchRollRadPerSec, pr)
      maxRise[index] = Math.max(maxRise[index], p.y() - startY[index])

      if (isFaceUpRotation(quatOf(transform), FACE_UP_THRESHOLD)) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) {
        cap.body.setDamping(0.45, 0.6)
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every((cap) => {
        const lv = cap.body.getLinearVelocity()
        const av = cap.body.getAngularVelocity()
        return (
          Math.hypot(lv.x(), lv.y(), lv.z()) < 0.08 &&
          Math.hypot(av.x(), av.y(), av.z()) < 2
        )
      })

      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= 8) {
        settleMs = elapsedMs
        break
      }
    }
  }

  const finalFlips = caps.filter((cap) => {
    cap.body.getMotionState().getWorldTransform(transform)
    return isFaceUpRotation(quatOf(transform), FACE_UP_THRESHOLD)
  }).length

  const scatterRadiusCm =
    Math.max(
      ...caps.map((cap) => {
        cap.body.getMotionState().getWorldTransform(transform)
        const p = transform.getOrigin()
        return Math.hypot(p.x(), p.z())
      }),
    ) * 100

  const result: AmmoShotMetrics = {
    finalFlips,
    everFaceUpCount: everFaceUp.filter(Boolean).length,
    maxRiseCm: Math.max(...maxRise) * 100,
    meanMaxRiseCm:
      (maxRise.reduce((sum, value) => sum + value, 0) /
        maxRise.length) *
      100,
    scatterRadiusCm,
    maxPitchRollRadPerSec,
    meanPeakPitchRollRadPerSec:
      peakPitchRoll.reduce((sum, value) => sum + value, 0) /
      peakPitchRoll.length,
    firstImpactMs,
    settleMs,
  }

  Ammo.destroy(transform)

  for (const handle of handles.reverse()) {
    destroyRigidBody(Ammo, world, handle)
  }

  Ammo.destroy(world)
  Ammo.destroy(solver)
  Ammo.destroy(broadphase)
  Ammo.destroy(dispatcher)
  Ammo.destroy(collisionConfiguration)

  return result
}
