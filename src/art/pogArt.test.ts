import { describe, expect, it } from 'vitest'
import { pogArtRecipe } from './pogArt'

describe('POG art grammar', () => {
  it('is deterministic for identity and variant', () => {
    expect(pogArtRecipe('big-dog', 3)).toEqual(pogArtRecipe('big-dog', 3))
  })

  it('opens stable candidate space without random runtime art', () => {
    const candidates = Array.from({ length: 12 }, (_, variant) =>
      JSON.stringify(pogArtRecipe('big-dog', variant)),
    )

    expect(new Set(candidates).size).toBeGreaterThan(6)
  })
})
