import initJolt from 'jolt-physics'
import { seededRng } from '../game/rng'
import { isFaceUpRotation } from '../game/slamPhysics'

const POG_RADIUS = 2.06375
const POG_THICKNESS = 0.1190625
const POG_COUNT = 8
const STACK_GAP = 0.008
const STACK_SPACING = POG_THICKNESS + STACK_GAP
const TABLE_Y = -0.35
const STACK_BASE_Y = POG_THICKNESS / 2 + 0.002
const STACK_TOP_Y =
  STACK_BASE_Y +
  (POG_COUNT - 1) * STACK_SPACING +
  POG_THICKNESS / 2

const DEFAULT_SLAMMER_THICKNESS = 0.9525
const FACE_UP_THRESHOLD = 0.72
const TIMESTEP = 1 / 240
const MAX_SECONDS = 1.25
const GRAVITY = -981

let joltModulePromise: ReturnType<typeof initJolt> | null = null

async function getJolt() {
  joltModulePromise ??= initJolt()
  return joltModulePromise
}

export interface JoltShotInput {
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

export interface JoltShotMetrics {
  engine: 'jolt'
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

function quatLike(q: any) {
  return {
    x: q.GetX(),
    y: q.GetY(),
    z: q.GetZ(),
    w: q.GetW(),
  }
}

function pitchRollSpeed(v: any) {
  return Math.hypot(v.GetX(), v.GetZ())
}

function vectorLength(v: any) {
  return Math.hypot(v.GetX(), v.GetY(), v.GetZ())
}

function slammerQuat(Jolt: any, tiltDeg: number, lateralFraction: number) {
  const angle = (tiltDeg * Math.PI) / 180
  const direction = lateralFraction < 0 ? -1 : 1
  const half = angle / 2
  return new Jolt.Quat(0, 0, Math.sin(half) * direction, Math.cos(half))
}

function setupWorld(Jolt: any) {
  const LAYER = 0

  const objectFilter = new Jolt.ObjectLayerPairFilterTable(1)
  objectFilter.EnableCollision(LAYER, LAYER)

  const bpLayer = new Jolt.BroadPhaseLayer(0)
  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(1, 1)
  bpInterface.MapObjectToBroadPhaseLayer(LAYER, bpLayer)
  Jolt.destroy(bpLayer)

  const bpFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
    bpInterface,
    1,
    objectFilter,
    1,
  )

  const settings = new Jolt.JoltSettings()
  settings.mObjectLayerPairFilter = objectFilter
  settings.mBroadPhaseLayerInterface = bpInterface
  settings.mObjectVsBroadPhaseLayerFilter = bpFilter

  const jolt = new Jolt.JoltInterface(settings)
  Jolt.destroy(settings)

  const physicsSystem = jolt.GetPhysicsSystem()
  const gravity = new Jolt.Vec3(0, GRAVITY, 0)
  physicsSystem.SetGravity(gravity)
  Jolt.destroy(gravity)

  return {
    LAYER,
    jolt,
    physicsSystem,
    bodyInterface: physicsSystem.GetBodyInterface(),
  }
}

function addBody(
  Jolt: any,
  bodyInterface: any,
  LAYER: number,
  shape: any,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  motionType: number,
  options: {
    massKg?: number
    friction: number
    restitution: number
    linearDamping?: number
    angularDamping?: number
    continuous?: boolean
    velocitySteps?: number
    positionSteps?: number
  },
) {
  const pos = new Jolt.RVec3(position.x, position.y, position.z)
  const rot = new Jolt.Quat(rotation.x, rotation.y, rotation.z, rotation.w)
  const settings = new Jolt.BodyCreationSettings(
    shape,
    pos,
    rot,
    motionType,
    LAYER,
  )
  Jolt.destroy(pos)
  Jolt.destroy(rot)

  settings.mFriction = options.friction
  settings.mRestitution = options.restitution
  settings.mLinearDamping = options.linearDamping ?? 0
  settings.mAngularDamping = options.angularDamping ?? 0
  settings.mAllowSleeping = true

  if (options.massKg !== undefined) {
    settings.mOverrideMassProperties =
      Jolt.EOverrideMassProperties_CalculateInertia
    settings.mMassPropertiesOverride.mMass = options.massKg
  }

  if (options.continuous) {
    settings.mMotionQuality = Jolt.EMotionQuality_LinearCast
  }

  if (options.velocitySteps !== undefined) {
    settings.mNumVelocityStepsOverride = options.velocitySteps
  }
  if (options.positionSteps !== undefined) {
    settings.mNumPositionStepsOverride = options.positionSteps
  }

  const body = bodyInterface.CreateBody(settings)
  Jolt.destroy(settings)
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)
  return body
}

function removeBodies(Jolt: any, bodyInterface: any, bodies: any[]) {
  for (const body of bodies) {
    const id = body.GetID()
    bodyInterface.RemoveBody(id)
    bodyInterface.DestroyBody(id)
  }
}

