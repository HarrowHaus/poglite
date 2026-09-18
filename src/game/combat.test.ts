import { describe, expect, it } from 'vitest'
import { ENEMIES } from './content'
import { initialBattleState, resolveSlam } from './combat'
import type { GeneratedSlammer } from './types'

const plainSlammer: GeneratedSlammer = {
  instanceId: 'test',
  familyId: 'steel-puncher',
  name: 'Test Slammer',
  rarity: 'common',
  level: 1,
  power: 3,
  affixes: [],
}

describe('resolveSlam', () => {
  it('keeps the core damage formula legible', () => {
    const enemy = ENEMIES[0]
    const state = initialBattleState(enemy)
    const result = resolveSlam(state, enemy, plainSlammer, ['big-dog', 'mall-wizard'])

    expect(result.pogDamage).toBe(15)
    expect(result.slammerDamage).toBe(3)
    expect(result.totalDamage).toBe(18)
    expect(result.next.enemyHp).toBe(enemy.maxHp - 18)
  })

  it('does not let the enemy attack after lethal damage', () => {
    const enemy = { ...ENEMIES[0], maxHp: 10 }
    const state = initialBattleState(enemy)
    const result = resolveSlam(state, enemy, plainSlammer, ['big-dog'])

    expect(result.next.won).toBe(true)
    expect(result.playerDamageTaken).toBe(0)
  })
})
