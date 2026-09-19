import initJolt from 'jolt-physics'
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

let joltPromise: ReturnType<typeof initJolt> | null = null

async function getJolt() {
  joltPromise ??= initJolt()
  return joltPromise
}

export interface JoltShotInput {
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
  capConvexRadiusM?: number
  slammerConvexRadiusM?: number
}

export interface JoltShotMetrics {
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

function capUpDot(rotation: {
  GetX(): number
  GetY(): number
  GetZ(): number
  GetW(): number
}) {
  const x = rotation.GetX()
  const y = rotation.GetY()
  const z = rotation.GetZ()
  const w = rotation.GetW()

  // Rotate local +Y into world space and return its Y component.
  return 1 - 2 * (x * x + z * z)
}

function asQuat(rotation: {
  GetX(): number
  GetY(): number
  GetZ(): number
  GetW(): number
}) {
  return {
    x: rotation.GetX(),
    y: rotation.GetY(),
    z: rotation.GetZ(),
    w: rotation.GetW(),
  }
}

function pitchRollSpeed(v: {
  GetX(): number
  GetY(): number
  GetZ(): number
}) {
  return Math.hypot(v.GetX(), v.GetZ())
}

function createWorld(Jolt: any) {
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
  settings.mMaxWorkerThreads = 0
  settings.mObjectLayerPairFilter = objectFilter
  settings.mBroadPhaseLayerInterface = bpInterface
  settings.mObjectVsBroadPhaseLayerFilter = bpFilter

  const jolt = new Jolt.JoltInterface(settings)
  Jolt.destroy(settings)

  const physicsSystem = jolt.GetPhysicsSystem()
  const gravity = new Jolt.Vec3(0, -9.81, 0)
  physicsSystem.SetGravity(gravity)
  Jolt.destroy(gravity)

  return {
    jolt,
    physicsSystem,
    bodyInterface: physicsSystem.GetBodyInterface(),
    layer: LAYER,
  }
}

function makeBody(
  Jolt: any,
  bodyInterface: any,
  shape: any,
  position: [number, number, number],
  rotation: [number, number, number, number],
  motionType: number,
  layer: number,
  options: {
    massKg?: number
    friction?: number
    restitution?: number
    linearDamping?: number
    angularDamping?: number
    motionQuality?: number
  } = {},
) {
  const pos = new Jolt.RVec3(...position)
  const rot = new Jolt.Quat(...rotation)
  const settings = new Jolt.BodyCreationSettings(
    shape,
    pos,
    rot,
    motionType,
    layer,
  )

  Jolt.destroy(pos)
  Jolt.destroy(rot)

  // BodyCreationSettings takes a reference to ref-counted shapes.
  // Do not Jolt.destroy(shape) here; CreateBody will transfer the
  // retained shape reference from settings to the body.
  if (options.massKg !== undefined) {
    settings.mOverrideMassProperties =
      Jolt.EOverrideMassProperties_CalculateInertia
    settings.mMassPropertiesOverride.mMass = options.massKg
  }
  if (options.friction !== undefined) settings.mFriction = options.friction
  if (options.restitution !== undefined) {
    settings.mRestitution = options.restitution
  }
  if (options.linearDamping !== undefined) {
    settings.mLinearDamping = options.linearDamping
  }
  if (options.angularDamping !== undefined) {
    settings.mAngularDamping = options.angularDamping
  }
  if (options.motionQuality !== undefined) {
    settings.mMotionQuality = options.motionQuality
  }

  const body = bodyInterface.CreateBody(settings)
  Jolt.destroy(settings)
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)
  return body
}

function destroyBody(Jolt: any, bodyInterface: any, body: any) {
  const id = body.GetID()
  bodyInterface.RemoveBody(id)
  bodyInterface.DestroyBody(id)
}

