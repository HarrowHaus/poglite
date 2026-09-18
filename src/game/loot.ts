import { SLAMMER_FAMILIES } from './content'
import { seededRng, type Rng } from './rng'
import type { GeneratedSlammer, Rarity, SlammerAffix, SlammerFamily } from './types'

const rarityOrder: Rarity[] = ['common', 'rare', 'unique', 'legendary']
const rarityRank: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  unique: 2,
  legendary: 3,
}

const rarityPowerBonus: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  unique: 3,
  legendary: 5,
}

const affixCount: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  unique: 2,
  legendary: 3,
}

interface AffixCandidate {
  minRarity: Rarity
  affix: SlammerAffix
}

const AFFIX_POOL: AffixCandidate[] = [
  {
    minRarity: 'rare',
    affix: { id: 'pog-power-1', kind: 'flatPogPower', amount: 1, text: '+1 Power to flipped POGs.' },
  },
  {
    minRarity: 'unique',
    affix: { id: 'pog-power-2', kind: 'flatPogPower', amount: 2, text: '+2 Power to flipped POGs.' },
  },
  {
    minRarity: 'legendary',
    affix: { id: 'pog-power-3', kind: 'flatPogPower', amount: 3, text: '+3 Power to flipped POGs.' },
  },

  {
    minRarity: 'rare',
    affix: {
      id: 'small-pog-2',
      kind: 'lowPowerBoost',
      maxBasePower: 5,
      amount: 2,
      text: 'POGs with 5 or less base Power deal +2.',
    },
  },
  {
    minRarity: 'unique',
    affix: {
      id: 'small-pog-3',
      kind: 'lowPowerBoost',
      maxBasePower: 5,
      amount: 3,
      text: 'POGs with 5 or less base Power deal +3.',
    },
  },
  {
    minRarity: 'legendary',
    affix: {
      id: 'small-pog-wide-3',
      kind: 'lowPowerBoost',
      maxBasePower: 6,
      amount: 3,
      text: 'POGs with 6 or less base Power deal +3.',
    },
  },

  {
    minRarity: 'rare',
    affix: {
      id: 'multi-guard-4',
      kind: 'multiFlipGuard',
      minimumFlips: 3,
      amount: 4,
      text: 'Flip 3+ POGs: gain 4 Guard.',
    },
  },
  {
    minRarity: 'unique',
    affix: {
      id: 'multi-guard-6',
      kind: 'multiFlipGuard',
      minimumFlips: 3,
      amount: 6,
      text: 'Flip 3+ POGs: gain 6 Guard.',
    },
  },
  {
    minRarity: 'legendary',
    affix: {
      id: 'multi-guard-fast-6',
      kind: 'multiFlipGuard',
      minimumFlips: 2,
      amount: 6,
      text: 'Flip 2+ POGs: gain 6 Guard.',
    },
  },
]

function weightedRarity(rng: Rng, depth: number): Rarity {
  const legendary = Math.min(8, 1 + depth * 0.35)
  const unique = Math.min(22, 8 + depth * 0.8)
  const rare = Math.min(42, 26 + depth * 0.7)
  const common = Math.max(20, 100 - legendary - unique - rare)
  const weights = [common, rare, unique, legendary]
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rng.next() * total

  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return rarityOrder[i]
  }

  return 'common'
}

function chooseFamily(rng: Rng): SlammerFamily {
  return SLAMMER_FAMILIES[rng.int(0, SLAMMER_FAMILIES.length - 1)]
}

function chooseAffixes(rng: Rng, count: number, rarity: Rarity): SlammerAffix[] {
  const candidates = AFFIX_POOL
    .filter((candidate) => rarityRank[candidate.minRarity] <= rarityRank[rarity])
    .map((candidate) => candidate.affix)

  const selected: SlammerAffix[] = []

  while (selected.length < count && candidates.length > 0) {
    const index = rng.int(0, candidates.length - 1)
    const candidate = candidates.splice(index, 1)[0]

    if (selected.some((current) => current.kind === candidate.kind)) continue
    selected.push(candidate)
  }

  return selected
}

export function rollSlammer(seed: string, depth: number): GeneratedSlammer {
  const rng = seededRng(seed)
  const rarity = weightedRarity(rng, depth)
  const family = chooseFamily(rng)
  const level = Math.max(1, 1 + Math.floor(depth / 2) + rng.int(0, 2))
  const power = family.basePower + family.powerPerLevel * (level - 1) + rarityPowerBonus[rarity]
  const affixes = chooseAffixes(rng, affixCount[rarity], rarity)

  return {
    instanceId: [seed, depth, family.id, rarity].join(':'),
    familyId: family.id,
    name: family.name + ' ' + level,
    rarity,
    level,
    power,
    affixes,
  }
}

export function rollSlammerBatch(seed: string, depth: number, count: number): GeneratedSlammer[] {
  return Array.from({ length: count }, (_, index) => rollSlammer(seed + ':' + index, depth))
}
