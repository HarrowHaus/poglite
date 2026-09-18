import { useDrag } from '@use-gesture/react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { PogFace } from './PogFace'
import { pogById, slammerFamilyById } from '../game/content'
import {
  DEFAULT_SLAM_TUNING,
  isFaceUpRotation,
  type SlamTuning,
} from '../game/slamPhysics'
import {
  pullFromMovement,
  slammerImpulse,
  type PullVector,
} from '../game/slamGesture'
import { unlockFeedbackAudio } from '../presentation/audio'
import { emitFeedback } from '../presentation/events'
import { normalizeImpactForce } from '../presentation/feedbackMath'
import type { GeneratedSlammer } from '../game/types'

interface SlamSceneProps {
  pogIds: string[]
  slammer: GeneratedSlammer
  tuning?: Partial<SlamTuning>
  debugPhysics?: boolean
  disabled?: boolean
  onResolved: (flippedPogIds: string[]) => void
}

const POG_RADIUS = 0.58
const POG_THICKNESS = 0.07

// Camera is deliberately 30% farther from the table than the initial physics demo.
const CAMERA_Y = 7.41
const CAMERA_Z = 8.19
const SLAMMER_ANCHOR = { x: 0, y: 1.35, z: 1.8 }
const EMPTY_PULL: PullVector = { x: 0, z: 0, power: 0 }

function CameraFeedback({ impact }: { impact: MutableRefObject<number> }) {
  const { camera } = useThree()

  useFrame(({ clock }, delta) => {
    impact.current = Math.max(0, impact.current - delta * 3.8)
    const kick = impact.current
    const t = clock.elapsedTime

    camera.position.set(
      Math.sin(t * 103) * kick * 0.065,
      CAMERA_Y + Math.cos(t * 89) * kick * 0.045,
      CAMERA_Z + kick * 0.16,
    )
    camera.lookAt(0, 0.12, 0)
  })

  return null
}

function Table() {
  return (
    <RigidBody
      name="table"
      type="fixed"
      colliders="cuboid"
      friction={0.95}
      restitution={0.05}
    >
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[7.5, 0.4, 7.5]} />
        <meshStandardMaterial color="#33291f" roughness={0.92} />
      </mesh>
    </RigidBody>
  )
}

function PogDisc({
  id,
  index,
  bodyRef,
  tuning,
  active,
}: {
  id: string
  index: number
  bodyRef: (body: RapierRigidBody | null) => void
  tuning: SlamTuning
  active: boolean
}) {
  const pog = pogById(id)
  const spacing = POG_THICKNESS + tuning.stackGap

  return (
    <RigidBody
      name={'pog:' + id}
      ref={bodyRef}
      colliders="hull"
      friction={tuning.pogFriction}
      restitution={tuning.pogRestitution}
      linearDamping={tuning.pogLinearDamping}
      angularDamping={tuning.pogAngularDamping}
      position={[0, 0.04 + index * spacing, 0]}
      rotation={[Math.PI, 0, index * 0.09]}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[POG_RADIUS, POG_RADIUS, POG_THICKNESS, 40]} />
        <meshStandardMaterial
          color={index % 2 ? '#d84738' : '#d6c894'}
          roughness={0.7}
          emissive={active ? '#9ca53a' : '#000000'}
          emissiveIntensity={active ? 0.85 : 0}
        />
      </mesh>

      <PogFace pog={pog} />

      {active && (
        <mesh position={[0, POG_THICKNESS / 2 + 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.515, 0.565, 48]} />
          <meshBasicMaterial color="#f3ff72" toneMapped={false} />
        </mesh>
      )}
    </RigidBody>
  )
}

function PogStack({
  ids,
  bodies,
  tuning,
  activeIds,
}: {
  ids: string[]
  bodies: MutableRefObject<Array<RapierRigidBody | null>>
  tuning: SlamTuning
  activeIds: Set<string>
}) {
  return (
    <>
      {ids.map((id, index) => (
        <PogDisc
          key={id}
          id={id}
          index={index}
          tuning={tuning}
          active={activeIds.has(id)}
          bodyRef={(body) => {
            bodies.current[index] = body
          }}
        />
      ))}
    </>
  )
}

