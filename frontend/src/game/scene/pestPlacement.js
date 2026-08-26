export const PEST_PLACEMENT_MODES = Object.freeze({
  GROUND_RANDOM: 'ground_random',
  LEAF: 'leaf',
  PLANT_SURFACE: 'plant_surface',
})

const validModes = new Set(Object.values(PEST_PLACEMENT_MODES))

export function pestPlacementMode(pest, normalizedName = '') {
  const configured = String(
    pest?.pest?.placement_mode
      ?? pest?.placement_mode
      ?? '',
  ).trim().toLowerCase()

  if (validModes.has(configured)) return configured
  if (normalizedName.includes('aphid') || normalizedName.includes('เพลี้ย')) return PEST_PLACEMENT_MODES.LEAF
  if (normalizedName.includes('fungus') || normalizedName.includes('เชื้อรา')) return PEST_PLACEMENT_MODES.PLANT_SURFACE
  return PEST_PLACEMENT_MODES.GROUND_RANDOM
}
