import { CanvasTexture, SRGBColorSpace } from 'three'
import { useEffect, useMemo } from 'react'
import type { PogDefinition } from '../game/types'

const palette = {
  common: { background: '#e6d8ab', ink: '#191713', accent: '#cf3f34' },
  rare: { background: '#78c7d8', ink: '#0d1820', accent: '#f3fa7a' },
  unique: { background: '#bd7fe0', ink: '#17101c', accent: '#79f0cd' },
  legendary: { background: '#eecb4d', ink: '#201703', accent: '#f46e39' },
} as const

function buildTexture(pog: PogDefinition) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const colors = palette[pog.rarity]
  const center = 128

  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, 256, 256)

  ctx.strokeStyle = colors.ink
  ctx.lineWidth = 18
  ctx.beginPath()
  ctx.arc(center, center, 113, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(center, center, 92, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(center, center)
  ctx.rotate(-0.08)
  ctx.fillStyle = colors.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 48px Arial Black, sans-serif'
  ctx.fillText(pog.face.mark, 0, -10)
  ctx.font = '900 24px Arial Black, sans-serif'
  ctx.fillStyle = colors.accent
  ctx.fillText(pog.face.caption, 0, 39)
  ctx.restore()

  ctx.fillStyle = colors.ink
  ctx.font = '900 18px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(String(pog.power).padStart(2, '0'), 128, 229)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function PogFace({ pog }: { pog: PogDefinition }) {
  const texture = useMemo(() => buildTexture(pog), [pog])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.51, 48]} />
      <meshStandardMaterial map={texture} roughness={0.68} />
    </mesh>
  )
}