export async function simulateJoltShot(
  input: JoltShotInput,
): Promise<JoltShotMetrics> {
  const Jolt = await getJolt()
  const {
    LAYER,
    jolt,
    bodyInterface,
  } = setupWorld(Jolt)

  const bodies: any[] = []
  const caps: any[] = []

  const tableFriction = input.tableFriction ?? 0.32
  const capFriction = input.capFriction ?? 0.18
  const slammerFriction = input.slammerFriction ?? 0.9
  const tableRestitution = input.tableRestitution ?? 0.12
  const capRestitution = input.capRestitution ?? 0.08
  const slammerRestitution = input.slammerRestitution ?? 0.18

  const tableSize = new Jolt.Vec3(15, 0.35, 15)
  const tableShape = new Jolt.BoxShape(tableSize, 0.02, null)
  Jolt.destroy(tableSize)

  const table = addBody(
    Jolt,
    bodyInterface,
    LAYER,
    tableShape,
    { x: 0, y: TABLE_Y, z: 0 },
    { x: 0, y: 0, z: 0, w: 1 },
    Jolt.EMotionType_Static,
    {
      friction: tableFriction,
      restitution: tableRestitution,
    },
  )
  bodies.push(table)

  const capShape = new Jolt.CylinderShape(
    POG_THICKNESS / 2,
    POG_RADIUS,
    0.005,
    null,
  )

  const seed = input.seed ?? 'jolt'
  const startY: number[] = []
  const maxRise = new Array(POG_COUNT).fill(0) as number[]
  const peakPitchRoll = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]

  for (let index = 0; index < POG_COUNT; index += 1) {
    const jitter = offset(index, seed)
    const y = STACK_BASE_Y + index * STACK_SPACING
    startY.push(y)

    const cap = addBody(
      Jolt,
      bodyInterface,
      LAYER,
      capShape,
      { x: jitter.x, y, z: jitter.z },
      { x: 1, y: 0, z: 0, w: 0 },
      Jolt.EMotionType_Dynamic,
      {
        massKg: input.capMassKg,
        friction: capFriction,
        restitution: capRestitution,
        linearDamping: 0.035,
        angularDamping: 0.045,
        velocitySteps: 12,
        positionSteps: 4,
      },
    )

    caps.push(cap)
    bodies.push(cap)
  }

  const slammerThickness =
    input.slammerThicknessCm ?? DEFAULT_SLAMMER_THICKNESS
  const slammerShape = new Jolt.CylinderShape(
    slammerThickness / 2,
    POG_RADIUS,
    0.01,
    null,
  )
  const rotation = slammerQuat(
    Jolt,
    input.tiltDeg,
    input.lateralFraction,
  )

  const slammer = addBody(
    Jolt,
    bodyInterface,
    LAYER,
    slammerShape,
    { x: 0, y: STACK_TOP_Y + 7.5, z: 0 },
    {
      x: rotation.GetX(),
      y: rotation.GetY(),
      z: rotation.GetZ(),
      w: rotation.GetW(),
    },
    Jolt.EMotionType_Dynamic,
    {
      massKg: input.slammerMassKg,
      friction: slammerFriction,
      restitution: slammerRestitution,
      linearDamping: 0.01,
      angularDamping: 0.04,
      continuous: true,
      velocitySteps: 16,
      positionSteps: 6,
    },
  )
  Jolt.destroy(rotation)
  bodies.push(slammer)

  const lateralFraction = Math.max(
    -0.75,
    Math.min(0.75, input.lateralFraction),
  )
  const speedCmPerSec = input.speedMps * 100
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  const linearVelocity = new Jolt.Vec3(
    lateralFraction * speedCmPerSec,
    -verticalFraction * speedCmPerSec,
    0,
  )
  slammer.SetLinearVelocity(linearVelocity)
  Jolt.destroy(linearVelocity)

  const angularVelocity = new Jolt.Vec3(0, input.spinRadPerSec, 0)
  slammer.SetAngularVelocity(angularVelocity)
  Jolt.destroy(angularVelocity)

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    jolt.Step(TIMESTEP, 1)
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      const slammerPos = slammer.GetPosition()
      if (slammerPos.GetY() <= STACK_TOP_Y + slammerThickness) {
        const movingCaps = caps.some(
          (cap) => vectorLength(cap.GetLinearVelocity()) > 5,
        )
        if (movingCaps) firstImpactMs = elapsedMs
      }
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      const p = cap.GetPosition()
      const av = cap.GetAngularVelocity()
      const pr = pitchRollSpeed(av)

      peakPitchRoll[index] = Math.max(peakPitchRoll[index], pr)
      maxPitchRollRadPerSec = Math.max(maxPitchRollRadPerSec, pr)
      maxRise[index] = Math.max(maxRise[index], p.GetY() - startY[index])

      if (isFaceUpRotation(quatLike(cap.GetRotation()), FACE_UP_THRESHOLD)) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) {
        cap.SetLinearDamping(0.45)
        cap.SetAngularDamping(0.6)
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every(
        (cap) =>
          vectorLength(cap.GetLinearVelocity()) < 8 &&
          vectorLength(cap.GetAngularVelocity()) < 2,
      )

      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= 8) {
        settleMs = elapsedMs
        break
      }
    }
  }

  const finalFlips = caps.filter((cap) =>
    isFaceUpRotation(quatLike(cap.GetRotation()), FACE_UP_THRESHOLD),
  ).length

  const scatterRadiusCm = Math.max(
    ...caps.map((cap) => {
      const p = cap.GetPosition()
      return Math.hypot(p.GetX(), p.GetZ())
    }),
  )

  const result: JoltShotMetrics = {
    engine: 'jolt',
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

  removeBodies(Jolt, bodyInterface, bodies)
  Jolt.destroy(jolt)

  return result
}
