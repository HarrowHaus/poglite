import { create } from 'zustand'
import { ENEMIES } from './content'
import { initialBattleState, resolveSlam } from './combat'
import { rollSlammer } from './loot'
import { isFinalEncounter, rewardChoices } from './run'
import type { BattleState, GeneratedSlammer, SlamResolution } from './types'

type RunPhase = 'combat' | 'reward' | 'complete'

interface GameStore {
  runSeed: string
  encounterIndex: number
  phase: RunPhase
  battle: BattleState
  slammer: GeneratedSlammer
  rewards: GeneratedSlammer[]
  lastResolution?: SlamResolution
  completionPackClaimed: boolean
  resolve: (flippedPogIds: string[]) => SlamResolution
  openReward: () => void
  chooseReward: (instanceId: string) => void
  claimCompletionPack: () => boolean
  restartRun: () => void
}

const RUN_SEED = 'poglite-run-01'
const starterSlammer = rollSlammer(RUN_SEED + ':starter', 1)

function initialRun() {
  return {
    runSeed: RUN_SEED,
    encounterIndex: 0,
    phase: 'combat' as const,
    battle: initialBattleState(ENEMIES[0]),
    slammer: starterSlammer,
    rewards: [] as GeneratedSlammer[],
    lastResolution: undefined,
    completionPackClaimed: false,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialRun(),

  resolve(flippedPogIds) {
    const state = get()
    if (state.phase !== 'combat') throw new Error('Cannot resolve combat outside combat phase')

    const enemy = ENEMIES[state.encounterIndex]
    const result = resolveSlam(state.battle, enemy, state.slammer, flippedPogIds)
    set({ battle: result.next, lastResolution: result })
    return result
  },

  openReward() {
    const state = get()
    if (!state.battle.won || state.phase !== 'combat') return

    if (isFinalEncounter(state.encounterIndex)) {
      set({ phase: 'complete', rewards: [] })
      return
    }

    set({
      phase: 'reward',
      rewards: rewardChoices(state.runSeed, state.encounterIndex),
    })
  },

  chooseReward(instanceId) {
    const state = get()
    if (state.phase !== 'reward') return

    const selected = state.rewards.find((reward) => reward.instanceId === instanceId)
    if (!selected) throw new Error('Unknown run reward: ' + instanceId)

    const nextEncounterIndex = state.encounterIndex + 1
    const enemy = ENEMIES[nextEncounterIndex]

    set({
      encounterIndex: nextEncounterIndex,
      phase: 'combat',
      battle: initialBattleState(enemy),
      slammer: selected,
      rewards: [],
      lastResolution: undefined,
    })
  },

  claimCompletionPack() {
    const state = get()
    if (state.phase !== 'complete' || state.completionPackClaimed) return false
    set({ completionPackClaimed: true })
    return true
  },

  restartRun() {
    set(initialRun())
  },
}))
