import { useDrag } from '@use-gesture/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import { Vector3 } from 'three'
import { useMemo, useRef, useState } from 'react'
import { PogFace } from '../components/PogFace'
import { STARTER_STACK, pogById, slammerFamilyById } from '../game/content'
import { rollSlammer } from '../game/loot'
import { isFaceUpRotation } from '../game/slamPhysics'
import {
  constrainVerticalPull,
  verticalSlamImpulse,
  type VerticalSlingPull,
} from '../game/verticalSling'
import { appHref } from '../navigation'
import { projectClientPointToPlane } from '../presentation/pointerProjection'

const POG_RADIUS = 0.58
const POG_THICKNESS = 0.07
const STACK_SPACING = 0.075

const ANCHOR = { x: 0, y: 1.35, z: 0 }
const EMPTY_PULL: VerticalSlingPull = { x: 0, y: 0, z: 0, power: 0 }
const MIN_SETTLE_AFTER_IMPACT_MS = 260
const MAX_RESOLVE_MS = 1100

function vecLength(v: { x: number; y: number; z: number }) {
  return Math.hypot(v.x, v.y, v.z)
}

function VerticalSlingScene({
  onResult,
}: {
  onResult: (result: {
    flips: string[]
    releaseToImpactMs: number | null
    releaseToResolveMs: number
  }) => void
}) {
  const { camera, gl } = useThree()
  const slammer = useMemo(() => rollSlammer('vertical-sling-lab', 4), [])
  const family = slammerFamilyById(slammer.familyId)

  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const dragOrigin = useRef<Vector3 | null>(null)
  const cameraForward = useRef(new Vector3())
  const phaseRef = useRef<'ready' | 'flight' | 'result'>('ready')
  const releasedAt = useRef<number | null>(null)
  const impactAt = useRef<number | null>(null)
  const stableFrames = useRef(0)

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
      body.setTranslation({ x: 0, y: 0.04 + index * STACK_SPACING, z: 0 }, true)
      body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setLinearDamping(0.28)
      body.setAngularDamping(0.26)
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
    stableFrames.current = 0
    setPull(EMPTY_PULL)
    setActive(new Set())
    setPhaseBoth('ready')
  }

  const resolve = () => {
    const releaseTime = releasedAt.current
    if (releaseTime === null) return

    const flips = pogBodies.current.flatMap((body, index) =>
      body && isFaceUpRotation(body.rotation(), 0.25)
        ? [STARTER_STACK[index]]
        : [],
    )

    const now = performance.now()

    setActive(new Set(flips))
    setPhaseBoth('result')

    onResult({
      flips,
      releaseToImpactMs:
        impactAt.current === null ? null : impactAt.current - releaseTime,
      releaseToResolveMs: now - releaseTime,
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
      return
    }

    if (phaseRef.current !== 'flight' || releasedAt.current === null) return

    const now = performance.now()
    const elapsed = now - releasedAt.current

    if (impactAt.current !== null && now - impactAt.current > 300) {
      for (const pog of pogBodies.current) {
        if (!pog) continue
        pog.setLinearDamping(0.9)
        pog.setAngularDamping(1.0)
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
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        releasedAt.current = performance.now()
        impactAt.current = null
        stableFrames.current = 0
        setActive(new Set())
        setPhaseBoth('flight')

        body.applyImpulse(impulse, true)
        body.applyTorqueImpulse(
          {
            x: nextPull.z * 0.3,
            y: nextPull.x * 0.16,
            z: -nextPull.x * 0.3,
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
          friction={0.95}
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
            linearDamping={0.28}
            angularDamping={0.26}
            position={[0, 0.04 + index * STACK_SPACING, 0]}
            rotation={[Math.PI, 0, index * 0.09]}
          >
            <CylinderCollider
              args={[POG_THICKNESS / 2, POG_RADIUS]}
              friction={0.78}
              restitution={0.08}
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
        linearDamping={0.08}
        angularDamping={0.12}
        position={[ANCHOR.x, ANCHOR.y, ANCHOR.z]}
        onContactForce={(event) => {
          if (phaseRef.current !== 'flight' || impactAt.current !== null) return
          const otherName = event.other.rigidBodyObject?.name ?? ''
          if (!otherName.startsWith('pog:')) return
          impactAt.current = performance.now()
        }}
      >
        <CylinderCollider
          args={[family.physics.thickness / 2, family.physics.radius]}
          mass={family.physics.mass}
          friction={0.72}
          restitution={0.06}
        />
        <group {...bind()} scale={phase === 'ready' ? 1.08 : 1}>
          <mesh castShadow>
            <cylinderGeometry
              args={[
                family.physics.radius,
                family.physics.radius,
                family.physics.thickness,
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
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
            <VerticalSlingScene onResult={setLast} />
          </Physics>
        </Canvas>
      </section>
    </main>
  )
}
