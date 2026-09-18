import { describe, expect, it } from 'vitest'
import { RUN_ENCOUNTER_COUNT, isFinalEncounter, rewardChoices } from './run'

describe('run cadence', () => {
  it('has a short readable encounter ladder', () => {
    expect(RUN_ENCOUNTER_COUNT).toBe(5)
    expect(isFinalEncounter(0)).toBe(false)
    expect(isFinalEncounter(4)).toBe(true)
  })

  it('generates three deterministic reward choices', () => {
    const first = rewardChoices('run-seed', 1)
    const second = rewardChoices('run-seed', 1)

    expect(first).toHaveLength(3)
    expect(first).toEqual(second)
    expect(new Set(first.map((reward) => reward.instanceId)).size).toBe(3)
  })
})
