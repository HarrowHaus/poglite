export type Rarity = 'common' | 'rare' | 'unique' | 'legendary'

export type PogEffect =
  | { kind: 'guard'; amount: number }
  | { kind: 'multiFlipDamage'; minimumFlips: number; amount: number }

export interface PogDefinition {
  id: string
  name: string
  rarity: Rarity
  power: number
  effect?: PogEffect
  face: {
    mark: string
    caption: string
  }
}

export interface EnemyDefinition {
  id: string
  name: string
  maxHp: number
  attack: number
}

export interface SlammerFamily {
  id: string
  name: string
  basePower: number
  powerPerLevel: number
  physics: {
    radius: number
    thickness: number
    mass: number
    slamImpulse: number
  }
}

export type SlammerAffix =
  | { id: string; kind: 'flatPogPower'; amount: number; text: string }
  | { id: string; kind: 'lowPowerBoost'; maxBasePower: number; amount: number; text: string }
  | { id: string; kind: 'multiFlipGuard'; minimumFlips: number; amount: number; text: string }

export interface GeneratedSlammer {
  instanceId: string
  familyId: string
  name: string
  rarity: Rarity
  level: number
  power: number
  affixes: SlammerAffix[]
}

export interface BattleState {
  playerHp: number
  playerMaxHp: number
  guard: number
  enemyHp: number
  enemyMaxHp: number
  turn: number
  won: boolean
  lost: boolean
}

export interface SlamResolution {
  flippedPogIds: string[]
  pogDamage: number
  slammerDamage: number
  bonusDamage: number
  totalDamage: number
  guardGained: number
  enemyAttack: number
  playerDamageTaken: number
  next: BattleState
}
