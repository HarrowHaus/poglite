import { describe, expect, it } from 'vitest'
import {
  runVerticalShotMatrix,
  simulateVerticalShot,
} from './headlessPog'

describe('headless vertical POG physics', () => {
  it('is deterministic for the same shot and stack seed', async () => {
    const input = {
      familyId: 'steel-puncher',
      power: 0.85,
      lateral: 0.5,
      jitterSeed: 'same',
    }

    const first = await simulateVerticalShot(input)
    const second = await simulateVerticalShot(input)

    expect(second).toEqual(first)
  }, 20_000)

  it('measures a real contact and cap angular response', async () => {
    const result = await simulateVerticalShot({
      familyId: 'steel-puncher',
      power: 1,
      lateral: 0.65,
      jitterSeed: 'contact',
    })

    expect(result.firstImpactMs).not.toBeNull()
    expect(result.totalNormalImpulse).toBeGreaterThan(0)
    expect(result.maxCapPitchRollSpeed).toBeGreaterThan(0)
    expect(result.contactEccentricity).not.toBeNull()
  }, 20_000)

  it('can run a small multi-shot matrix without rendering', async () => {
    const results = await runVerticalShotMatrix({
      powers: [0.6, 1],
      laterals: [-0.6, 0, 0.6],
      families: ['steel-puncher'],
      seeds: ['a', 'b'],
    })

    expect(results).toHaveLength(12)
    expect(results.every((result) => Number.isFinite(result.scatterRadius))).toBe(true)
  }, 30_000)
})
