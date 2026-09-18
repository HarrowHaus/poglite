import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { useDrag } from '@use-gesture/react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  CoefficientCombineRule,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RoundCylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import { Vector3 } from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PogFace } from '../components/PogFace'
import { STARTER_STACK, pogById } from '../game/content'
import { rollSlammer } from '../game/loot'
import { isFaceUpRotation } from '../game/slamPhysics'
import { appHref } from '../navigation'
import {
  REAL_POG,
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

const REST_Y = STACK_TOP_Y + 5.4
const MAX_HOLD_Y = STACK_TOP_Y + 10
const HAND_XZ_LIMIT = 3.2
const MIN_HAND_DOWN_SPEED = 10
const FULL_HAND_DOWN_SPEED = 65
const MIN_DYNAMIC_SPEED_MPS = 2.35
const MAX_DYNAMIC_SPEED_MPS = 4.25
const MAX_LATERAL_FRACTION = 0.32
const MAX_RESOLVE_MS = 1250

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

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

interface HandVelocity {
  x: number
  y: number
  z: number
}

interface Result {
  flips: string[]
  handSpeedCmPerSec: number
  launchSpeedMps: number
  lateralFraction: number
  releaseToImpactMs: number | null
  releaseToResolveMs: number
  scatterRadiusCm: number
}

function launchFromHandVelocity(velocity: HandVelocity) {
  const downward = Math.max(0, -velocity.y)
  const strength = clamp(
    (downward - MIN_HAND_DOWN_SPEED) /
      (FULL_HAND_DOWN_SPEED - MIN_HAND_DOWN_SPEED),
    0,
    1,
  )

  const speedMps =
    MIN_DYNAMIC_SPEED_MPS +
    (MAX_DYNAMIC_SPEED_MPS - MIN_DYNAMIC_SPEED_MPS) * strength

  const lateralSpeed = Math.hypot(velocity.x, velocity.z)
  const rawLateralFraction =
    downward > 0.001 ? lateralSpeed / downward : 0
  const lateralFraction = Math.min(
    MAX_LATERAL_FRACTION,
    rawLateralFraction,
  )

  const lateralLength = Math.hypot(velocity.x, velocity.z)
  const dirX = lateralLength > 0.001 ? velocity.x / lateralLength : 0
  const dirZ = lateralLength > 0.001 ? velocity.z / lateralLength : 0

  const speedCmPerSec = speedMps * REAL_WORLD.unitsPerMeter
  const verticalFraction = Math.sqrt(
    Math.max(0.001, 1 - lateralFraction * lateralFraction),
  )

  return {
    strength,
    speedMps,
    lateralFraction,
    velocity: {
      x: dirX * lateralFraction * speedCmPerSec,
      y: -verticalFraction * speedCmPerSec,
      z: dirZ * lateralFraction * speedCmPerSec,
    },
  }
}

function HandSlamScene({
  onResult,
  onHandSpeed,
}: {
  onResult: (result: Result) => void
  onHandSpeed: (speed: number) => void
}) {
  const { camera, gl } = useThree()
  const slammer = useMemo(() => rollSlammer('hand-slam-lab', 4), [])
  const profile = realSlammerProfile(slammer.familyId)

  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const cameraForward = useRef(new Vector3())
  const dragStartPoint = useRef<Vector3 | null>(null)
  const dragStartBody = useRef(new Vector3())
  const previousPoint = useRef<Vector3 | null>(null)
  const previousTime = useRef<number | null>(null)
  const smoothVelocity = useRef<HandVelocity>({ x: 0, y: 0, z: 0 })
  const phaseRef = useRef<'ready' | 'held' | 'flight' | 'result'>('ready')
  const releasedAt = useRef<number | null>(null)
  const impactAt = useRef<number | null>(null)
  const stableFrames = useRef(0)
  const lastLaunch = useRef<ReturnType<typeof launchFromHandVelocity> | null>(null)

  const [phase, setPhase] = useState<'ready' | 'held' | 'flight' | 'result'>('ready')
  const [heldPosition, setHeldPosition] = useState({ x: 0, y: REST_Y, z: 0 })
  const [active, setActive] = useState<Set<string>>(new Set())

  const setPhaseBoth = (next: typeof phase) => {
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
      body.setTranslation({ x: 0, y: REST_Y, z: 0 }, true)
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    dragStartPoint.current = null
    previousPoint.current = null
    previousTime.current = null
    smoothVelocity.current = { x: 0, y: 0, z: 0 }
    releasedAt.current = null
    impactAt.current = null
    lastLaunch.current = null
    stableFrames.current = 0
    setHeldPosition({ x: 0, y: REST_Y, z: 0 })
    setActive(new Set())
    onHandSpeed(0)
    setPhaseBoth('ready')
  }

  const resolve = () => {
    const releaseTime = releasedAt.current
    const launch = lastLaunch.current
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
      handSpeedCmPerSec: Math.max(0, -smoothVelocity.current.y),
      launchSpeedMps: launch.speedMps,
      lateralFraction: launch.lateralFraction,
      releaseToImpactMs:
        impactAt.current === null ? null : impactAt.current - releaseTime,
      releaseToResolveMs: now - releaseTime,
      scatterRadiusCm,
    })

    window.setTimeout(reset, 300)
  }

  useEffect(() => {
    if (phase !== 'flight' || releasedAt.current === null) return

    let frame = 0
    const tick = () => {
      const now = performance.now()
      const elapsed = now - (releasedAt.current ?? now)

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

      if (elapsed >= MAX_RESOLVE_MS) {
        resolve()
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  const releaseToPhysics = (position: { x: number; y: number; z: number }) => {
    const body = slammerBody.current
    if (!body) return false

    const launch = launchFromHandVelocity(smoothVelocity.current)
    if (launch.strength <= 0.02) return false

    body.setTranslation(position, true)
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    body.setBodyType(RigidBodyType.Dynamic, true)
    body.setLinvel(launch.velocity, true)

    const lateralSign =
      Math.abs(smoothVelocity.current.x) > Math.abs(smoothVelocity.current.z)
        ? Math.sign(smoothVelocity.current.x)
        : Math.sign(smoothVelocity.current.z)

    body.setAngvel(
      {
        x: 0,
        y: lateralSign * launch.strength * 12,
        z: 0,
      },
      true,
    )

    releasedAt.current = performance.now()
    impactAt.current = null
    lastLaunch.current = launch
    stableFrames.current = 0
    setActive(new Set())
    onHandSpeed(Math.max(0, -smoothVelocity.current.y))
    setPhaseBoth('flight')
    return true
  }

  const bind = useDrag(
    ({ first, down, last, xy: [clientX, clientY] }) => {
      if (
        phaseRef.current !== 'ready' &&
        phaseRef.current !== 'held'
      ) return

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
        { x: 0, y: REST_Y, z: 0 },
        planeNormal,
      )

      if (!projected) return

      const now = performance.now()

      if (first) {
        phaseRef.current = 'held'
        setPhase('held')
        dragStartPoint.current = projected.clone()
        const current = slammerBody.current?.translation()
        dragStartBody.current.set(
          current?.x ?? 0,
          current?.y ?? REST_Y,
          current?.z ?? 0,
        )
        previousPoint.current = projected.clone()
        previousTime.current = now
        smoothVelocity.current = { x: 0, y: 0, z: 0 }
        onHandSpeed(0)
      }

      const startPoint = dragStartPoint.current
      if (!startPoint) return

      const desired = {
        x: clamp(
          dragStartBody.current.x + projected.x - startPoint.x,
          -HAND_XZ_LIMIT,
          HAND_XZ_LIMIT,
        ),
        y: clamp(
          dragStartBody.current.y + projected.y - startPoint.y,
          STACK_TOP_Y + profile.thicknessCm / 2 + 0.8,
          MAX_HOLD_Y,
        ),
        z: clamp(
          dragStartBody.current.z + projected.z - startPoint.z,
          -HAND_XZ_LIMIT,
          HAND_XZ_LIMIT,
        ),
      }

      const previous = previousPoint.current
      const previousAt = previousTime.current
      if (previous && previousAt !== null) {
        const dt = Math.max(1 / 240, (now - previousAt) / 1000)
        const instant = {
          x: (projected.x - previous.x) / dt,
          y: (projected.y - previous.y) / dt,
          z: (projected.z - previous.z) / dt,
        }

        const smoothing = 0.38
        smoothVelocity.current = {
          x:
            smoothVelocity.current.x * (1 - smoothing) +
            instant.x * smoothing,
          y:
            smoothVelocity.current.y * (1 - smoothing) +
            instant.y * smoothing,
          z:
            smoothVelocity.current.z * (1 - smoothing) +
            instant.z * smoothing,
        }
      }

      previousPoint.current = projected.clone()
      previousTime.current = now

      setHeldPosition(desired)
      onHandSpeed(Math.max(0, -smoothVelocity.current.y))

      const body = slammerBody.current
      if (body) {
        body.setNextKinematicTranslation(desired)
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 })
      }

      const releaseGateY =
        STACK_TOP_Y + profile.thicknessCm / 2 + 1.4
      const slamming =
        smoothVelocity.current.y < -MIN_HAND_DOWN_SPEED &&
        desired.y <= releaseGateY

      if (down && slamming) {
        releaseToPhysics(desired)
        return
      }

      if (!down && last) {
        if (!releaseToPhysics(desired)) {
          body?.setNextKinematicTranslation({ x: 0, y: REST_Y, z: 0 })
          setHeldPosition({ x: 0, y: REST_Y, z: 0 })
          smoothVelocity.current = { x: 0, y: 0, z: 0 }
          onHandSpeed(0)
          setPhaseBoth('ready')
        }
      }
    },
    {
      filterTaps: true,
      threshold: 2,
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
        ref={slammerBody}
        type="kinematicPosition"
        colliders={false}
        ccd
        softCcdPrediction={0.35}
        additionalSolverIterations={6}
        linearDamping={0.01}
        angularDamping={0.04}
        position={[0, REST_Y, 0]}
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

        <group {...bind()} scale={phase === 'held' ? 1.035 : 1}>
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
              emissive={phase === 'held' ? '#302a08' : '#000000'}
              emissiveIntensity={phase === 'held' ? 0.55 : 0}
            />
          </mesh>
        </group>
      </RigidBody>

      {(phase === 'ready' || phase === 'held') && (
        <>
          <mesh
            position={[0, STACK_TOP_Y + profile.thicknessCm / 2 + 1.4, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.42, 0.55, 32]} />
            <meshBasicMaterial
              color="#f3ff72"
              transparent
              opacity={phase === 'held' ? 0.55 : 0.18}
            />
          </mesh>

          {phase === 'held' && (
            <mesh position={[heldPosition.x, heldPosition.y + 0.2, heldPosition.z]}>
              <ringGeometry args={[profile.radiusCm * 1.05, profile.radiusCm * 1.12, 48]} />
              <meshBasicMaterial color="#73e2c5" transparent opacity={0.5} />
            </mesh>
          )}
        </>
      )}
    </>
  )
}

export function HandSlamLab() {
  const [last, setLast] = useState<Result | null>(null)
  const [handSpeed, setHandSpeed] = useState(0)

  return (
    <main className="slam-lab">
      <section className="slam-lab-sidebar">
        <p className="eyebrow">EXPERIMENT / HAND SLAM</p>
        <h1>Actually slam it.</h1>
        <p className="lab-copy">
          Grab the slammer, lift it if you want, then drive it downward.
          While your finger is holding it the slammer is kinematic and stable.
          A fast downward stroke hands your measured motion to a real dynamic
          slammer just before impact, so mass and collision physics take over.
        </p>

        <section className="slam-metrics">
          <div>
            <span>HAND SPEED</span>
            <strong>{handSpeed.toFixed(0)} cm/s</strong>
          </div>
          <div>
            <span>LAST FLIPS</span>
            <strong>{last?.flips.length ?? '—'}</strong>
          </div>
          <div>
            <span>PHYSICS SPEED</span>
            <strong>{last ? last.launchSpeedMps.toFixed(2) + 'm/s' : '—'}</strong>
          </div>
          <div>
            <span>LATERAL</span>
            <strong>
              {last ? Math.round(last.lateralFraction * 100) + '%' : '—'}
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
            <strong>{last ? last.scatterRadiusCm.toFixed(1) + 'cm' : '—'}</strong>
          </div>
        </section>

        <p className="lab-copy">
          This keeps the validated real-scale POG collision envelope, but the
          player supplies the slam gesture instead of charging a slingshot.
        </p>

        <a className="binder-shortcut" href={appHref('/dev/vertical')}>
          COMPARE VERTICAL SLING
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
            <HandSlamScene onResult={setLast} onHandSpeed={setHandSpeed} />
          </Physics>
        </Canvas>
      </section>
    </main>
  )
}
