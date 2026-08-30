import { Box3, Raycaster, Vector3 } from 'three'

export const PLANTING_CENTER = [0.75, 0]
export const PLANTING_SURFACE_LIFT = 0.018

const DOWN = new Vector3(0, -1, 0)

export function findGroundSurface(groundObject) {
  let groundSurface = null
  let largestFootprint = 0

  groundObject.updateMatrixWorld(true)
  groundObject.traverse((child) => {
    if (!child.isMesh || !child.geometry) return

    const name = child.name?.toLowerCase?.() ?? ''
    if (name.includes('irregular_ground_surface')) {
      groundSurface = child
      largestFootprint = Number.POSITIVE_INFINITY
      return
    }

    if (largestFootprint === Number.POSITIVE_INFINITY) return

    const bounds = new Box3().setFromObject(child)
    const size = bounds.getSize(new Vector3())
    const footprint = size.x * size.z
    if (footprint > largestFootprint) {
      largestFootprint = footprint
      groundSurface = child
    }
  })

  return groundSurface
}

export function findPlantingHeight(groundObject) {
  const groundSurface = findGroundSurface(groundObject)
  if (!groundSurface) return -0.4

  const bounds = new Box3().setFromObject(groundSurface)
  const raycaster = new Raycaster(
    new Vector3(PLANTING_CENTER[0], bounds.max.y + 4, PLANTING_CENTER[1]),
    DOWN,
  )

  return raycaster.intersectObject(groundSurface, false)[0]?.point.y ?? bounds.max.y
}
