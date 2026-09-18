import { useDrag } from '@use-gesture/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useMemo, useRef, useState } from 'react'
import { PogFace } from '../components/PogFace'
import { STARTER_STACK, pogById, slammerFamilyById } from '../game/content'
import { isFaceUpRotation } from '../game/slamPhysics'
import { pullFromWorldDelta, type PullVector } from '../game/slamGesture'
import { projectClientPointToHorizontalPlane } from '../presentation/pointerProjection'
import { rollSlammer } from '../game/loot'
import { appHref } from '../navigation'

const POG_RADIUS = 0.58
const POG_THICKNESS = 0.07
const STACK_SPACING = 0.075

const READY = { x: 0, y: 1.3, z: 1.25 }
const STRIKE = { x: 0, y: 0.67, z: 0 }
const MAX_PULL = 1.25
const MIN_STRIKE_MS = 115
const MAX_STRIKE_MS = 170
const MIN_CHAOS_MS = 260
const MAX_CHAOS_MS = 920

type Phase = 'ready' | 'strike' | 'chaos' | 'result'

interface Shot {
  start: { x: number; y: number; z: number }
  power: number
  startedAt: number
  strikeDurationMs: number
  chaosStartedAt: number | null
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function length3(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z)
}

function SnapScene({
  onResult,
}: {
  onResult: (result: { flips: string[]; totalMs: number }) => void
}) {
  const { camera, gl } = useThree()
  const slammer = useMemo(() => rollSlammer('snap-lab', 4), [])
  const family = slammerFamilyById(slammer.familyId)
  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const dragOrigin = useRef<{ x: number; z: number } | null>(null)
  const shot = useRef<Shot | null>(null)
  const stableFrames = useRef(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [pull, setPull] = useState<PullVector>({ x: 0, z: 0, power: 0 })
  const [active, setActive] = useState<Set<string>>(new Set())

  const reset = () => {
    STARTER_STACK.forEach((_, index) => {
      const body = pogBodies.current[index]
      if (!body) return
      body.setTranslation({ x: 0, y: 0.04 + index * STACK_SPACING, z: 0 }, true)
      body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      body.setLinearDamping(0.28)
      body.setAngularDamping(0.26)
    })

    slammerBody.current?.setNextKinematicTranslation(READY)
    stableFrames.current = 0
    dragOrigin.current = null
    shot.current = null
    setPull({ x: 0, z: 0, power: 0 })
    setActive(new Set())
    setPhase('ready')
  }

  const resolve = () => {
    const current = shot.current
    if (!current) return

    const flips = pogBodies.current.flatMap((body, index) =>
      body && isFaceUpRotation(body.rotation(), 0.25)
        ? [STARTER_STACK[index]]
        : [],
    )

    setActive(new Set(flips))
    setPhase('result')
    onResult({
      flips,
      totalMs: performance.now() - current.startedAt,
    })

    window.setTimeout(reset, 280)
  }

  useFrame(() => {
    const body = slammerBody.current
    if (!body) return

    if (phase === 'ready') {
      body.setNextKinematicTranslation({
        x: READY.x + pull.x,
        y: READY.y,
        z: READY.z + pull.z,
      })
      return
    }

    const current = shot.current
    if (!current) return
    const now = performance.now()

    if (phase === 'strike') {
      const elapsed = now - current.startedAt
      const t = Math.min(1, elapsed / current.strikeDurationMs)
      const e = smoothstep(t)

      body.setNextKinematicTranslation({
        x: current.start.x + (STRIKE.x - current.start.x) * e,
        y: current.start.y + (STRIKE.y - current.start.y) * e,
        z: current.start.z + (STRIKE.z - current.start.z) * e,
      })

      if (t >= 1) {
        current.chaosStartedAt = now
        setPhase('chaos')
      }
      return
    }

    if (phase === 'chaos') {
      // Retract visually/physically upward while the collider is a sensor.
      const chaosMs = now - (current.chaosStartedAt ?? now)
      const retractT = Math.min(1, chaosMs / 140)
      body.setNextKinematicTranslation({
        x: STRIKE.x,
        y: STRIKE.y + (READY.y - STRIKE.y) * smoothstep(retractT),
        z: STRIKE.z + (READY.z - STRIKE.z) * smoothstep(retractT),
      })

      if (chaosMs > 420) {
        for (const pog of pogBodies.current) {
          if (!pog) continue
          pog.setLinearDamping(1.0)
          pog.setAngularDamping(1.15)
        }
      }

      if (chaosMs < MIN_CHAOS_MS) return

      const stable = pogBodies.current.every((pog) => {
        if (!pog) return true
        const lv = pog.linvel()
        const av = pog.angvel()
        return (
          length3(lv.x, lv.y, lv.z) < 0.42 &&
          length3(av.x, av.y, av.z) < 1.15
        )
      })

      stableFrames.current = stable ? stableFrames.current + 1 : 0

      if (stableFrames.current >= 5 || chaosMs >= MAX_CHAOS_MS) {
        resolve()
      }
    }
  })

  const bind = useDrag(
    ({ first, down, last, xy: [clientX, clientY] }) => {
      if (phase !== 'ready') return

      const projected = projectClientPointToHorizontalPlane(
        camera,
        clientX,
        clientY,
        gl.domElement.getBoundingClientRect(),
        READY.y,
      )

      if (first) {
        dragOrigin.current = projected ? { x: projected.x, z: projected.z } : null
      }

      const origin = dragOrigin.current
      if (!projected || !origin) return

      const next = pullFromWorldDelta(
        projected.x - origin.x,
        projected.z - origin.z,
        MAX_PULL,
      )
      setPull(next)

      if (!down && last) {
        dragOrigin.current = null

        if (next.power < 0.08) {
          setPull({ x: 0, z: 0, power: 0 })
          return
        }

        const strikeDurationMs =
          MAX_STRIKE_MS - (MAX_STRIKE_MS - MIN_STRIKE_MS) * next.power

        shot.current = {
          start: {
            x: READY.x + next.x,
            y: READY.y,
            z: READY.z + next.z,
          },
          power: next.power,
          startedAt: performance.now(),
          strikeDurationMs,
          chaosStartedAt: null,
        }

        stableFrames.current = 0
        setActive(new Set())
        setPhase('strike')
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
      <pointLight position={[-3, 2.5, -2]} intensity={1.1} color="#73e2c5" />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.75, 0.2, 3.75]} position={[0, -0.22, 0]} friction={0.95} />
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
        type="kinematicPosition"
        colliders={false}
        position={[READY.x, READY.y, READY.z]}
      >
        <CylinderCollider
          args={[family.physics.thickness / 2, family.physics.radius]}
          friction={0.72}
          restitution={0.04}
          sensor={phase === 'chaos' || phase === 'result'}
        />
        <group {...bind()} scale={phase === 'ready' ? 1.07 : 1}>
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
              emissive={pull.power > 0.8 ? '#3d180f' : '#000000'}
              emissiveIntensity={pull.power > 0.8 ? 0.7 : 0}
            />
          </mesh>
        </group>
      </RigidBody>

      {phase === 'ready' && pull.power > 0.03 && (
        <mesh
          position={[
            READY.x + pull.x / 2,
            READY.y,
            READY.z + pull.z / 2,
          ]}
          rotation={[0, Math.atan2(pull.x, pull.z), 0]}
        >
          <boxGeometry args={[0.045, 0.045, Math.hypot(pull.x, pull.z)]} />
          <meshBasicMaterial
            color={pull.power > 0.82 ? '#ff765f' : '#f3ff72'}
            transparent
            opacity={0.78}
          />
        </mesh>
      )}
    </>
  )
}

export function SnapSlamLab() {
  const [last, setLast] = useState<{ flips: string[]; totalMs: number } | null>(null)

  return (
    <main className="slam-lab">
      <section className="slam-lab-sidebar">
        <p className="eyebrow">EXPERIMENT / SNAP SLAM</p>
        <h1>Strike, don't throw.</h1>
        <p className="lab-copy">
          Pull the slammer back and release. The slammer is guided into the stack
          almost immediately; Rapier only owns the impact and cap chaos.
        </p>
        <section className="slam-metrics">
          <div>
            <span>LAST FLIPS</span>
            <strong>{last?.flips.length ?? '—'}</strong>
          </div>
          <div>
            <span>RELEASE → RESOLVE</span>
            <strong>{last ? Math.round(last.totalMs) + 'ms' : '—'}</strong>
          </div>
        </section>
        <p className="lab-copy">
          Target: under ~1 second from release to readable result. No projectile miss
          phase, no fixed 1.65 second wait.
        </p>
        <a className="binder-shortcut" href={appHref('/')}>BACK TO CURRENT GAME</a>
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
            <SnapScene onResult={setLast} />
          </Physics>
        </Canvas>
      </section>
    </main>
  )
}
