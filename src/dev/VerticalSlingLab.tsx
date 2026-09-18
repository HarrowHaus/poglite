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
import { Quaternion, Vector3 } from 'three'
import { useMemo, useRef, useState } from 'react'
import { PogFace } from '../components/PogFace'
import { STARTER_STACK, pogById, slammerFamilyById } from '../game/content'
import { rollSlammer } from '../game/loot'
import { isFaceUpRotation } from '../game/slamPhysics'
import {
  constrainVerticalPull,
  predictBallisticPath,
  predictImpactPoint,
  verticalSlamImpulse,
  type VerticalSlingPull,
} from '../game/verticalSling'
import { appHref } from '../navigation'
import { projectClientPointToPlane } from '../presentation/pointerProjection'

const POG_RADIUS = 0.58
const POG_THICKNESS = 0.045
const POG_EDGE_RADIUS = 0.006
const POG_MASS = 0.08
const STACK_SPACING = 0.046
const CAP_FRICTION = 0.18
const TABLE_FRICTION = 0.30
const SLAMMER_FRICTION = 0.95
const BASE_TILT_RADIANS = 0.13
const EXTRA_TILT_RADIANS = 0.16
const FACE_UP_THRESHOLD = 0.72

const ANCHOR = { x: 0, y: 1.35, z: 0 }
const EMPTY_PULL: VerticalSlingPull = { x: 0, y: 0, z: 0, power: 0 }
const MIN_SETTLE_AFTER_IMPACT_MS = 220
const MAX_RESOLVE_MS = 980
const STACK_TOP_Y =
  0.04 + (STARTER_STACK.length - 1) * STACK_SPACING + POG_THICKNESS

function stackOffset(index: number) {
  return {
    x: ((index % 3) - 1) * 0.004,
    z: (((index * 2) % 3) - 1) * 0.004,
  }
}

function vecLength(v: { x: number; y: number; z: number }) {
  return Math.hypot(v.x, v.y, v.z)
}

function slammerTiltQuaternion(pull: VerticalSlingPull) {
  const lateral = Math.hypot(pull.x, pull.z)
  const lateralShare =
    pull.y > 0.0001 ? Math.min(1, lateral / (pull.y * 0.48)) : 0

  const dirX = lateral > 0.0001 ? pull.x / lateral : 0
  const dirZ = lateral > 0.0001 ? pull.z / lateral : 1
  const axis = new Vector3(dirZ, 0, -dirX).normalize()
  const angle = BASE_TILT_RADIANS + EXTRA_TILT_RADIANS * lateralShare

  return new Quaternion().setFromAxisAngle(axis, angle)
}

function TrajectoryPreview({
  pull,
  familyMass,
  baseImpulse,
}: {
  pull: VerticalSlingPull
  familyMass: number
  baseImpulse: number
}) {
  const impulse = verticalSlamImpulse(pull, baseImpulse)
  if (!impulse) return null

  const start = {
    x: ANCHOR.x + pull.x,
    y: ANCHOR.y + pull.y,
    z: ANCHOR.z + pull.z,
  }
  const velocity = {
    x: impulse.x / familyMass,
    y: impulse.y / familyMass,
    z: impulse.z / familyMass,
  }

  const points = predictBallisticPath(
    start,
    velocity,
    -9.81,
    STACK_TOP_Y,
    0.04,
    0.7,
  )
  const impact = predictImpactPoint(
    start,
    velocity,
    -9.81,
    STACK_TOP_Y,
  )

  return (
    <>
      {points.slice(1).map((point, index) => (
        <mesh key={index} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.026, 8, 8]} />
          <meshBasicMaterial
            color="#f3ff72"
            transparent
            opacity={Math.max(0.18, 0.8 - index * 0.055)}
          />
        </mesh>
      ))}

      {impact && (
        <mesh
          position={[impact.x, STACK_TOP_Y + 0.008, impact.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.16, 0.22, 28]} />
          <meshBasicMaterial
            color={pull.power > 0.82 ? '#ff765f' : '#73e2c5'}
            transparent
            opacity={0.82}
          />
        </mesh>
      )}
    </>
  )
}

