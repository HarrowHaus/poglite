import * as RAPIER from '@dimforge/rapier3d-compat'
import { SLAMMER_FAMILIES } from '../game/content'
import { capUpDot, isFaceUpRotation } from '../game/slamPhysics'
import {
  constrainVerticalPull,
  verticalSlamImpulse,
  verticalSlamOrientation,
  verticalSlamYawSpin,
} from '../game/verticalSling'
import { seededRng } from '../game/rng'

const POG_COUNT = 8
const POG_RADIUS = 0.58
const POG_THICKNESS = 0.045
const POG_EDGE_RADIUS = 0.006
const POG_MASS = 0.08
const STACK_SPACING = 0.046
const CAP_FRICTION = 0.18
const TABLE_FRICTION = 0.30
const SLAMMER_FRICTION = 0.95
const FACE_UP_THRESHOLD = 0.72
const ANCHOR = { x: 0, y: 1.35, z: 0 }
const MAX_SIM_SECONDS = 1.15
const TIMESTEP = 1 / 120

let initialized: Promise<void> | null = null

async function ensureRapier() {
  initialized ??= RAPIER.init().then(() => undefined)
  await initialized
}

export interface HeadlessShotInput {
  familyId: string
  power: number
  lateral: number
  jitterSeed?: string
  baseTilt?: number
  extraTilt?: number
  spinScale?: number
  capRestitution?: number
  tableRestitution?: number
  slammerRestitution?: number
}

export interface HeadlessShotMetrics {
  familyId: string
  power: number
  lateral: number
  flips: number
  firstImpactMs: number | null
  settleMs: number
  contactEccentricity: number | null
  contactNormalTiltDeg: number | null
  totalNormalImpulse: number
  totalTangentImpulse: number
  tangentToNormalRatio: number
  maxCapPitchRollSpeed: number
  meanCapPitchRollSpeed: number
  scatterRadius: number
  maxHeight: number
  maxCapRise: number
  meanMaxCapRise: number
  everFaceUpCount: number
  maxUpDot: number
}

function familyById(id: string) {
  const family = SLAMMER_FAMILIES.find((candidate) => candidate.id === id)
  if (!family) throw new Error('Unknown slammer family: ' + id)
  return family
}

function stackOffset(index: number, seed: string) {
  const rng = seededRng(seed + ':' + index)
  return {
    x: (rng.next() - 0.5) * 0.009,
    z: (rng.next() - 0.5) * 0.009,
  }
}

function pitchRollSpeed(v: { x: number; y: number; z: number }) {
  return Math.hypot(v.x, v.z)
}

