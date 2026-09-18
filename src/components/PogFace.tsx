import { CanvasTexture, SRGBColorSpace } from 'three'
import { useEffect, useMemo } from 'react'
import { createPogArtCanvas } from '../art/pogArt'
import type { PogDefinition } from '../game/types'

export function PogFace({ pog }: { pog: PogDefinition }) {
  const texture = useMemo(() => {
    const canvas = createPogArtCanvas(pog, 0, 256)
    const next = new CanvasTexture(canvas)
    next.colorSpace = SRGBColorSpace
    next.needsUpdate = true
    return next
  }, [pog])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.51, 48]} />
      <meshStandardMaterial map={texture} roughness={0.68} />
    </mesh>
  )
}
