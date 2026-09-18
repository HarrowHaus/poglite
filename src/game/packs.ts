import { POGS } from './content'
import { seededRng, type Rng } from './rng'
import type { PackResult, PrintTreatment, Rarity } from './types'

const rarityWeights: Record<Rarity, number> = {
  common: 62,
  rare: 26,
  unique: 10,
  legendary: 2,
}

const printWeights: Record<PrintTreatment, number> = {
  standard: 78,
  foil: 16,
  prism: 5,
  error: 1,
}

const rarityOrder: Rarity[] = ['common', 'rare', 'unique', 'legendary']
const printOrder: PrintTreatment[] = ['standard', 'foil', 'prism', 'error']
const rarityRank: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  unique: 2,
  legendary: 3,
}

function weightedChoice<T extends string>(
  rng: Rng,
  values: T[],
  weights: Record<T, number>,
): T {
  const total = values.reduce((sum, value) => sum + weights[value], 0)
  let roll = rng.next() * total

  for (const value of values) {
    roll -= weights[value]
    if (roll <= 0) return value
  }

  return values[values.length - 1]
}

function rollRarity(rng: Rng, minimum: Rarity = 'common'): Rarity {
  const eligible = rarityOrder.filter(
    (rarity) => rarityRank[rarity] >= rarityRank[minimum],
  )
  return weightedChoice(rng, eligible, rarityWeights)
}

function rollPrint(rng: Rng): PrintTreatment {
  return weightedChoice(rng, printOrder, printWeights)
}

export function rollPack(seed: string, count = 5): PackResult {
  if (count < 1) throw new Error('Pack must contain at least one pull')

  const rng = seededRng(seed)
  const pulls = Array.from({ length: count }, (_, index) => {
    const rarity = rollRarity(rng, index === count - 1 ? 'rare' : 'common')
    const pool = POGS.filter((pog) => pog.rarity === rarity)
    const pog = pool[rng.int(0, pool.length - 1)]

    return {
      pullId: [seed, index, pog.id].join(':'),
      pogId: pog.id,
      print: rollPrint(rng),
    }
  })

  return {
    packId: seed,
    pulls,
  }
}

export function packOdds() {
  return {
    rarity: rarityWeights,
    print: printWeights,
    guaranteed: 'Last pull is Rare or better.',
  } as const
}
