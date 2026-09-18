import { useDrag } from '@use-gesture/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  CoefficientCombineRule,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RoundCylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PogFace } from '../components/PogFace'
import { STARTER_STACK, pogById } from '../game/content'
import { rollSlammer } from '../game/loot'
import { isFaceUpRotation } from '../game/slamPhysics'
import {
  constrainVerticalPull,
  predictBallisticPath,
  predictImpactPoint,
  type VerticalSlingPull,
} from '../game/verticalSling'
import { appHref } from '../navigation'
import {
  launchFromRealScalePull,
  REAL_POG,
  REAL_PULL,
  REAL_WORLD,
  realSlammerProfile,
} from '../physics/pogPhysicalProfile'
import { projectClientPointToPlane } from '../presentation/pointerProjection'

const POG_COUNT = STARTER_STACK.length
const STACK_SPACING = REAL_POG.thicknessCm + REAL_POG.stackGapCm
const STACK_BASE_Y = REAL_POG.thicknessCm / 2 + 0.002
const STACK_TOP_Y =
  STACK_BASE_Y +
  (POG_COUNT - 1) * STACK_SPACING +
  REAL_POG.thicknessCm / 2

const ANCHOR = { x: 0, y: STACK_TOP_Y + 3.5, z: 0 }
const PULL_CONFIG = {
  maxVerticalPull: REAL_PULL.maxVerticalPullCm,
  lateralRatio: REAL_PULL.lateralRatio,
  minVerticalPull: REAL_PULL.minVerticalPullCm,
}

const EMPTY_PULL: VerticalSlingPull = { x: 0, y: 0, z: 0, power: 0 }
const MAX_RESOLVE_MS = 1250

function vecLength(v: { x: number; y: number; z: number }) {
  return Math.hypot(v.x, v.y, v.z)
}

function stackOffset(index: number) {
  return {
    x: (((index * 37) % 5) - 2) * 0.008,
    z: (((index * 53) % 5) - 2) * 0.008,
  }
}

function CameraRig() {
  const { camera } = useThree()

  useEffect(() => {
    camera.lookAt(0, 0.65, 0)
    camera.updateMatrixWorld()
  }, [camera])

  return null
}

