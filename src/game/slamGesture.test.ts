import { describe, expect, it } from 'vitest'
import {
  MAX_PULL_WORLD,
  pullFromScreenMovement,
  screenPlaneBasisFromCameraForward,
  slammerImpulse,
} from './slamGesture'

describe('pull-and-release slam gesture', () => {
  it('maps screen-down to world-space toward the camera', () => {
    const basis = screenPlaneBasisFromCameraForward(0, -1)
    const pull = pullFromScreenMovement(0, 100, 0.01, 0.01, basis)

    expect(pull.x).toBeCloseTo(0, 5)
    expect(pull.z).toBeGreaterThan(0)
  })

  it('rotates drag controls with the camera instead of world axes', () => {
    const basis = screenPlaneBasisFromCameraForward(-1, 0)
    const screenRight = pullFromScreenMovement(100, 0, 0.01, 0.01, basis)
    const screenDown = pullFromScreenMovement(0, 100, 0.01, 0.01, basis)

    expect(screenRight.z).toBeLessThan(0)
    expect(Math.abs(screenRight.x)).toBeLessThan(0.00001)

    expect(screenDown.x).toBeGreaterThan(0)
    expect(Math.abs(screenDown.z)).toBeLessThan(0.00001)
  })

  it('clamps pull distance while preserving direction', () => {
    const basis = screenPlaneBasisFromCameraForward(0, -1)
    const pull = pullFromScreenMovement(1000, 1000, 0.01, 0.01, basis)

    expect(Math.hypot(pull.x, pull.z)).toBeCloseTo(MAX_PULL_WORLD, 5)
    expect(pull.power).toBe(1)
    expect(pull.x).toBeCloseTo(pull.z, 5)
  })

  it('launches opposite the camera-correct pull like a slingshot', () => {
    const pull = { x: -0.5, z: 1, power: 0.7 }
    const impulse = slammerImpulse(pull, 8)

    expect(impulse).not.toBeNull()
    expect(impulse!.x).toBeGreaterThan(0)
    expect(impulse!.z).toBeLessThan(0)
    expect(impulse!.y).toBeLessThan(0)
  })

  it('responds predictably to a tuned launch envelope', () => {
    const pull = { x: 0, z: 1, power: 0.75 }
    const soft = slammerImpulse(pull, 8, {
      horizontalBase: 0.5,
      horizontalPower: 0.5,
      downwardBase: 0.05,
      downwardPower: 0.05,
    })
    const hard = slammerImpulse(pull, 8, {
      horizontalBase: 1.5,
      horizontalPower: 1,
      downwardBase: 0.2,
      downwardPower: 0.2,
    })

    expect(soft).not.toBeNull()
    expect(hard).not.toBeNull()
    expect(Math.hypot(hard!.x, hard!.z)).toBeGreaterThan(Math.hypot(soft!.x, soft!.z))
    expect(Math.abs(hard!.y)).toBeGreaterThan(Math.abs(soft!.y))
  })

  it('ignores tiny accidental releases', () => {
    expect(slammerImpulse({ x: 0.02, z: 0.02, power: 0.02 }, 8)).toBeNull()
  })
})
