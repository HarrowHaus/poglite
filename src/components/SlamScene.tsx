import { Canvas, type ThreeEvent, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { pogById, slammerFamilyById } from '../game/content'
import {
  DEFAULT_SLAM_TUNING,
  isFaceUpRotation,
  type SlamTuning,
} from '../game/slamPhysics'
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

function Table() {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.95} restitution={0.05}>
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[7.5, 0.4, 7.5]} />
        <meshStandardMaterial color="#33291f" roughness={0.92} />
      </mesh>
    </RigidBody>
  )
}

function PogStack({
  ids,
  bodies,
  tuning,
}: {
  ids: string[]
  bodies: MutableRefObject<Array<RapierRigidBody | null>>
  tuning: SlamTuning
}) {
  return (
    <>
      {ids.map((id, index) => {
        const pog = pogById(id)
        const spacing = POG_THICKNESS + tuning.stackGap
        return (
          <RigidBody
            key={id}
            ref={(body) => {
              bodies.current[index] = body
            }}
            colliders="hull"
            friction={tuning.pogFriction}
            restitution={tuning.pogRestitution}
            linearDamping={tuning.pogLinearDamping}
            angularDamping={tuning.pogAngularDamping}
            position={[0, 0.04 + index * spacing, 0]}
            rotation={[Math.PI, 0, index * 0.09]}
          >
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[POG_RADIUS, POG_RADIUS, POG_THICKNESS, 32]} />
              <meshStandardMaterial color={index % 2 ? '#e84c3d' : '#e7d7a7'} roughness={0.62} />
            </mesh>
            <mesh position={[0, POG_THICKNESS / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[POG_RADIUS * 0.78, 32]} />
              <meshBasicMaterial color={pog.rarity === 'common' ? '#1d1712' : '#5cf2cc'} />
            </mesh>
          </RigidBody>
        )
      })}
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
  const [aim, setAim] = useState({ x: 0.24, z: 0.12 })
  const [phase, setPhase] = useState<'ready' | 'slamming' | 'resolving'>('ready')
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
    setPhase('ready')
  }

  const slam = () => {
    if (disabled || phase !== 'ready' || !slammerBody.current) return
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
      onResolved(flipped)
      resetTimer.current = window.setTimeout(resetStack, 850)
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
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 7, 4]} intensity={3.4} castShadow />
      <Table />
      <PogStack ids={pogIds} bodies={pogBodies} tuning={tuning} />

      <RigidBody
        ref={slammerBody}
        colliders="hull"
        friction={tuning.slammerFriction}
        restitution={tuning.slammerRestitution}
        linearDamping={0.22}
        angularDamping={0.18}
        position={[aim.x, 2.25, aim.z]}
      >
        <mesh castShadow>
          <cylinderGeometry
            args={[family.physics.radius, family.physics.radius, family.physics.thickness, 40]}
          />
          <meshStandardMaterial color="#b7bdc2" metalness={0.82} roughness={0.28} />
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
        <meshBasicMaterial color={!disabled && phase === 'ready' ? '#f3ff72' : '#777'} />
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
