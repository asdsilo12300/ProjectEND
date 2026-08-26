import { useLayoutEffect, useRef } from 'react'
import { Environment } from '@react-three/drei'
import { getRainVisualIntensity } from './rainUtils'

const DAY_HDRI = '/hdri/symmetrical_garden_02_4k.hdr'
const NIGHT_HDRI = '/hdri/satara_night_no_lamps_4k.hdr'

// A warm street-lamp style pool: a bright focused beam plus softer spill.
// The HDRI and the rest of the night scene keep their original exposure.
export const OUTDOOR_NIGHT_PLANT_LIGHT_INTENSITY = 105
const OUTDOOR_NIGHT_LAMP_SPILL_INTENSITY = 15

function NightPlantLight() {
  const lightRef = useRef(null)
  const spillLightRef = useRef(null)
  const targetRef = useRef(null)

  useLayoutEffect(() => {
    if (!targetRef.current) return
    ;[lightRef.current, spillLightRef.current].forEach((light) => {
      if (!light) return
      light.target = targetRef.current
      light.target.updateMatrixWorld()
    })
  }, [])

  return (
    <>
      <object3D ref={targetRef} position={[0.75, 0.18, 0]} />
      <spotLight
        ref={lightRef}
        castShadow
        angle={0.29}
        color="#ffd08a"
        decay={2}
        distance={7.5}
        intensity={OUTDOOR_NIGHT_PLANT_LIGHT_INTENSITY}
        penumbra={0.5}
        position={[-0.85, 4.65, 1.05]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <spotLight
        ref={spillLightRef}
        angle={0.35}
        color="#ffc878"
        decay={2}
        distance={7.5}
        intensity={OUTDOOR_NIGHT_LAMP_SPILL_INTENSITY}
        penumbra={1}
        position={[-0.85, 4.65, 1.05]}
      />
      <pointLight
        color="#ffd9a6"
        decay={2}
        distance={2.35}
        intensity={9}
        position={[-0.85, 4.45, 1.05]}
      />
    </>
  )
}

export function TimeOfDayEnvironment({ plantSelected = false, rainfall = 0, solar }) {
  const rainIntensity = getRainVisualIntensity(rainfall)
  const backgroundIntensity = solar.backgroundIntensity * (1 - rainIntensity * 0.2)
  const environmentIntensity = solar.environmentIntensity * (1 - rainIntensity * 0.12)
  const hemisphereIntensity = solar.hemisphereIntensity * (1 - rainIntensity * 0.24)
  const sunIntensity = solar.sunIntensity * (1 - rainIntensity * 0.62)

  return (
    <>
      <Environment
        key={solar.isDay ? DAY_HDRI : NIGHT_HDRI}
        files={solar.isDay ? DAY_HDRI : NIGHT_HDRI}
        background
        backgroundBlurriness={0.02}
        backgroundIntensity={backgroundIntensity}
        environmentIntensity={environmentIntensity}
      />
      <hemisphereLight
        color={solar.isDay ? '#dceeff' : '#7180a4'}
        groundColor={solar.isDay ? '#544a39' : '#101722'}
        intensity={hemisphereIntensity}
      />
      {sunIntensity > 0 && (
        <directionalLight
          castShadow
          color={solar.sunColor}
          intensity={sunIntensity}
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
