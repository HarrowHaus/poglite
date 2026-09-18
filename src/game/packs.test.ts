import { describe, expect, it } from 'vitest'
import { pogById } from './content'
import { rollPack } from './packs'

const rank = {
  common: 0,
  rare: 1,
  unique: 2,
  legendary: 3,
} as const

describe('POG packs', () => {
  it('is deterministic for the same seed', () => {
    expect(rollPack('same-pack')).toEqual(rollPack('same-pack'))
  })

  it('contains five pulls and guarantees Rare or better in the last slot', () => {
    const pack = rollPack('guarantee-check')

    expect(pack.pulls).toHaveLength(5)
    const last = pogById(pack.pulls[4].pogId)
    expect(rank[last.rarity]).toBeGreaterThanOrEqual(rank.rare)
  })

  it('keeps print treatment separate from gameplay identity', () => {
    const pack = rollPack('print-separation')
    const pull = pack.pulls[0]
    const pog = pogById(pull.pogId)

    expect(pog).not.toHaveProperty('print')
    expect(['standard', 'foil', 'prism', 'error']).toContain(pull.print)
  })
})