export async function simulateVerticalShot(
  input: HeadlessShotInput,
): Promise<HeadlessShotMetrics> {
  await ensureRapier()

  const family = familyById(input.familyId)
  const power = Math.max(0, Math.min(1, input.power))
  const lateral = Math.max(-1, Math.min(1, input.lateral))
  const jitterSeed = input.jitterSeed ?? 'matrix'
  const capRestitution = input.capRestitution ?? 0.03
  const tableRestitution = input.tableRestitution ?? 0
  const slammerRestitution = input.slammerRestitution ?? 0.09

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = TIMESTEP
  world.numSolverIterations = 8
  world.maxCcdSubsteps = 4

  const ground = RAPIER.ColliderDesc.cuboid(3.75, 0.2, 3.75)
    .setTranslation(0, -0.22, 0)
    .setFriction(TABLE_FRICTION)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
    .setRestitution(tableRestitution)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
  world.createCollider(ground)

  const caps: RAPIER.RigidBody[] = []
  const capColliders: RAPIER.Collider[] = []

  for (let index = 0; index < POG_COUNT; index += 1) {
    const offset = stackOffset(index, jitterSeed)

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        offset.x,
        0.04 + index * STACK_SPACING,
        offset.z,
      )
      .setRotation({ x: 1, y: 0, z: 0, w: 0 })
      .setLinearDamping(0.05)
      .setAngularDamping(0.08)
      .setAdditionalSolverIterations(2)

    const body = world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.roundCylinder(
      POG_THICKNESS / 2 - POG_EDGE_RADIUS,
      POG_RADIUS - POG_EDGE_RADIUS,
      POG_EDGE_RADIUS,
    )
      .setMass(POG_MASS)
      .setFriction(CAP_FRICTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(capRestitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setContactSkin(0.0015)

    const collider = world.createCollider(colliderDesc, body)
    caps.push(body)
    capColliders.push(collider)
  }

  const pull = constrainVerticalPull(
    lateral * power * 0.72,
    power * 1.55,
    0,
  )

  const impulse = verticalSlamImpulse(pull, family.physics.slamImpulse)
  if (!impulse) {
    world.free()
    return {
      familyId: family.id,
      power,
      lateral,
      flips: 0,
      firstImpactMs: null,
      settleMs: 0,
      contactEccentricity: null,
      contactNormalTiltDeg: null,
      totalNormalImpulse: 0,
      totalTangentImpulse: 0,
      tangentToNormalRatio: 0,
      maxCapPitchRollSpeed: 0,
      meanCapPitchRollSpeed: 0,
      scatterRadius: 0,
      maxHeight: 0,
      maxCapRise: 0,
      meanMaxCapRise: 0,
      everFaceUpCount: 0,
      maxUpDot: -1,
    }
  }

  const orientation = verticalSlamOrientation(
    pull,
    input.baseTilt,
    input.extraTilt,
  )
  const physicalSlammerThickness = family.physics.thickness * 1.55

  const slammerDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(
      ANCHOR.x + pull.x,
      ANCHOR.y + pull.y,
      ANCHOR.z + pull.z,
    )
    .setRotation(orientation)
    .setLinearDamping(0.04)
    .setAngularDamping(0.18)
    .setAdditionalSolverIterations(4)
    .setCcdEnabled(true)

  const slammerBody = world.createRigidBody(slammerDesc)
  const slammerCollider = world.createCollider(
    RAPIER.ColliderDesc.cylinder(
      physicalSlammerThickness / 2,
      family.physics.radius,
    )
      .setMass(family.physics.mass)
      .setFriction(SLAMMER_FRICTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setRestitution(slammerRestitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
    slammerBody,
  )

  slammerBody.applyImpulse(impulse, true)
  slammerBody.setAngvel(
    {
      x: 0,
      y:
        verticalSlamYawSpin(pull) *
        (input.spinScale ?? 1),
      z: 0,
    },
    true,
  )

  let firstImpactMs: number | null = null
  let firstPoint: { x: number; y: number; z: number } | null = null
  let firstNormal: { x: number; y: number; z: number } | null = null
  let totalNormalImpulse = 0
  let totalTangentImpulse = 0
  let maxCapPitchRollSpeed = 0
  const perCapPeak = new Array(POG_COUNT).fill(0) as number[]
  const initialHeights = Array.from(
    { length: POG_COUNT },
    (_, index) => 0.04 + index * STACK_SPACING,
  )
  const maxRiseByCap = new Array(POG_COUNT).fill(0) as number[]
  const everFaceUp = new Array(POG_COUNT).fill(false) as boolean[]
  let maxUpDot = -1
  let maxHeight = 0
  let stableFrames = 0
  let settleMs = MAX_SIM_SECONDS * 1000

  const steps = Math.ceil(MAX_SIM_SECONDS / TIMESTEP)

  for (let step = 0; step < steps; step += 1) {
    world.step()
    const elapsedMs = (step + 1) * TIMESTEP * 1000

    for (let capIndex = 0; capIndex < capColliders.length; capIndex += 1) {
      world.contactPair(
        slammerCollider,
        capColliders[capIndex],
        (manifold) => {
          const contacts = manifold.numContacts()
          const solverContacts = manifold.numSolverContacts()

          if (
            firstImpactMs === null &&
            (contacts > 0 || solverContacts > 0)
          ) {
            firstImpactMs = elapsedMs

            if (solverContacts > 0) {
              const p = manifold.solverContactPoint(0)
              firstPoint = { x: p.x, y: p.y, z: p.z }
            }

            const n = manifold.normal()
            firstNormal = { x: n.x, y: n.y, z: n.z }
          }

          for (let i = 0; i < contacts; i += 1) {
            totalNormalImpulse += Math.abs(manifold.contactImpulse(i))
            totalTangentImpulse += Math.hypot(
              manifold.contactTangentImpulseX(i),
              manifold.contactTangentImpulseY(i),
            )
          }
        },
      )
    }

    for (let index = 0; index < caps.length; index += 1) {
      const cap = caps[index]
      const angular = pitchRollSpeed(cap.angvel())
      const translation = cap.translation()
      const upDot = capUpDot(cap.rotation())
      perCapPeak[index] = Math.max(perCapPeak[index], angular)
      maxCapPitchRollSpeed = Math.max(maxCapPitchRollSpeed, angular)
      maxHeight = Math.max(maxHeight, translation.y)
      maxRiseByCap[index] = Math.max(
        maxRiseByCap[index],
        translation.y - initialHeights[index],
      )
      maxUpDot = Math.max(maxUpDot, upDot)
      if (upDot > FACE_UP_THRESHOLD) everFaceUp[index] = true
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 380) {
      for (const cap of caps) {
        cap.setLinearDamping(0.52)
        cap.setAngularDamping(0.72)
      }
    }

    if (firstImpactMs !== null && elapsedMs - firstImpactMs > 220) {
      const stable = caps.every((cap) => {
        const lv = cap.linvel()
        const av = cap.angvel()
        return (
          Math.hypot(lv.x, lv.y, lv.z) < 0.45 &&
          Math.hypot(av.x, av.y, av.z) < 1.2
        )
      })

      stableFrames = stable ? stableFrames + 1 : 0

      if (stableFrames >= 5) {
        settleMs = elapsedMs
        break
      }
    }
  }

  const flips = caps.filter((cap) =>
    isFaceUpRotation(cap.rotation(), FACE_UP_THRESHOLD),
  ).length

  const scatterRadius = Math.max(
    ...caps.map((cap) => {
      const p = cap.translation()
      return Math.hypot(p.x, p.z)
    }),
  )

  const meanCapPitchRollSpeed =
    perCapPeak.reduce((sum, value) => sum + value, 0) /
    perCapPeak.length
  const maxCapRise = Math.max(...maxRiseByCap)
  const meanMaxCapRise =
    maxRiseByCap.reduce((sum, value) => sum + value, 0) /
    maxRiseByCap.length
  const everFaceUpCount = everFaceUp.filter(Boolean).length

  // These refs are assigned from Rapier's synchronous contactPair callback.
  // TypeScript cannot infer callback mutation across the simulation loop.
  const capturedPoint = firstPoint as
    | { x: number; y: number; z: number }
    | null
  const capturedNormal = firstNormal as
    | { x: number; y: number; z: number }
    | null

  const eccentricity =
    capturedPoint === null
      ? null
      : Math.hypot(capturedPoint.x, capturedPoint.z) / POG_RADIUS

  const normalTilt =
    capturedNormal === null
      ? null
      : Math.acos(Math.min(1, Math.abs(capturedNormal.y))) *
        (180 / Math.PI)

  const result: HeadlessShotMetrics = {
    familyId: family.id,
    power,
    lateral,
    flips,
    firstImpactMs,
    settleMs,
    contactEccentricity: eccentricity,
    contactNormalTiltDeg: normalTilt,
    totalNormalImpulse,
    totalTangentImpulse,
    tangentToNormalRatio:
      totalNormalImpulse > 0
        ? totalTangentImpulse / totalNormalImpulse
        : 0,
    maxCapPitchRollSpeed,
    meanCapPitchRollSpeed,
    scatterRadius,
    maxHeight,
    maxCapRise,
    meanMaxCapRise,
    everFaceUpCount,
    maxUpDot,
  }

  world.free()
  return result
}

export async function runVerticalShotMatrix(options?: {
  powers?: number[]
  laterals?: number[]
  families?: string[]
  seeds?: string[]
}) {
  const powers = options?.powers ?? [0.45, 0.65, 0.85, 1]
  const laterals = options?.laterals ?? [-1, -0.5, 0, 0.5, 1]
  const families =
    options?.families ?? SLAMMER_FAMILIES.map((family) => family.id)
  const seeds = options?.seeds ?? ['a', 'b', 'c']

  const results: HeadlessShotMetrics[] = []

  for (const familyId of families) {
    for (const power of powers) {
      for (const lateral of laterals) {
        for (const jitterSeed of seeds) {
          results.push(
            await simulateVerticalShot({
              familyId,
              power,
              lateral,
              jitterSeed,
            }),
          )
        }
      }
    }
  }

  return results
}
