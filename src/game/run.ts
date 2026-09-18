import { ENEMIES } from './content'
import { rollSlammer } from './loot'
import type { GeneratedSlammer } from './types'

export const RUN_ENCOUNTER_COUNT = ENEMIES.length

export function rewardChoices(
  runSeed: string,
  encounterIndex: number,
  count = 3,
): GeneratedSlammer[] {
  const depth = encounterIndex + 2
  return Array.from({ length: count }, (_, rewardIndex) =>
    rollSlammer(runSeed + ':reward:' + encounterIndex + ':' + rewardIndex, depth),
  )
}

export function isFinalEncounter(encounterIndex: number) {
  return encounterIndex >= RUN_ENCOUNTER_COUNT - 1
}
