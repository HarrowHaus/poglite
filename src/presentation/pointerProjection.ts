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
const plane = new Plane()
const horizontalNormal = new Vector3(0, 1, 0)
const intersection = new Vector3()

export function projectClientPointToPlane(
  camera: Camera,
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  planePoint: { x: number; y: number; z: number },
  planeNormal: { x: number; y: number; z: number },
): Vector3 | null {
  if (rect.width <= 0 || rect.height <= 0) return null

  pointerNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  )

  camera.updateMatrixWorld()
  raycaster.setFromCamera(pointerNdc, camera)

  const normal = new Vector3(
    planeNormal.x,
    planeNormal.y,
    planeNormal.z,
  ).normalize()

  plane.setFromNormalAndCoplanarPoint(
    normal,
    new Vector3(planePoint.x, planePoint.y, planePoint.z),
  )

  const hit = raycaster.ray.intersectPlane(plane, intersection)
  return hit ? hit.clone() : null
}

export function projectClientPointToHorizontalPlane(
  camera: Camera,
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  planeY: number,
): Vector3 | null {
  return projectClientPointToPlane(
    camera,
    clientX,
    clientY,
    rect,
    { x: 0, y: planeY, z: 0 },
    horizontalNormal,
  )
}