function PullTether({ pull }: { pull: PullVector }) {
  const length = Math.hypot(pull.x, pull.z)
  if (length <= 0.02) return null

  const midpointX = SLAMMER_ANCHOR.x + pull.x / 2
  const midpointZ = SLAMMER_ANCHOR.z + pull.z / 2
  const angle = Math.atan2(pull.x, pull.z)

  return (
    <>
      <mesh
        position={[midpointX, SLAMMER_ANCHOR.y, midpointZ]}
        rotation={[0, angle, 0]}
      >
        <boxGeometry args={[0.045, 0.045, length]} />
        <meshBasicMaterial
          color={pull.power > 0.82 ? '#ff765f' : '#f3ff72'}
          transparent
          opacity={0.78}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[SLAMMER_ANCHOR.x, 0.018, SLAMMER_ANCHOR.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.22, 0.28, 32]} />
        <meshBasicMaterial color="#f3ff72" transparent opacity={0.45} />
      </mesh>
    </>
  )
}

function Playfield({
  pogIds,
  slammer,
  tuning: tuningOverrides,
  disabled = false,
  onResolved,
}: SlamSceneProps) {
  const tuning = useMemo(
    () => ({ ...DEFAULT_SLAM_TUNING, ...tuningOverrides }),
    [tuningOverrides],
  )
  const family = slammerFamilyById(slammer.familyId)
  const slammerBody = useRef<RapierRigidBody>(null)
  const pogBodies = useRef<Array<RapierRigidBody | null>>([])
  const cameraImpact = useRef(0)
  const impactSent = useRef(false)
  const [pull, setPull] = useState<PullVector>(EMPTY_PULL)
  const [phase, setPhase] = useState<'ready' | 'slamming' | 'resolving'>('ready')
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())
  const settleTimer = useRef<number | undefined>(undefined)
  const resetTimer = useRef<number | undefined>(undefined)
  const { size, viewport } = useThree()

  const restPositions = useMemo(() => {
    const spacing = POG_THICKNESS + tuning.stackGap
    return pogIds.map((_, index) => ({ x: 0, y: 0.04 + index * spacing, z: 0 }))
  }, [pogIds, tuning.stackGap])

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    },
    [],
  )

  useFrame(() => {
    if (phase !== 'ready' || !slammerBody.current) return

    slammerBody.current.setTranslation(
      {
        x: SLAMMER_ANCHOR.x + pull.x,
        y: SLAMMER_ANCHOR.y,
        z: SLAMMER_ANCHOR.z + pull.z,
      },
      true,
    )
    slammerBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    slammerBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
  })

  const resetStack = () => {
    pogBodies.current.forEach((body, index) => {
      if (!body) return
      body.setTranslation(restPositions[index], true)
      body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })

    if (slammerBody.current) {
      slammerBody.current.setTranslation(SLAMMER_ANCHOR, true)
      slammerBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      slammerBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    setPull(EMPTY_PULL)
    setActiveIds(new Set())
    impactSent.current = false
    setPhase('ready')
  }

  const resolveAfterSlam = () => {
    settleTimer.current = window.setTimeout(() => {
      setPhase('resolving')
      const flipped = pogBodies.current.flatMap((body, index) =>
        body && isFaceUpRotation(body.rotation(), tuning.faceUpThreshold)
          ? [pogIds[index]]
          : [],
      )

      setActiveIds(new Set(flipped))
      emitFeedback({ type: 'slam:resolved', flips: flipped.length })
      onResolved(flipped)
      resetTimer.current = window.setTimeout(resetStack, 1150)
    }, tuning.settleMs)
  }

  const launch = (releasePull: PullVector) => {
    if (disabled || phase !== 'ready' || !slammerBody.current) return

    const impulse = slammerImpulse(
      releasePull,
      family.physics.slamImpulse * tuning.impulseMultiplier,
    )
    if (!impulse) {
      setPull(EMPTY_PULL)
      return
    }

    unlockFeedbackAudio()
    emitFeedback({ type: 'slam:start' })
    impactSent.current = false
    setActiveIds(new Set())
    setPhase('slamming')

    slammerBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    slammerBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
    slammerBody.current.applyImpulse(impulse, true)
    slammerBody.current.applyTorqueImpulse(
      {
        x: releasePull.z * 0.45,
        y: 0.35 + releasePull.power * 0.75,
        z: -releasePull.x * 0.45,
      },
      true,
    )

    resolveAfterSlam()
  }

  const bind = useDrag(
    ({ down, last, movement: [movementX, movementY], first }) => {
      if (disabled || phase !== 'ready') return

      if (first) unlockFeedbackAudio()

      const nextPull = pullFromMovement(
        movementX,
        movementY,
        viewport.width / size.width,
        viewport.height / size.height,
      )

      setPull(nextPull)

      if (!down && last) launch(nextPull)
    },
    {
      enabled: !disabled && phase === 'ready',
      filterTaps: true,
      threshold: 3,
      pointer: { capture: true },
    },
  )

  return (
    <>
      <CameraFeedback impact={cameraImpact} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 7, 4]} intensity={3.4} castShadow />
      <pointLight position={[-3, 2.5, -2]} intensity={1.1} color="#73e2c5" />

      <Table />
      <PogStack ids={pogIds} bodies={pogBodies} tuning={tuning} activeIds={activeIds} />
      {phase === 'ready' && <PullTether pull={pull} />}

      <RigidBody
        name="slammer"
        ref={slammerBody}
        colliders="hull"
        mass={family.physics.mass}
        friction={tuning.slammerFriction}
        restitution={tuning.slammerRestitution}
        linearDamping={0.22}
        angularDamping={0.18}
        position={[SLAMMER_ANCHOR.x, SLAMMER_ANCHOR.y, SLAMMER_ANCHOR.z]}
        onContactForce={(event) => {
          if (phase !== 'slamming' || impactSent.current) return
          const otherName = event.other.rigidBodyObject?.name ?? ''
          if (!otherName.startsWith('pog:')) return

          const strength = normalizeImpactForce(event.totalForceMagnitude)
          if (strength < 0.12) return

          impactSent.current = true
          cameraImpact.current = Math.max(cameraImpact.current, strength)
          emitFeedback({ type: 'slam:impact', strength })
        }}
      >
        <group {...bind()} scale={phase === 'ready' ? 1.05 : 1}>
          <mesh castShadow>
            <cylinderGeometry
              args={[family.physics.radius, family.physics.radius, family.physics.thickness, 48]}
            />
            <meshStandardMaterial
              color="#aeb7bd"
              metalness={0.9}
              roughness={0.2}
              emissive={pull.power > 0.8 ? '#3d180f' : '#000000'}
              emissiveIntensity={pull.power > 0.8 ? 0.7 : 0}
            />
          </mesh>
          <mesh
            position={[0, family.physics.thickness / 2 + 0.004, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[family.physics.radius * 0.45, family.physics.radius * 0.78, 48]} />
            <meshStandardMaterial color="#20252a" metalness={0.82} roughness={0.3} />
          </mesh>
        </group>
      </RigidBody>
    </>
  )
}

export function SlamScene({ debugPhysics = false, ...props }: SlamSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, CAMERA_Y, CAMERA_Z], fov: 34 }}
      dpr={[1, 1.75]}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#11100f']} />
      <fog attach="fog" args={['#11100f', 9, 19]} />
      <Physics debug={debugPhysics} gravity={[0, -9.81, 0]} timeStep={1 / 60}>
        <Playfield {...props} />
      </Physics>
    </Canvas>
  )
}
