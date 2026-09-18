import { pogById } from './content'
import type { BattleState, EnemyDefinition, GeneratedSlammer, SlamResolution } from './types'

export function initialBattleState(enemy: EnemyDefinition, playerMaxHp = 40): BattleState {
  return {
    playerHp: playerMaxHp,
    playerMaxHp,
    guard: 0,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    turn: 1,
    won: false,
    lost: false,
  }
}

export function resolveSlam(
  state: BattleState,
  enemy: EnemyDefinition,
  slammer: GeneratedSlammer,
  flippedPogIds: string[],
): SlamResolution {
  if (state.won || state.lost) throw new Error('Cannot resolve a slam after battle end')

  const pogs = flippedPogIds.map(pogById)
  const flipCount = pogs.length
  const flatPogPower = slammer.affixes
    .filter((affix) => affix.kind === 'flatPogPower')
    .reduce((sum, affix) => sum + affix.amount, 0)

  let pogDamage = 0
  let bonusDamage = 0
  let guardGained = 0

  for (const pog of pogs) {
    let power = pog.power + flatPogPower

    for (const affix of slammer.affixes) {
      if (affix.kind === 'lowPowerBoost' && pog.power <= affix.maxBasePower) {
        power += affix.amount
      }
    }

    pogDamage += power
    if (pog.effect?.kind === 'guard') guardGained += pog.effect.amount
    if (pog.effect?.kind === 'multiFlipDamage' && flipCount >= pog.effect.minimumFlips) {
      bonusDamage += pog.effect.amount
    }
  }

  for (const affix of slammer.affixes) {
    if (affix.kind === 'multiFlipGuard' && flipCount >= affix.minimumFlips) {
      guardGained += affix.amount
    }
  }

  const slammerDamage = slammer.power
  const totalDamage = pogDamage + slammerDamage + bonusDamage
  const enemyHp = Math.max(0, state.enemyHp - totalDamage)
  const won = enemyHp === 0

  const availableGuard = state.guard + guardGained
  const playerDamageTaken = won ? 0 : Math.max(0, enemy.attack - availableGuard)
  const remainingGuard = won ? availableGuard : Math.max(0, availableGuard - enemy.attack)
  const playerHp = Math.max(0, state.playerHp - playerDamageTaken)
  const lost = playerHp === 0

  return {
    flippedPogIds,
    pogDamage,
    slammerDamage,
    bonusDamage,
    totalDamage,
    guardGained,
    enemyAttack: won ? 0 : enemy.attack,
    playerDamageTaken,
    next: {
      ...state,
      playerHp,
      guard: remainingGuard,
      enemyHp,
      turn: state.turn + 1,
      won,
      lost,
    },
  }
}
