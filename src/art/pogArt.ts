import { seededRng } from '../game/rng'
import type { PogDefinition } from '../game/types'

export type PogPattern = 'burst' | 'checker' | 'rings' | 'slashes' | 'dots'

export interface PogArtRecipe {
  background: string
  ink: string
  accent: string
  secondary: string
  pattern: PogPattern
  rotation: number
  markScale: number
  offsetX: number
  offsetY: number
  borderWidth: number
}

const palettes = [
  ['#f0d66b', '#16110d', '#ef4a3f', '#62d9c3'],
  ['#86c8de', '#12171c', '#efef83', '#e64d75'],
  ['#c589dd', '#1b1120', '#6ce2bd', '#f2cf5b'],
  ['#ef7d54', '#21140e', '#f6e48a', '#4ec7c8'],
  ['#9bc86b', '#11180e', '#f05646', '#ded56c'],
  ['#ede0bd', '#171512', '#d84042', '#397f9b'],
  ['#6f81d8', '#0f1320', '#edbf4c', '#e65d90'],
  ['#d9a25f', '#1d130a', '#74ddd0', '#b44dc1'],
] as const

const patterns: PogPattern[] = ['burst', 'checker', 'rings', 'slashes', 'dots']

export function pogArtRecipe(pogId: string, variant = 0): PogArtRecipe {
  const rng = seededRng('pog-art:' + pogId + ':' + variant)
  const palette = palettes[rng.int(0, palettes.length - 1)]

  return {
    background: palette[0],
    ink: palette[1],
    accent: palette[2],
    secondary: palette[3],
    pattern: patterns[rng.int(0, patterns.length - 1)],
    rotation: (rng.next() - 0.5) * 0.2,
    markScale: 0.9 + rng.next() * 0.28,
    offsetX: (rng.next() - 0.5) * 18,
    offsetY: (rng.next() - 0.5) * 12,
    borderWidth: 12 + rng.int(0, 9),
  }
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  recipe: PogArtRecipe,
  size: number,
) {
  const c = size / 2
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = recipe.secondary
  ctx.fillStyle = recipe.secondary
  ctx.lineWidth = Math.max(2, size * 0.018)

  if (recipe.pattern === 'burst') {
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18
      ctx.beginPath()
      ctx.moveTo(c, c)
      ctx.lineTo(c + Math.cos(angle) * size, c + Math.sin(angle) * size)
      ctx.stroke()
    }
  }

  if (recipe.pattern === 'checker') {
    const step = size / 8
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * step, y * step, step, step)
      }
    }
  }

  if (recipe.pattern === 'rings') {
    for (let radius = size * 0.12; radius < size * 0.52; radius += size * 0.09) {
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (recipe.pattern === 'slashes') {
    for (let x = -size; x < size * 2; x += size * 0.11) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + size * 0.62, size)
      ctx.stroke()
    }
  }

  if (recipe.pattern === 'dots') {
    const step = size / 7
    for (let y = 1; y < 7; y += 1) {
      for (let x = 1; x < 7; x += 1) {
        ctx.beginPath()
        ctx.arc(x * step, y * step, size * 0.018, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.restore()
}

export function drawPogArt(
  ctx: CanvasRenderingContext2D,
  pog: PogDefinition,
  variant = 0,
  size = 256,
) {
  const recipe = pogArtRecipe(pog.id, variant)
  const center = size / 2

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = recipe.background
  ctx.fillRect(0, 0, size, size)
  drawPattern(ctx, recipe, size)

  ctx.strokeStyle = recipe.ink
  ctx.lineWidth = recipe.borderWidth
  ctx.beginPath()
  ctx.arc(center, center, size * 0.445, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = recipe.accent
  ctx.lineWidth = Math.max(5, recipe.borderWidth * 0.42)
  ctx.beginPath()
  ctx.arc(center, center, size * 0.365, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(center + recipe.offsetX, center + recipe.offsetY)
  ctx.rotate(recipe.rotation)
  ctx.scale(recipe.markScale, recipe.markScale)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = recipe.ink
  ctx.font = '900 ' + Math.round(size * 0.19) + 'px Arial Black, sans-serif'
  ctx.fillText(pog.face.mark, 0, -size * 0.035)

  ctx.fillStyle = recipe.accent
  ctx.font = '900 ' + Math.round(size * 0.09) + 'px Arial Black, sans-serif'
  ctx.fillText(pog.face.caption, 0, size * 0.17)
  ctx.restore()

  ctx.fillStyle = recipe.ink
  ctx.font = '900 ' + Math.round(size * 0.07) + 'px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(String(pog.power).padStart(2, '0'), center, size * 0.895)

  return recipe
}

export function createPogArtCanvas(
  pog: PogDefinition,
  variant = 0,
  size = 256,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  drawPogArt(ctx, pog, variant, size)
  return canvas
}
