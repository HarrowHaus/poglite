import {
  Camera,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'

export interface ClientRectLike {
  left: number
  top: number
  width: number
  height: number
}

const raycaster = new Raycaster()
const pointerNdc = new Vector2()
const horizontalPlane = new Plane()
const planeNormal = new Vector3(0, 1, 0)
const intersection = new Vector3()

export function projectClientPointToHorizontalPlane(
  camera: Camera,
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  planeY: number,
): Vector3 | null {
  if (rect.width <= 0 || rect.height <= 0) return null

  pointerNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )

  camera.updateMatrixWorld()
  raycaster.setFromCamera(pointerNdc, camera)

  horizontalPlane.set(planeNormal, -planeY)
  const hit = raycaster.ray.intersectPlane(horizontalPlane, intersection)

  return hit ? hit.clone() : null
}
