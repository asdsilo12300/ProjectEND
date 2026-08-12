import { useGLTF } from '@react-three/drei'

export const ACTION_MODEL_URLS = {
  water: '/models/actions/watering-can/scene.gltf',
  fertilizer: '/models/actions/fertilizer/scene.gltf',
  straw: '/models/actions/straw-mulch/scene.gltf',
}

export function preloadActionModels() {
  Object.values(ACTION_MODEL_URLS).forEach((url) => useGLTF.preload(url))
}
