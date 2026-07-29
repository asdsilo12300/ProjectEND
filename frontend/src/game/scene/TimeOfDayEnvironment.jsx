import { useLayoutEffect, useRef } from 'react'
import { Environment } from '@react-three/drei'

const DAY_HDRI = '/hdri/symmetrical_garden_02_4k.hdr'
const NIGHT_HDRI = '/hdri/satara_night_no_lamps_4k.hdr'

// Increase or decrease this value to tune only the focused outdoor night lamp.
// The HDRI and the rest of the night scene keep their original exposure.
export const OUTDOOR_NIGHT_PLANT_LIGHT_INTENSITY = 30

function NightPlantLight() {
  const lightRef = useRef(null)
  const targetRef = useRef(null)

  useLayoutEffect(() => {
    if (!lightRef.current || !targetRef.current) return
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  }, [])

  return (
    <>
      <object3D ref={targetRef} position={[0.75, 0.18, 0]} />
      <spotLight
        ref={lightRef}
        castShadow
        angle={0.4}
        color="#ffd7a3"
        decay={2}
        distance={7}
        intensity={OUTDOOR_NIGHT_PLANT_LIGHT_INTENSITY}
        penumbra={0.86}
        position={[0.75, 4.1, 0.9]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  )
}

export function TimeOfDayEnvironment({ plantSelected = false, solar }) {
  return (
    <>
      <Environment
        key={solar.isDay ? DAY_HDRI : NIGHT_HDRI}
        files={solar.isDay ? DAY_HDRI : NIGHT_HDRI}
        background
        backgroundBlurriness={0.02}
        backgroundIntensity={solar.backgroundIntensity}
        environmentIntensity={solar.environmentIntensity}
      />
      <hemisphereLight
        color={solar.isDay ? '#dceeff' : '#7180a4'}
        groundColor={solar.isDay ? '#544a39' : '#101722'}
        intensity={solar.hemisphereIntensity}
      />
      {solar.sunIntensity > 0 && (
        <directionalLight
          castShadow
          color={solar.sunColor}
          intensity={solar.sunIntensity}
          position={solar.sunPosition}
          shadow-bias={-0.00035}
          shadow-normalBias={0.025}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-camera-near={0.1}
          shadow-camera-far={32}
        />
      )}
      {!solar.isDay && plantSelected && <NightPlantLight />}
    </>
  )
}
