import { create } from 'zustand'
import { ENEMIES } from './content'
import { initialBattleState, resolveSlam } from './combat'
import { rollSlammer } from './loot'
import type { BattleState, GeneratedSlammer, SlamResolution } from './types'

interface GameStore {
  battle: BattleState
  slammer: GeneratedSlammer
  lastResolution?: SlamResolution
  resolve: (flippedPogIds: string[]) => void
  reset: () => void
}

const enemy = ENEMIES[0]
const starterSlammer = rollSlammer('starter-steel', 1)

export const useGameStore = create<GameStore>((set, get) => ({
  battle: initialBattleState(enemy),
  slammer: starterSlammer,
  resolve(flippedPogIds) {
    const result = resolveSlam(get().battle, enemy, get().slammer, flippedPogIds)
    set({ battle: result.next, lastResolution: result })
  },
  reset() {
    set({ battle: initialBattleState(enemy), lastResolution: undefined })
  },
}))
