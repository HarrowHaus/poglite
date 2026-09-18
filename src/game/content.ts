import { z } from 'zod'
import type { EnemyDefinition, PogDefinition, SlammerFamily } from './types'

const raritySchema = z.enum(['common', 'rare', 'unique', 'legendary'])

const pogSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: raritySchema,
  power: z.number().int().nonnegative(),
  effect: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('guard'), amount: z.number().int().positive() }),
      z.object({
        kind: z.literal('multiFlipDamage'),
        minimumFlips: z.number().int().positive(),
        amount: z.number().int().positive(),
      }),
    ])
    .optional(),
  face: z.object({ mark: z.string(), caption: z.string() }),
})

export const POGS: PogDefinition[] = [
  { id: 'big-dog', name: 'Big Dog', rarity: 'common', power: 8, face: { mark: 'DOG', caption: 'BIG' } },
  {
    id: 'brain-freeze',
    name: 'Brain Freeze',
    rarity: 'rare',
    power: 6,
    effect: { kind: 'guard', amount: 3 },
    face: { mark: 'ICE', caption: 'BRAIN' },
  },
  {
    id: 'bootleg-dragon',
    name: 'Bootleg Dragon',
    rarity: 'rare',
    power: 5,
    effect: { kind: 'multiFlipDamage', minimumFlips: 3, amount: 3 },
    face: { mark: 'DRGN', caption: 'BOOT' },
  },
  { id: 'mall-wizard', name: 'Mall Wizard', rarity: 'common', power: 7, face: { mark: 'WZRD', caption: 'MALL' } },
  { id: 'rad-rat', name: 'Rad Rat', rarity: 'common', power: 5, face: { mark: 'RAT', caption: 'RAD' } },
  { id: 'error-boy', name: 'Error Boy', rarity: 'unique', power: 9, face: { mark: 'ERR', caption: '404' } },
  {
    id: 'lunch-money',
    name: 'Lunch Money',
    rarity: 'common',
    power: 4,
    effect: { kind: 'guard', amount: 2 },
    face: { mark: '$$', caption: 'LUNCH' },
  },
  {
    id: 'video-store-ghost',
    name: 'Video Store Ghost',
    rarity: 'unique',
    power: 6,
    effect: { kind: 'multiFlipDamage', minimumFlips: 4, amount: 6 },
    face: { mark: 'VHS', caption: 'GHOST' },
  },
]

POGS.forEach((pog) => pogSchema.parse(pog))

export const STARTER_STACK = POGS.map((pog) => pog.id)

export const ENEMIES: EnemyDefinition[] = [
  { id: 'hall-monitor', name: 'Hall Monitor', maxHp: 58, attack: 8 },
  { id: 'mall-cop', name: 'Mall Cop', maxHp: 72, attack: 10 },
]

export const SLAMMER_FAMILIES: SlammerFamily[] = [
  {
    id: 'steel-puncher',
    name: 'Steel Puncher',
    basePower: 3,
    powerPerLevel: 2,
    physics: { radius: 0.68, thickness: 0.16, mass: 1.8, slamImpulse: 8.4 },
  },
  {
    id: 'wide-acrylic',
    name: 'Wide Acrylic',
    basePower: 2,
    powerPerLevel: 2,
    physics: { radius: 0.78, thickness: 0.13, mass: 1.45, slamImpulse: 7.5 },
  },
  {
    id: 'brass-drop',
    name: 'Brass Drop',
    basePower: 4,
    powerPerLevel: 2,
    physics: { radius: 0.62, thickness: 0.2, mass: 2.2, slamImpulse: 9.2 },
  },
]

export function pogById(id: string): PogDefinition {
  const pog = POGS.find((candidate) => candidate.id === id)
  if (!pog) throw new Error('Unknown POG: ' + id)
  return pog
}

export function slammerFamilyById(id: string): SlammerFamily {
  const family = SLAMMER_FAMILIES.find((candidate) => candidate.id === id)
  if (!family) throw new Error('Unknown slammer family: ' + id)
  return family
}
