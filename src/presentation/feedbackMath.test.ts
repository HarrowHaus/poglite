import { describe, expect, it } from 'vitest'
import { normalizeImpactForce } from './feedbackMath'

describe('normalizeImpactForce', () => {
  it('clamps invalid and negative force to zero', () => {
    expect(normalizeImpactForce(-10)).toBe(0)
    expect(normalizeImpactForce(Number.NaN)).toBe(0)
  })

  it('maps stronger contact to stronger feedback without exceeding one', () => {
    expect(normalizeImpactForce(20)).toBeLessThan(normalizeImpactForce(100))
    expect(normalizeImpactForce(100)).toBeLessThanOrEqual(1)
    expect(normalizeImpactForce(1_000_000)).toBe(1)
  })
})