function TrajectoryPreview({
  pull,
  familyId,
}: {
  pull: VerticalSlingPull
  familyId: string
}) {
  if (pull.power <= 0.02) return null

  const launch = launchFromRealScalePull(pull)
  const profile = realSlammerProfile(familyId)
  const start = {
    x: ANCHOR.x + pull.x,
    y: ANCHOR.y + pull.y,
    z: ANCHOR.z + pull.z,
  }

  const points = predictBallisticPath(
    start,
    launch.velocityCmPerSec,
    REAL_WORLD.gravityCmPerSec2,
    STACK_TOP_Y + profile.thicknessCm / 2,
    0.012,
    0.32,
  )

  const impact = predictImpactPoint(
    start,
    launch.velocityCmPerSec,
    REAL_WORLD.gravityCmPerSec2,
    STACK_TOP_Y + profile.thicknessCm / 2,
  )

  return (
    <>
      {points.slice(1).map((point, index) => (
        <mesh key={index} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial
            color="#f3ff72"
            transparent
            opacity={Math.max(0.16, 0.75 - index * 0.045)}
          />
        </mesh>
      ))}

      {impact && (
        <mesh
          position={[impact.x, 0.018, impact.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.38, 0.52, 32]} />
          <meshBasicMaterial
            color={pull.power > 0.82 ? '#ff765f' : '#73e2c5'}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </>
  )
}

interface Result {
  flips: string[]
  speedMps: number
  lateralFraction: number
  releaseToImpactMs: number | null
  releaseToResolveMs: number
  scatterRadiusCm: number
}

function VerticalSlingScene({
  onResult,
}: {
  onResult: (result: Result) => void
}) {
  const { camera, gl } = useThree()
  const slammer = useMemo(() => rollSlammer('vertical-real-scale', 4), [])
  const profile = realSlammerProfile(slammer.familyId)

  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const dragOrigin = useRef<Vector3 | null>(null)
  const cameraForward = useRef(new Vector3())
  const phaseRef = useRef<'ready' | 'flight' | 'result'>('ready')
  const releasedAt = useRef<number | null>(null)
  const impactAt = useRef<number | null>(null)
  const stableFrames = useRef(0)
  const activeLaunch = useRef<ReturnType<typeof launchFromRealScalePull> | null>(null)

  const [phase, setPhase] = useState<'ready' | 'flight' | 'result'>('ready')
  const [pull, setPull] = useState<VerticalSlingPull>(EMPTY_PULL)
  const [active, setActive] = useState<Set<string>>(new Set())

  const setPhaseBoth = (next: 'ready' | 'flight' | 'result') => {
    phaseRef.current = next
    setPhase(next)
  }

  const reset = () => {
    for (let index = 0; index < POG_COUNT; index += 1) {
      const body = pogBodies.current[index]
      if (!body) continue
      const offset = stackOffset(index)

      body.setTranslation(
        {
          x: offset.x,
          y: STACK_BASE_Y + index * STACK_SPACING,
          z: offset.z,
        },
        true,
      )
      body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setLinearDamping(0.035)
      body.setAngularDamping(0.045)
    }

    const body = slammerBody.current
    if (body) {
      body.setBodyType(RigidBodyType.KinematicPositionBased, true)
      body.setTranslation(ANCHOR, true)
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    dragOrigin.current = null
    releasedAt.current = null
    impactAt.current = null
    activeLaunch.current = null
    stableFrames.current = 0
    setPull(EMPTY_PULL)
    setActive(new Set())
    setPhaseBoth('ready')
  }

  const resolve = () => {
    const releaseTime = releasedAt.current
    const launch = activeLaunch.current
    if (releaseTime === null || !launch) return

    const flips = pogBodies.current.flatMap((body, index) =>
      body &&
      isFaceUpRotation(body.rotation(), REAL_POG.faceUpThreshold)
        ? [STARTER_STACK[index]]
        : [],
    )

    const scatterRadiusCm = Math.max(
      0,
      ...pogBodies.current.map((body) => {
        if (!body) return 0
        const p = body.translation()
        return Math.hypot(p.x, p.z)
      }),
    )

    const now = performance.now()
    setActive(new Set(flips))
    setPhaseBoth('result')

    onResult({
      flips,
      speedMps: launch.speedMps,
      lateralFraction: launch.lateralFraction,
      releaseToImpactMs:
        impactAt.current === null ? null : impactAt.current - releaseTime,
      releaseToResolveMs: now - releaseTime,
      scatterRadiusCm,
    })

    window.setTimeout(reset, 300)
  }

  useFrame(() => {
    const body = slammerBody.current
    if (!body) return

    if (phaseRef.current === 'ready') {
      body.setNextKinematicTranslation({
        x: ANCHOR.x + pull.x,
        y: ANCHOR.y + pull.y,
        z: ANCHOR.z + pull.z,
      })
      body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 })
      return
    }

    if (phaseRef.current !== 'flight' || releasedAt.current === null) return

    const now = performance.now()
    const elapsed = now - releasedAt.current

    if (impactAt.current !== null && now - impactAt.current > 500) {
      for (const pog of pogBodies.current) {
        if (!pog) continue
        pog.setLinearDamping(0.45)
        pog.setAngularDamping(0.6)
      }
    }

    if (impactAt.current !== null && now - impactAt.current > 250) {
      const stable = pogBodies.current.every((pog) => {
        if (!pog) return true
        return vecLength(pog.linvel()) < 8 && vecLength(pog.angvel()) < 2
      })

      stableFrames.current = stable ? stableFrames.current + 1 : 0
      if (stableFrames.current >= 8) {
        resolve()
        return
      }
    }

    if (elapsed >= MAX_RESOLVE_MS) resolve()
  })

  const bind = useDrag(
    ({ first, down, last, xy: [clientX, clientY] }) => {
      if (phaseRef.current !== 'ready') return

      const forward = camera.getWorldDirection(cameraForward.current)
      const horizontalLength = Math.hypot(forward.x, forward.z)
      const planeNormal =
        horizontalLength > 0.000001
          ? {
              x: forward.x / horizontalLength,
              y: 0,
              z: forward.z / horizontalLength,
            }
          : { x: 0, y: 0, z: -1 }

      const projected = projectClientPointToPlane(
        camera,
        clientX,
        clientY,
        gl.domElement.getBoundingClientRect(),
        ANCHOR,
        planeNormal,
      )

      if (first) dragOrigin.current = projected

      const origin = dragOrigin.current
      if (!projected || !origin) return

      const nextPull = constrainVerticalPull(
        projected.x - origin.x,
        projected.y - origin.y,
        projected.z - origin.z,
        PULL_CONFIG,
      )

      setPull(nextPull)

      if (!down && last) {
        dragOrigin.current = null
        if (
          nextPull.y < PULL_CONFIG.minVerticalPull ||
          !slammerBody.current
        ) {
          setPull(EMPTY_PULL)
          return
        }

        const launch = launchFromRealScalePull(nextPull)
        const body = slammerBody.current

        body.setTranslation(
          {
            x: ANCHOR.x + nextPull.x,
            y: ANCHOR.y + nextPull.y,
            z: ANCHOR.z + nextPull.z,
          },
          true,
        )
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        body.setBodyType(RigidBodyType.Dynamic, true)
        body.setLinvel(launch.velocityCmPerSec, true)
        body.setAngvel(
          { x: 0, y: profile.spinRadPerSec, z: 0 },
          true,
        )

        activeLaunch.current = launch
        releasedAt.current = performance.now()
        impactAt.current = null
        stableFrames.current = 0
        setActive(new Set())
        setPhaseBoth('flight')
      }
    },
    {
      filterTaps: true,
      threshold: 3,
      pointer: { capture: true },
    },
  )

  return (
    <>
      <CameraRig />
      <ambientLight intensity={1.15} />
      <directionalLight position={[10, 26, 14]} intensity={3.5} castShadow />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[
            REAL_WORLD.tableHalfSizeCm,
            REAL_WORLD.tableHalfHeightCm,
            REAL_WORLD.tableHalfSizeCm,
          ]}
          position={[0, -REAL_WORLD.tableHalfHeightCm, 0]}
          friction={REAL_POG.tableFriction}
          frictionCombineRule={CoefficientCombineRule.Min}
          restitution={REAL_POG.tableRestitution}
          restitutionCombineRule={CoefficientCombineRule.Max}
        />
        <mesh position={[0, -REAL_WORLD.tableHalfHeightCm, 0]} receiveShadow>
          <boxGeometry args={[30, 0.7, 30]} />
          <meshStandardMaterial color="#33291f" roughness={0.92} />
        </mesh>
      </RigidBody>

      {STARTER_STACK.map((id, index) => {
        const pog = pogById(id)
        const offset = stackOffset(index)

        return (
          <RigidBody
            key={id}
            name={'pog:' + id}
            ref={(body) => {
              pogBodies.current[index] = body
            }}
            colliders={false}
            linearDamping={0.035}
            angularDamping={0.045}
            additionalSolverIterations={3}
            position={[
              offset.x,
              STACK_BASE_Y + index * STACK_SPACING,
              offset.z,
            ]}
            rotation={[Math.PI, 0, index * 0.11]}
          >
            <RoundCylinderCollider
              args={[
                REAL_POG.thicknessCm / 2 - REAL_POG.edgeRadiusCm,
                REAL_POG.radiusCm - REAL_POG.edgeRadiusCm,
                REAL_POG.edgeRadiusCm,
              ]}
              mass={REAL_POG.massKg}
              friction={REAL_POG.capFriction}
              frictionCombineRule={CoefficientCombineRule.Min}
              restitution={REAL_POG.capRestitution}
              restitutionCombineRule={CoefficientCombineRule.Max}
              contactSkin={0.003}
            />

            <mesh castShadow receiveShadow>
              <cylinderGeometry
                args={[
                  REAL_POG.radiusCm,
                  REAL_POG.radiusCm,
                  REAL_POG.thicknessCm,
                  48,
                ]}
              />
              <meshStandardMaterial
                color={index % 2 ? '#d84738' : '#d6c894'}
                roughness={0.7}
                emissive={active.has(id) ? '#9ca53a' : '#000000'}
                emissiveIntensity={active.has(id) ? 0.85 : 0}
              />
            </mesh>

            <PogFace
              pog={pog}
              radius={REAL_POG.radiusCm}
              thickness={REAL_POG.thicknessCm}
            />
          </RigidBody>
        )
      })}

      <RigidBody
        name="slammer"
        type="kinematicPosition"
        ref={slammerBody}
        colliders={false}
        ccd
        softCcdPrediction={0.35}
        additionalSolverIterations={6}
        linearDamping={0.01}
        angularDamping={0.04}
        position={[ANCHOR.x, ANCHOR.y, ANCHOR.z]}
        onCollisionEnter={({ other }) => {
          if (
            phaseRef.current !== 'flight' ||
            impactAt.current !== null
          ) return

          const otherName = other.rigidBodyObject?.name ?? ''
          if (!otherName.startsWith('pog:')) return
          impactAt.current = performance.now()
        }}
      >
        <CylinderCollider
          args={[profile.thicknessCm / 2, profile.radiusCm]}
          mass={profile.massKg}
          friction={REAL_POG.slammerFriction}
          frictionCombineRule={CoefficientCombineRule.Max}
          restitution={REAL_POG.slammerRestitution}
          restitutionCombineRule={CoefficientCombineRule.Max}
        />

        <group {...bind()} scale={phase === 'ready' ? 1.04 : 1}>
          <mesh castShadow>
            <cylinderGeometry
              args={[
                profile.radiusCm,
                profile.radiusCm,
                profile.thicknessCm,
                48,
              ]}
            />
            <meshStandardMaterial
              color="#aeb7bd"
              metalness={0.92}
              roughness={0.18}
              emissive={pull.power > 0.82 ? '#3d180f' : '#000000'}
              emissiveIntensity={pull.power > 0.82 ? 0.7 : 0}
            />
          </mesh>
        </group>
      </RigidBody>

      {phase === 'ready' && pull.power > 0.02 && (
        <>
          <TrajectoryPreview pull={pull} familyId={slammer.familyId} />

          <mesh
            position={[0, 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.38, 0.52, 32]} />
            <meshBasicMaterial color="#f3ff72" transparent opacity={0.4} />
          </mesh>
        </>
      )}
    </>
  )
}