export async function simulateJoltShot(
  input: JoltShotInput,
): Promise<JoltShotMetrics> {
  const Jolt = await getJolt()
  const {
    jolt,
    physicsSystem,
    bodyInterface,
    layer,
  } = createWorld(Jolt)

  const capFriction = input.capFriction ?? 0.18
  const capRestitution = input.capRestitution ?? 0.08
  const tableFriction = input.tableFriction ?? 0.32
  const tableRestitution = input.tableRestitution ?? 0.12
  const slammerFriction = input.slammerFriction ?? 0.9
  const slammerRestitution = input.slammerRestitution ?? 0.18
  const seed = input.seed ?? 'jolt'

  const bodies: any[] = []
  const caps: any[] = []

  const tableHalfExtents = new Jolt.Vec3(0.15, 0.0035, 0.15)
  const tableShape = new Jolt.BoxShape(
    tableHalfExtents,
    0.0005,
    null,
  )
  Jolt.destroy(tableHalfExtents)

  const table = makeBody(
    Jolt,
    bodyInterface,
    tableShape,
    [0, -0.0035, 0],
    [0, 0, 0, 1],
    Jolt.EMotionType_Static,
    layer,
    {
      friction: tableFriction,
      restitution: tableRestitution,
    },
  )
  bodies.push(table)

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

    const cap = makeBody(
      Jolt,
      bodyInterface,
      new Jolt.CylinderShape(
        POG_THICKNESS_M / 2,
        POG_RADIUS_M,
        0.00015,
        null,
      ),
      [x, y, z],
      [1, 0, 0, 0],
      Jolt.EMotionType_Dynamic,
      layer,
      {
        massKg: input.capMassKg,
        friction: capFriction,
        restitution: capRestitution,
        linearDamping: 0.035,
        angularDamping: 0.045,
      },
    )

    bodies.push(cap)
    caps.push(cap)
  }

  const lateral = Math.max(
    -0.75,
    Math.min(0.75, input.lateralFraction),
  )
  const speed = input.speedMps
  const vertical = Math.sqrt(Math.max(0.001, 1 - lateral * lateral))
  const slammerThickness =
    input.slammerThicknessM ?? DEFAULT_SLAMMER_THICKNESS_M

  const slammer = makeBody(
    Jolt,
    bodyInterface,
    new Jolt.CylinderShape(
      slammerThickness / 2,
      SLAMMER_RADIUS_M,
      0.0004,
      null,
    ),
    [0, STACK_TOP_Y_M + 0.075, 0],
    [0, 0, 0, 1],
    Jolt.EMotionType_Dynamic,
    layer,
    {
      massKg: input.slammerMassKg,
      friction: slammerFriction,
      restitution: slammerRestitution,
      linearDamping: 0.01,
      angularDamping: 0.04,
      motionQuality: Jolt.EMotionQuality_LinearCast,
    },
  )
  bodies.push(slammer)

  const linear = new Jolt.Vec3(
    lateral * speed,
    -vertical * speed,
    0,
  )
  const angular = new Jolt.Vec3(
    0,
    input.spinRadPerSec ?? 0,
    0,
  )
  slammer.SetLinearVelocity(linear)
  slammer.SetAngularVelocity(angular)
  Jolt.destroy(linear)
  Jolt.destroy(angular)

  let firstImpactMs: number | null = null
  let stableFrames = 0
  let settleMs = MAX_SECONDS * 1000
  let maxPitchRollRadPerSec = 0

  const steps = Math.ceil(MAX_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    jolt.Step(TIMESTEP, 1)
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    if (firstImpactMs === null) {
      const slammerY = slammer.GetPosition().GetY()
      if (slammerY <= STACK_TOP_Y_M + slammerThickness) {
        const movingCaps = caps.some((cap) => {
          const v = cap.GetLinearVelocity()
          return Math.hypot(v.GetX(), v.GetY(), v.GetZ()) > 0.05
        })
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
      maxRise[index] = Math.max(
        maxRise[index],
        p.GetY() - startY[index],
      )

      if (
        isFaceUpRotation(
          asQuat(cap.GetRotation()),
          FACE_UP_THRESHOLD,
        )
      ) {
        everFaceUp[index] = true
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 500) {
      for (const cap of caps) {
        const motion = cap.GetMotionProperties()
        motion.SetLinearDamping(0.45)
        motion.SetAngularDamping(0.6)
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 250) {
      const stable = caps.every((cap) => {
        const lv = cap.GetLinearVelocity()
        const av = cap.GetAngularVelocity()
        return (
          Math.hypot(lv.GetX(), lv.GetY(), lv.GetZ()) < 0.08 &&
          Math.hypot(av.GetX(), av.GetY(), av.GetZ()) < 2
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
    isFaceUpRotation(asQuat(cap.GetRotation()), FACE_UP_THRESHOLD),
  ).length

  const scatterRadiusCm =
    Math.max(
      ...caps.map((cap) => {
        const p = cap.GetPosition()
        return Math.hypot(p.GetX(), p.GetZ())
      }),
    ) * 100

  const result: JoltShotMetrics = {
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

  for (const body of bodies.reverse()) {
    destroyBody(Jolt, bodyInterface, body)
  }

  Jolt.destroy(jolt)
  void physicsSystem

  return result
}
