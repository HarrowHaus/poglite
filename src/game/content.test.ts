import { describe, expect, it } from 'vitest'
import { POGS, SLAMMER_FAMILIES, STARTER_STACK } from './content'

describe('first content set', () => {
  it('has a meaningful pool without changing the starter stack size', () => {
    expect(POGS).toHaveLength(20)
    expect(STARTER_STACK).toHaveLength(8)
    expect(SLAMMER_FAMILIES).toHaveLength(6)
  })

  it('keeps all content ids unique', () => {
    expect(new Set(POGS.map((pog) => pog.id)).size).toBe(POGS.length)
    expect(new Set(SLAMMER_FAMILIES.map((family) => family.id)).size).toBe(SLAMMER_FAMILIES.length)
  })

  it('uses only the intentionally tiny effect vocabulary', () => {
    const kinds = new Set(POGS.flatMap((pog) => (pog.effect ? [pog.effect.kind] : [])))
    expect([...kinds].sort()).toEqual(['guard', 'multiFlipDamage'])
  })
})
