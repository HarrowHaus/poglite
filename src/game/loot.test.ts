import { describe, expect, it } from 'vitest'
import { rollSlammer, rollSlammerBatch } from './loot'

describe('loot generation', () => {
  it('is deterministic for a seed and depth', () => {
    expect(rollSlammer('same-seed', 4)).toEqual(rollSlammer('same-seed', 4))
  })

  it('never rolls duplicate affix kinds that compete for the same slot', () => {
    const rolls = rollSlammerBatch('affix-check', 12, 500)

    for (const roll of rolls) {
      const kinds = roll.affixes.map((affix) => affix.kind)
      expect(new Set(kinds).size).toBe(kinds.length)
    }
  })
})
