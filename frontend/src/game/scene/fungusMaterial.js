import { Vector2 } from 'three'

const fungusMaterialState = new WeakMap()

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function getUvBounds(geometry) {
  const uv = geometry?.attributes?.uv
  if (!uv?.count) return { min: new Vector2(0, 0), range: new Vector2(1, 1) }

  const min = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
  const max = new Vector2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
  for (let index = 0; index < uv.count; index += 1) {
    const x = uv.getX(index)
    const y = uv.getY(index)
    min.set(Math.min(min.x, x), Math.min(min.y, y))
    max.set(Math.max(max.x, x), Math.max(max.y, y))
  }

  return {
    min,
    range: new Vector2(Math.max(0.001, max.x - min.x), Math.max(0.001, max.y - min.y)),
  }
}

export function updateFungusMaterial(material, risk = 0, seed = 0, geometry = null) {
  if (!material) return

  let state = fungusMaterialState.get(material)
  if (!state) {
    const uniforms = {
      fungusSeed: { value: Number(seed) || 0 },
      fungusStrength: { value: 0 },
      fungusUvMin: { value: new Vector2(0, 0) },
      fungusUvRange: { value: new Vector2(1, 1) },
    }
    const originalCompile = material.onBeforeCompile?.bind(material)

    material.defines = { ...material.defines, USE_UV: '' }
    material.onBeforeCompile = (shader, renderer) => {
      originalCompile?.(shader, renderer)
      shader.uniforms.fungusSeed = uniforms.fungusSeed
      shader.uniforms.fungusStrength = uniforms.fungusStrength
      shader.uniforms.fungusUvMin = uniforms.fungusUvMin
      shader.uniforms.fungusUvRange = uniforms.fungusUvRange
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vFungusUv;`,
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
vFungusUv = uv;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vFungusUv;
uniform float fungusSeed;
uniform float fungusStrength;
uniform vec2 fungusUvMin;
uniform vec2 fungusUvRange;

float fungusHash(vec2 point) {
  point = fract(point * vec2(123.34, 345.45));
  point += dot(point, point + 34.345 + fungusSeed);
  return fract(point.x * point.y);
}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
vec2 fungusNormalizedUv = clamp((vFungusUv - fungusUvMin) / fungusUvRange, 0.0, 1.0);
vec2 fungusGridUv = fungusNormalizedUv * vec2(6.0, 8.0);
vec2 fungusCell = floor(fungusGridUv);
vec2 fungusLocal = fract(fungusGridUv) - 0.5;
float fungusCellNoise = fungusHash(fungusCell + fungusSeed);
vec2 fungusJitter = vec2(
  fungusHash(fungusCell + vec2(3.17, 8.31) + fungusSeed),
  fungusHash(fungusCell + vec2(7.73, 1.91) + fungusSeed)
) - 0.5;
vec2 fungusShape = (fungusLocal - fungusJitter * 0.34) * vec2(1.0, 1.22);
float fungusDistance = length(fungusShape);
float fungusThreshold = mix(0.82, 0.60, fungusStrength);
float fungusSelected = step(fungusThreshold, fungusCellNoise);
float fungusEdgeNoise = 0.84 + 0.16 * sin(
  atan(fungusShape.y, fungusShape.x) * 7.0 + fungusCellNoise * 18.0
);
float fungusHalo = (1.0 - smoothstep(0.19 * fungusEdgeNoise, 0.40, fungusDistance)) * fungusSelected;
float fungusPowder = (1.0 - smoothstep(0.055, 0.18 * fungusEdgeNoise, fungusDistance)) * fungusSelected;
float fungusVisibility = fungusHalo * fungusStrength;
vec3 fungusLesionColor = diffuseColor.rgb * vec3(0.56, 0.70, 0.48);
vec3 fungusPowderColor = mix(fungusLesionColor, vec3(0.86, 0.90, 0.80), 0.86);
diffuseColor.rgb = mix(diffuseColor.rgb, fungusLesionColor, fungusVisibility * 0.72);
diffuseColor.rgb = mix(diffuseColor.rgb, fungusPowderColor, fungusPowder * fungusStrength * 0.92);`,
        )
    }
    material.customProgramCacheKey = () => 'plant-surface-fungus-v3'
    material.needsUpdate = true
    state = { uniforms }
    fungusMaterialState.set(material, state)
  }

  const uvBounds = getUvBounds(geometry)
  state.uniforms.fungusSeed.value = Number(seed) || 0
  state.uniforms.fungusUvMin.value.copy(uvBounds.min)
  state.uniforms.fungusUvRange.value.copy(uvBounds.range)
  state.uniforms.fungusStrength.value = Number(risk) > 0
    ? 0.35 + clamp(risk, 0, 100) * 0.0065
    : 0
}