export function VerticalSlingLab() {
  const [last, setLast] = useState<Result | null>(null)

  return (
    <main className="slam-lab">
      <section className="slam-lab-sidebar">
        <p className="eyebrow">EXPERIMENT / REAL-SCALE VERTICAL SLING</p>
        <h1>41 mm POG physics.</h1>
        <p className="lab-copy">
          This scene now uses centimeter-scale POG dimensions, gram-scale cap
          mass, real gravity, and the launch envelope selected by the headless
          Rapier matrix. Pull upward to set speed; horizontal bias controls how
          far off-center the slammer crosses the stack.
        </p>

        <section className="slam-metrics">
          <div>
            <span>LAST FLIPS</span>
            <strong>{last?.flips.length ?? '—'}</strong>
          </div>
          <div>
            <span>SPEED</span>
            <strong>{last ? last.speedMps.toFixed(2) + 'm/s' : '—'}</strong>
          </div>
          <div>
            <span>LATERAL</span>
            <strong>
              {last ? Math.round(last.lateralFraction * 100) + '%' : '—'}
            </strong>
          </div>
          <div>
            <span>TO IMPACT</span>
            <strong>
              {last?.releaseToImpactMs == null
                ? '—'
                : Math.round(last.releaseToImpactMs) + 'ms'}
            </strong>
          </div>
          <div>
            <span>TO RESULT</span>
            <strong>
              {last ? Math.round(last.releaseToResolveMs) + 'ms' : '—'}
            </strong>
          </div>
          <div>
            <span>SCATTER</span>
            <strong>
              {last ? last.scatterRadiusCm.toFixed(1) + 'cm' : '—'}
            </strong>
          </div>
        </section>

        <p className="lab-copy">
          The current target zone from the 16-seed validation is roughly
          3.25–4.0 m/s with ~24–32% lateral impact: about 2–3 flips without
          turning every slam into an eight-POG explosion.
        </p>

        <a className="binder-shortcut" href={appHref('/')}>
          BACK TO CURRENT GAME
        </a>
      </section>

      <section className="lab-canvas">
        <Canvas
          shadows
          camera={{
            position: [0, 26.4, 29.2],
            fov: 34,
            near: 0.1,
            far: 120,
          }}
          dpr={[1, 1.75]}
          style={{ touchAction: 'none' }}
        >
          <color attach="background" args={['#11100f']} />
          <fog attach="fog" args={['#11100f', 36, 78]} />

          <Physics
            gravity={[0, REAL_WORLD.gravityCmPerSec2, 0]}
            lengthUnit={REAL_WORLD.unitsPerMeter}
            timeStep={REAL_WORLD.timestep}
            numSolverIterations={REAL_WORLD.solverIterations}
            maxCcdSubsteps={REAL_WORLD.ccdSubsteps}
          >
            <VerticalSlingScene onResult={setLast} />
          </Physics>
        </Canvas>
      </section>
    </main>
  )
}
