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
  face: z.object({ mark: z.string().min(1).max(5), caption: z.string().min(1).max(8) }),
})

export const POGS: PogDefinition[] = [
  { id: 'big-dog', name: 'Big Dog', rarity: 'common', power: 8, face: { mark: 'DOG', caption: 'BIG' } },
  { id: 'rad-rat', name: 'Rad Rat', rarity: 'common', power: 5, face: { mark: 'RAT', caption: 'RAD' } },
  { id: 'mall-wizard', name: 'Mall Wizard', rarity: 'common', power: 7, face: { mark: 'WZRD', caption: 'MALL' } },
  {
    id: 'lunch-money',
    name: 'Lunch Money',
    rarity: 'common',
    power: 4,
    effect: { kind: 'guard', amount: 2 },
    face: { mark: '$$', caption: 'LUNCH' },
  },
  { id: 'sidewalk-shark', name: 'Sidewalk Shark', rarity: 'common', power: 6, face: { mark: 'SHRK', caption: 'SK8' } },
  {
    id: 'laser-ape',
    name: 'Laser Ape',
    rarity: 'common',
    power: 5,
    effect: { kind: 'multiFlipDamage', minimumFlips: 3, amount: 2 },
    face: { mark: 'APE', caption: 'LASER' },
  },
  {
    id: 'pizza-skull',
    name: 'Pizza Skull',
    rarity: 'common',
    power: 5,
    effect: { kind: 'guard', amount: 1 },
    face: { mark: 'PZZA', caption: 'SKULL' },
  },
  { id: 'gross-out-king', name: 'Gross-Out King', rarity: 'common', power: 7, face: { mark: 'GUNK', caption: 'KING' } },

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
  { id: 'chrome-goblin', name: 'Chrome Goblin', rarity: 'rare', power: 8, face: { mark: 'GOB', caption: 'CHROME' } },
  {
    id: 'toxic-slime',
    name: 'Toxic Slime',
    rarity: 'rare',
    power: 4,
    effect: { kind: 'multiFlipDamage', minimumFlips: 2, amount: 4 },
    face: { mark: 'OOZE', caption: 'TOXIC' },
  },
  {
    id: 'pager-demon',
    name: 'Pager Demon',
    rarity: 'rare',
    power: 5,
    effect: { kind: 'guard', amount: 4 },
    face: { mark: '666', caption: 'PAGER' },
  },
  {
    id: 'turbo-frog',
    name: 'Turbo Frog',
    rarity: 'rare',
    power: 6,
    effect: { kind: 'multiFlipDamage', minimumFlips: 4, amount: 5 },
    face: { mark: 'FRG', caption: 'TURBO' },
  },

  { id: 'error-boy', name: 'Error Boy', rarity: 'unique', power: 9, face: { mark: 'ERR', caption: '404' } },
  {
    id: 'video-store-ghost',
    name: 'Video Store Ghost',
    rarity: 'unique',
    power: 6,
    effect: { kind: 'multiFlipDamage', minimumFlips: 4, amount: 6 },
    face: { mark: 'VHS', caption: 'GHOST' },
  },
  {
    id: 'blacklight-oracle',
    name: 'Blacklight Oracle',
    rarity: 'unique',
    power: 5,
    effect: { kind: 'guard', amount: 7 },
    face: { mark: 'EYE', caption: 'UV' },
  },
  {
    id: 'forbidden-folder',
    name: 'Forbidden Folder',
    rarity: 'unique',
    power: 7,
    effect: { kind: 'multiFlipDamage', minimumFlips: 3, amount: 6 },
    face: { mark: 'XFILE', caption: 'NOPE' },
  },

  {
    id: 'vending-machine-god',
    name: 'Vending Machine God',
    rarity: 'legendary',
    power: 8,
    effect: { kind: 'multiFlipDamage', minimumFlips: 3, amount: 8 },
    face: { mark: 'GOD', caption: '25C' },
  },
  {
    id: 'final-boss-sticker',
    name: 'Final Boss Sticker',
    rarity: 'legendary',
    power: 6,
    effect: { kind: 'guard', amount: 8 },
    face: { mark: 'BOSS', caption: 'FINAL' },
  },
]

POGS.forEach((pog) => pogSchema.parse(pog))

const ids = POGS.map((pog) => pog.id)
if (new Set(ids).size !== ids.length) throw new Error('POG ids must be unique')

export const STARTER_STACK = POGS.slice(0, 8).map((pog) => pog.id)

export const ENEMIES: EnemyDefinition[] = [
  { id: 'hall-monitor', name: 'Hall Monitor', maxHp: 58, attack: 8 },
  { id: 'mall-cop', name: 'Mall Cop', maxHp: 72, attack: 10 },
  { id: 'arcade-manager', name: 'Arcade Manager', maxHp: 88, attack: 11 },
  { id: 'vice-principal', name: 'Vice Principal', maxHp: 104, attack: 13 },
  { id: 'regional-manager', name: 'Regional Manager', maxHp: 126, attack: 15 },
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
  {
    id: 'resin-wheel',
    name: 'Resin Wheel',
    basePower: 2,
    powerPerLevel: 2,
    physics: { radius: 0.84, thickness: 0.12, mass: 1.55, slamImpulse: 7.8 },
  },
  {
    id: 'micro-slam',
    name: 'Micro Slam',
    basePower: 4,
    powerPerLevel: 2,
    physics: { radius: 0.55, thickness: 0.18, mass: 1.5, slamImpulse: 9.5 },
  },
  {
    id: 'ceramic-club',
    name: 'Ceramic Club',
    basePower: 3,
    powerPerLevel: 2,
    physics: { radius: 0.72, thickness: 0.22, mass: 2.0, slamImpulse: 8.7 },
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
