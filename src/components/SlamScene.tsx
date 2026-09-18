import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
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

function CameraFeedback({ impact }: { impact: MutableRefObject<number> }) {
  const { camera } = useThree()

  useFrame(({ clock }, delta) => {
    impact.current = Math.max(0, impact.current - delta * 3.8)
    const kick = impact.current
    const t = clock.elapsedTime

    camera.position.set(
      Math.sin(t * 103) * kick * 0.055,
      5.7 + Math.cos(t * 89) * kick * 0.035,
      6.3 + kick * 0.12,
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
  const [aim, setAim] = useState({ x: 0.24, z: 0.12 })
  const [phase, setPhase] = useState<'ready' | 'slamming' | 'resolving'>('ready')
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())
  const settleTimer = useRef<number | undefined>(undefined)
  const resetTimer = useRef<number | undefined>(undefined)

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
    slammerBody.current.setTranslation({ x: aim.x, y: 2.25, z: aim.z }, true)
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

    setActiveIds(new Set())
    impactSent.current = false
    setPhase('ready')
  }

  const slam = () => {
    if (disabled || phase !== 'ready' || !slammerBody.current) return

    unlockFeedbackAudio()
    emitFeedback({ type: 'slam:start' })
    impactSent.current = false
    setActiveIds(new Set())
    setPhase('slamming')

    slammerBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
    slammerBody.current.applyImpulse(
      {
        x: 0,
        y: -family.physics.slamImpulse * tuning.impulseMultiplier,
        z: 0,
      },
      true,
    )
    slammerBody.current.applyTorqueImpulse({ x: 0.08, y: 0.15, z: -0.06 }, true)

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

  const aimFromPointer = (event: ThreeEvent<PointerEvent>) => {
    if (disabled || phase !== 'ready') return
    setAim({
      x: Math.max(-1.15, Math.min(1.15, event.point.x)),
      z: Math.max(-1.15, Math.min(1.15, event.point.z)),
    })
  }

  return (
    <>
      <CameraFeedback impact={cameraImpact} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 7, 4]} intensity={3.4} castShadow />
      <pointLight position={[-3, 2.5, -2]} intensity={1.1} color="#73e2c5" />

      <Table />
      <PogStack ids={pogIds} bodies={pogBodies} tuning={tuning} activeIds={activeIds} />

      <RigidBody
        name="slammer"
        ref={slammerBody}
        colliders="hull"
        friction={tuning.slammerFriction}
        restitution={tuning.slammerRestitution}
        linearDamping={0.22}
        angularDamping={0.18}
        position={[aim.x, 2.25, aim.z]}
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
        <mesh castShadow>
          <cylinderGeometry
            args={[family.physics.radius, family.physics.radius, family.physics.thickness, 48]}
          />
          <meshStandardMaterial
            color="#aeb7bd"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, family.physics.thickness / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[family.physics.radius * 0.45, family.physics.radius * 0.78, 48]} />
          <meshStandardMaterial color="#20252a" metalness={0.82} roughness={0.3} />
        </mesh>
      </RigidBody>

      <mesh
        position={[0, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={aimFromPointer}
        onPointerDown={(event) => {
          aimFromPointer(event)
          slam()
        }}
      >
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh position={[aim.x, 0.018, aim.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.23, 0.29, 32]} />
        <meshBasicMaterial
          color={!disabled && phase === 'ready' ? '#f3ff72' : '#777'}
          transparent
          opacity={phase === 'ready' ? 0.85 : 0.15}
        />
      </mesh>
    </>
  )
}

export function SlamScene({ debugPhysics = false, ...props }: SlamSceneProps) {
  return (
    <Canvas shadows camera={{ position: [0, 5.7, 6.3], fov: 34 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#11100f']} />
      <fog attach="fog" args={['#11100f', 7, 14]} />
      <Physics debug={debugPhysics} gravity={[0, -9.81, 0]} timeStep={1 / 60}>
        <Playfield {...props} />
      </Physics>
    </Canvas>
  )
}
