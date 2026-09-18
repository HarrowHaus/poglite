import { beforeEach, describe, expect, it } from 'vitest'
import { ENEMIES, STARTER_STACK } from './content'
import { useGameStore } from './store'

describe('run store', () => {
  beforeEach(() => {
    useGameStore.getState().restartRun()
  })

  it('moves from a won encounter to a three-choice reward and the next fight', () => {
    let safety = 0

    while (!useGameStore.getState().battle.won && safety < 10) {
      useGameStore.getState().resolve(STARTER_STACK)
      safety += 1
    }

    expect(useGameStore.getState().battle.won).toBe(true)

    useGameStore.getState().openReward()
    const rewardState = useGameStore.getState()

    expect(rewardState.phase).toBe('reward')
    expect(rewardState.rewards).toHaveLength(3)

    const selected = rewardState.rewards[1]
    useGameStore.getState().chooseReward(selected.instanceId)

    const next = useGameStore.getState()
    expect(next.phase).toBe('combat')
    expect(next.encounterIndex).toBe(1)
    expect(next.slammer).toEqual(selected)
    expect(next.battle.enemyHp).toBe(ENEMIES[1].maxHp)
    expect(next.battle.playerHp).toBe(next.battle.playerMaxHp)
    expect(next.lastResolution).toBeUndefined()
  })

  it('allows exactly one completion-pack claim per run', () => {
    useGameStore.setState({ phase: 'complete', completionPackClaimed: false })

    expect(useGameStore.getState().claimCompletionPack()).toBe(true)
    expect(useGameStore.getState().completionPackClaimed).toBe(true)
    expect(useGameStore.getState().claimCompletionPack()).toBe(false)

    useGameStore.getState().restartRun()
    expect(useGameStore.getState().completionPackClaimed).toBe(false)
  })
})
