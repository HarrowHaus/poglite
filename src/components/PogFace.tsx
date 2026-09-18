import { CanvasTexture, SRGBColorSpace } from 'three'
import { useEffect, useMemo } from 'react'
import { createPogArtCanvas } from '../art/pogArt'
import type { PogDefinition } from '../game/types'

export function PogFace({
  pog,
  radius = 0.58,
  thickness = 0.07,
}: {
  pog: PogDefinition
  radius?: number
  thickness?: number
}) {
  const texture = useMemo(() => {
    const canvas = createPogArtCanvas(pog, 0, 256)
    const next = new CanvasTexture(canvas)
    next.colorSpace = SRGBColorSpace
    next.needsUpdate = true
    return next
  }, [pog])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      position={[0, thickness / 2 + Math.max(0.0015, thickness * 0.025), 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[radius * 0.88, 48]} />
      <meshStandardMaterial map={texture} roughness={0.68} />
    </mesh>
  )
}