function VerticalSlingScene({
  onResult,
}: {
  onResult: (result: {
    flips: string[]
    releaseToImpactMs: number | null
    releaseToResolveMs: number
    contactEccentricity: number | null
    contactNormalTiltDeg: number | null
    peakContactForce: number
  }) => void
}) {
  const { camera, gl } = useThree()
  const slammer = useMemo(() => rollSlammer('vertical-sling-lab', 4), [])
  const family = slammerFamilyById(slammer.familyId)
  const physicalSlammerThickness = family.physics.thickness * 1.55

  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const dragOrigin = useRef<Vector3 | null>(null)
  const cameraForward = useRef(new Vector3())
  const phaseRef = useRef<'ready' | 'flight' | 'result'>('ready')
  const releasedAt = useRef<number | null>(null)
  const impactAt = useRef<number | null>(null)
  const stableFrames = useRef(0)
  const impactPoint = useRef<{ x: number; y: number; z: number } | null>(null)
  const impactNormal = useRef<{ x: number; y: number; z: number } | null>(null)
  const peakContactForce = useRef(0)

  const [phase, setPhase] = useState<'ready' | 'flight' | 'result'>('ready')
  const [pull, setPull] = useState<VerticalSlingPull>(EMPTY_PULL)
  const [active, setActive] = useState<Set<string>>(new Set())

  const setPhaseBoth = (next: 'ready' | 'flight' | 'result') => {
    phaseRef.current = next
    setPhase(next)
  }

  const reset = () => {
    for (let index = 0; index < STARTER_STACK.length; index += 1) {
      const body = pogBodies.current[index]
      if (!body) continue
      const offset = stackOffset(index)
      body.setTranslation(
        {
          x: offset.x,
          y: 0.04 + index * STACK_SPACING,
          z: offset.z,
        },
        true,
      )
      body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setLinearDamping(0.05)
      body.setAngularDamping(0.08)
    }

    const body = slammerBody.current
    if (body) {
      body.setTranslation(ANCHOR, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    dragOrigin.current = null
    releasedAt.current = null
    impactAt.current = null
    impactPoint.current = null
    impactNormal.current = null
    peakContactForce.current = 0
    stableFrames.current = 0
    setPull(EMPTY_PULL)
    setActive(new Set())
    setPhaseBoth('ready')
  }

  const resolve = () => {
    const releaseTime = releasedAt.current
    if (releaseTime === null) return

    const flips = pogBodies.current.flatMap((body, index) =>
      body && isFaceUpRotation(body.rotation(), FACE_UP_THRESHOLD)
        ? [STARTER_STACK[index]]
        : [],
    )

    const now = performance.now()

    setActive(new Set(flips))
    setPhaseBoth('result')

    const point = impactPoint.current
    const normal = impactNormal.current
    const normalTilt =
      normal === null
        ? null
        : Math.acos(Math.min(1, Math.abs(normal.y))) * (180 / Math.PI)

    onResult({
      flips,
      releaseToImpactMs:
        impactAt.current === null ? null : impactAt.current - releaseTime,
      releaseToResolveMs: now - releaseTime,
      contactEccentricity:
        point === null ? null : Math.hypot(point.x, point.z) / POG_RADIUS,
      contactNormalTiltDeg: normalTilt,
      peakContactForce: peakContactForce.current,
    })

    window.setTimeout(reset, 320)
  }

  useFrame(() => {
    const body = slammerBody.current
    if (!body) return

    if (phaseRef.current === 'ready') {
      body.setTranslation(
        {
          x: ANCHOR.x + pull.x,
          y: ANCHOR.y + pull.y,
          z: ANCHOR.z + pull.z,
        },
        true,
      )
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setRotation(slammerTiltQuaternion(pull), true)
      return
    }

    if (phaseRef.current !== 'flight' || releasedAt.current === null) return

    const now = performance.now()
    const elapsed = now - releasedAt.current

    if (impactAt.current !== null && now - impactAt.current > 380) {
      for (const pog of pogBodies.current) {
        if (!pog) continue
        pog.setLinearDamping(0.52)
        pog.setAngularDamping(0.72)
      }
    }

    if (impactAt.current !== null && now - impactAt.current >= MIN_SETTLE_AFTER_IMPACT_MS) {
      const stable = pogBodies.current.every((pog) => {
        if (!pog) return true
        return vecLength(pog.linvel()) < 0.45 && vecLength(pog.angvel()) < 1.2
      })

      stableFrames.current = stable ? stableFrames.current + 1 : 0
      if (stableFrames.current >= 5) {
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
          ? { x: forward.x / horizontalLength, y: 0, z: forward.z / horizontalLength }
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
      )

      setPull(nextPull)

      if (!down && last) {
        dragOrigin.current = null

        const impulse = verticalSlamImpulse(
          nextPull,
          family.physics.slamImpulse,
        )

        if (!impulse || !slammerBody.current) {
          setPull(EMPTY_PULL)
          return
        }

        const body = slammerBody.current
        body.setTranslation(
          {
            x: ANCHOR.x + nextPull.x,
            y: ANCHOR.y + nextPull.y,
            z: ANCHOR.z + nextPull.z,
          },
          true,
        )
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setRotation(slammerTiltQuaternion(nextPull), true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        releasedAt.current = performance.now()
        impactAt.current = null
        stableFrames.current = 0
        setActive(new Set())
        setPhaseBoth('flight')

        body.applyImpulse(impulse, true)
        const spinDirection = nextPull.x < 0 ? -1 : 1
        body.setAngvel(
          {
            x: 0,
            y: spinDirection * (4.2 + nextPull.power * 7.2),
            z: 0,
          },
          true,
        )
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
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 7, 4]} intensity={3.5} castShadow />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[3.75, 0.2, 3.75]}
          position={[0, -0.22, 0]}
          friction={TABLE_FRICTION}
          frictionCombineRule={CoefficientCombineRule.Min}
        />
        <mesh position={[0, -0.22, 0]} receiveShadow>
          <boxGeometry args={[7.5, 0.4, 7.5]} />
          <meshStandardMaterial color="#33291f" roughness={0.92} />
        </mesh>
      </RigidBody>

      {STARTER_STACK.map((id, index) => {
        const pog = pogById(id)
        return (
          <RigidBody
            key={id}
            ref={(body) => {
              pogBodies.current[index] = body
            }}
            colliders={false}
            linearDamping={0.05}
            angularDamping={0.08}
            additionalSolverIterations={2}
            position={[
              stackOffset(index).x,
              0.04 + index * STACK_SPACING,
              stackOffset(index).z,
            ]}
            rotation={[Math.PI, 0, index * 0.11]}
          >
            <RoundCylinderCollider
              args={[
                POG_THICKNESS / 2 - POG_EDGE_RADIUS,
                POG_RADIUS - POG_EDGE_RADIUS,
                POG_EDGE_RADIUS,
              ]}
              mass={POG_MASS}
              friction={CAP_FRICTION}
              frictionCombineRule={CoefficientCombineRule.Min}
              restitution={0.03}
              restitutionCombineRule={CoefficientCombineRule.Min}
              contactSkin={0.0015}
            />
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[POG_RADIUS, POG_RADIUS, POG_THICKNESS, 40]} />
              <meshStandardMaterial
                color={index % 2 ? '#d84738' : '#d6c894'}
                roughness={0.7}
                emissive={active.has(id) ? '#9ca53a' : '#000000'}
                emissiveIntensity={active.has(id) ? 0.85 : 0}
              />
            </mesh>
            <PogFace pog={pog} />
          </RigidBody>
        )
      })}

      <RigidBody
        ref={slammerBody}
        colliders={false}
        ccd
        additionalSolverIterations={4}
        linearDamping={0.04}
        angularDamping={0.18}
        position={[ANCHOR.x, ANCHOR.y, ANCHOR.z]}
        onCollisionEnter={({ manifold, other }) => {
          if (phaseRef.current !== 'flight' || impactAt.current !== null) return
          const otherName = other.rigidBodyObject?.name ?? ''
          if (!otherName.startsWith('pog:')) return

          impactAt.current = performance.now()

          if (manifold.numSolverContacts() > 0) {
            const p = manifold.solverContactPoint(0)
            impactPoint.current = { x: p.x, y: p.y, z: p.z }
          }

          const n = manifold.normal()
          impactNormal.current = { x: n.x, y: n.y, z: n.z }
        }}
        onContactForce={(event) => {
          if (phaseRef.current !== 'flight') return
          const otherName = event.other.rigidBodyObject?.name ?? ''
          if (!otherName.startsWith('pog:')) return
          peakContactForce.current = Math.max(
            peakContactForce.current,
            event.totalForceMagnitude,
          )
        }}
      >
        <CylinderCollider
          args={[physicalSlammerThickness / 2, family.physics.radius]}
          mass={family.physics.mass}
          friction={SLAMMER_FRICTION}
          frictionCombineRule={CoefficientCombineRule.Max}
          restitution={0.09}
          restitutionCombineRule={CoefficientCombineRule.Max}
        />
        <group {...bind()} scale={phase === 'ready' ? 1.08 : 1}>
          <mesh castShadow>
            <cylinderGeometry
              args={[
                family.physics.radius,
                family.physics.radius,
                physicalSlammerThickness,
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

      {phase === 'ready' && pull.power > 0.03 && (
        <>
          <TrajectoryPreview
            pull={pull}
            familyMass={family.physics.mass}
            baseImpulse={family.physics.slamImpulse}
          />
          <mesh position={[ANCHOR.x, 0.02, ANCHOR.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.24, 0.3, 32]} />
            <meshBasicMaterial color="#f3ff72" transparent opacity={0.5} />
          </mesh>

          <mesh
            position={[
              ANCHOR.x + pull.x * 0.5,
              ANCHOR.y + pull.y * 0.5,
              ANCHOR.z + pull.z * 0.5,
            ]}
          >
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial
              color={pull.power > 0.82 ? '#ff765f' : '#f3ff72'}
            />
          </mesh>
        </>
      )}
    </>
  )
}

export function VerticalSlingLab() {
  const [last, setLast] = useState<{
    flips: string[]
    releaseToImpactMs: number | null
    releaseToResolveMs: number
    contactEccentricity: number | null
    contactNormalTiltDeg: number | null
    peakContactForce: number
  } | null>(null)

  return (
    <main className="slam-lab">
      <section className="slam-lab-sidebar">
        <p className="eyebrow">EXPERIMENT / VERTICAL SLING</p>
        <h1>Angry Birds, but down.</h1>
        <p className="lab-copy">
          The slammer sits directly over the POG stack. Pull it upward to charge.
          Release it and it becomes a normal dynamic rigid body flying downward
          through the neutral point into the stack. Left/right pull only biases
          the strike angle.
        </p>

        <section className="slam-metrics">
          <div>
            <span>LAST FLIPS</span>
            <strong>{last?.flips.length ?? '—'}</strong>
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
            <span>CONTACT OFFSET</span>
            <strong>
              {last?.contactEccentricity == null
                ? '—'
                : last.contactEccentricity.toFixed(2) + 'R'}
            </strong>
          </div>
          <div>
            <span>NORMAL TILT</span>
            <strong>
              {last?.contactNormalTiltDeg == null
                ? '—'
                : last.contactNormalTiltDeg.toFixed(1) + '°'}
            </strong>
          </div>
          <div>
            <span>PEAK FORCE</span>
            <strong>
              {last ? last.peakContactForce.toFixed(1) : '—'}
            </strong>
          </div>
        </section>

        <p className="lab-copy">
          This is real projectile physics after release — no rail, no kinematic snap,
          and no horizontal tabletop fling.
        </p>

        <a className="binder-shortcut" href={appHref('/')}>
          BACK TO CURRENT GAME
        </a>
      </section>

      <section className="lab-canvas">
        <Canvas
          shadows
          camera={{ position: [0, 7.41, 8.19], fov: 34 }}
          dpr={[1, 1.75]}
          style={{ touchAction: 'none' }}
        >
          <color attach="background" args={['#11100f']} />
          <fog attach="fog" args={['#11100f', 9, 19]} />
          <Physics
            gravity={[0, -9.81, 0]}
            timeStep={1 / 120}
            numSolverIterations={8}
          >
            <VerticalSlingScene onResult={setLast} />
          </Physics>
        </Canvas>
      </section>
    </main>
  )
}
