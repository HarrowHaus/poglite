import fc from 'fast-check'
import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { projectClientPointToHorizontalPlane } from './pointerProjection'

const rect = { left: 0, top: 0, width: 1000, height: 700 }

function makeCamera() {
  const camera = new PerspectiveCamera(34, rect.width / rect.height, 0.1, 100)
  camera.position.set(0, 7.41, 8.19)
  camera.lookAt(0, 0.12, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

describe('pointer projection', () => {
  it('maps screen-down toward the camera on the horizontal slammer plane', () => {
    const camera = makeCamera()
    const planeY = 1.35
    const center = projectClientPointToHorizontalPlane(camera, 500, 350, rect, planeY)
    const lower = projectClientPointToHorizontalPlane(camera, 500, 500, rect, planeY)

    expect(center).not.toBeNull()
    expect(lower).not.toBeNull()
    expect(lower!.z).toBeGreaterThan(center!.z)
    expect(Math.abs(lower!.x - center!.x)).toBeLessThan(0.00001)
  })

  it('maps screen-right to the visible camera-right direction', () => {
    const camera = makeCamera()
    const planeY = 1.35
    const center = projectClientPointToHorizontalPlane(camera, 500, 350, rect, planeY)
    const right = projectClientPointToHorizontalPlane(camera, 650, 350, rect, planeY)

    expect(center).not.toBeNull()
    expect(right).not.toBeNull()
    expect(right!.x).toBeGreaterThan(center!.x)
  })

  it('always lands exactly on the requested horizontal plane', () => {
    const camera = makeCamera()

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: rect.width - 1 }),
        fc.integer({ min: 1, max: rect.height - 1 }),
        fc.double({ min: 0.2, max: 2.2, noNaN: true }),
        (x, y, planeY) => {
          const point = projectClientPointToHorizontalPlane(camera, x, y, rect, planeY)
          if (point) expect(point.y).toBeCloseTo(planeY, 8)
        },
      ),
      { numRuns: 100 },
    )
  })
})
