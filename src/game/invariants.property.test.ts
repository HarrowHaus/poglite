import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { POGS, SLAMMER_FAMILIES, pogById } from './content'
import { rollSlammer } from './loot'
import { rollPack } from './packs'
import { seededRng } from './rng'
import {
  pullFromWorldDelta,
  slammerImpulse,
} from './slamGesture'

const rarityRank = {
  common: 0,
  rare: 1,
  unique: 2,
  legendary: 3,
} as const

const prints = new Set(['standard', 'foil', 'prism', 'error'])
const pogIds = new Set(POGS.map((pog) => pog.id))
const familyIds = new Set(SLAMMER_FAMILIES.map((family) => family.id))

describe('generated game invariants', () => {
  it('pure-rand wrapper stays deterministic and in range', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: 0, max: 500 }),
        (seed, min, width) => {
          const max = min + width
          const a = seededRng(seed)
          const b = seededRng(seed)

          for (let i = 0; i < 25; i += 1) {
            const aFloat = a.next()
            const bFloat = b.next()
            expect(aFloat).toBe(bFloat)
            expect(aFloat).toBeGreaterThanOrEqual(0)
            expect(aFloat).toBeLessThan(1)

            const aInt = a.int(min, max)
            const bInt = b.int(min, max)
            expect(aInt).toBe(bInt)
            expect(aInt).toBeGreaterThanOrEqual(min)
            expect(aInt).toBeLessThanOrEqual(max)
          }
        },
      ),
      { numRuns: 250 },
    )
  })

  it('every generated pack respects collection rules', () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const pack = rollPack(seed)
        expect(pack.pulls).toHaveLength(5)

        for (const pull of pack.pulls) {
          expect(pogIds.has(pull.pogId)).toBe(true)
          expect(prints.has(pull.print)).toBe(true)
        }

        const last = pogById(pack.pulls[4].pogId)
        expect(rarityRank[last.rarity]).toBeGreaterThanOrEqual(rarityRank.rare)
      }),
      { numRuns: 500 },
    )
  })

  it('every generated slammer is internally legal', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: 100 }),
        (seed, depth) => {
          const slammer = rollSlammer(seed, depth)

          expect(familyIds.has(slammer.familyId)).toBe(true)
          expect(Number.isFinite(slammer.power)).toBe(true)
          expect(slammer.power).toBeGreaterThan(0)

          const kinds = slammer.affixes.map((affix) => affix.kind)
          expect(new Set(kinds).size).toBe(kinds.length)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('world-space slingshot impulse always opposes the pull direction', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        (deltaX, deltaZ) => {
          const pull = pullFromWorldDelta(deltaX, deltaZ)

          expect(pull.power).toBeGreaterThanOrEqual(0)
          expect(pull.power).toBeLessThanOrEqual(1)

          const impulse = slammerImpulse(pull, 8)
          if (impulse) {
            const pullLength = Math.hypot(pull.x, pull.z)
            const impulseLength = Math.hypot(impulse.x, impulse.z)
            const directionDot =
              (pull.x / pullLength) * (impulse.x / impulseLength) +
              (pull.z / pullLength) * (impulse.z / impulseLength)

            expect(directionDot).toBeCloseTo(-1, 8)
          }
        },
      ),
      { numRuns: 500 },
    )
  })
})
