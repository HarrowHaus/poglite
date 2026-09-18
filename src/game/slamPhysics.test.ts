import { describe, expect, it } from 'vitest'
import { capUpDot, isFaceUpRotation } from './slamPhysics'

describe('cap orientation', () => {
  it('reads the identity rotation as face-up', () => {
    const q = { x: 0, y: 0, z: 0, w: 1 }
    expect(capUpDot(q)).toBe(1)
    expect(isFaceUpRotation(q)).toBe(true)
  })

  it('reads a 180 degree X rotation as face-down', () => {
    const q = { x: 1, y: 0, z: 0, w: 0 }
    expect(capUpDot(q)).toBe(-1)
    expect(isFaceUpRotation(q)).toBe(false)
  })

  it('does not count a cap resting on its edge as face-up', () => {
    const half = Math.sqrt(0.5)
    const q = { x: half, y: 0, z: 0, w: half }
    expect(Math.abs(capUpDot(q))).toBeLessThan(0.000001)
    expect(isFaceUpRotation(q)).toBe(false)
  })
})
