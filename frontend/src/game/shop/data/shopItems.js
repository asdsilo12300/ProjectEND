import { imageAssets } from '../../data/gameData'

export const shopItems = [
  { id: 'insecticide-spray', name: 'Insect Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#67d5cf', imageUrl: imageAssets.insecticide },
  { id: 'snail-spray', name: 'Snail Spray', category: 'Lab Item', price: 25, featured: true, visual: 'spray', accent: '#b58a5a', imageUrl: imageAssets.snailSpray },
  { id: 'antifungal-spray', name: 'Fungus Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#c48bf2', imageUrl: imageAssets.antifungal },
  { id: 'aphid-prank', name: 'Aphid Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#f29b72', imageUrl: imageAssets.aphid },
  { id: 'snail-prank', name: 'Snail Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#b58a5a', imageUrl: imageAssets.snail },
  { id: 'water', name: 'Watering Dose', category: 'Lab Item', price: 20, featured: true, visual: 'water', accent: '#66c7f4', imageUrl: imageAssets.wateringCan, description: 'Restores the active plant water reserve. Water is used every simulation cycle.' },
  { id: 'fertilizer', name: 'Fertilizer Dose', category: 'Lab Item', price: 25, featured: true, visual: 'fertilizer', accent: '#d7a948', imageUrl: imageAssets.fertilizerCare, description: 'Restores the active plant nutrient reserve. Nutrients drain more slowly than water.' },
  { id: 'mulch', name: 'Straw Mulch', category: 'Lab Item', price: 30, featured: true, visual: 'soil', accent: '#d8a343', imageUrl: imageAssets.strawMulch, description: 'Use during heavy rain, low soil moisture, or excessive soil heat to help water and moisture last longer.' },
  { id: 'shade', name: 'Shade Cloth', category: 'Lab Item', price: 40, featured: true, visual: 'shade', accent: '#8fcf84', imageUrl: imageAssets.shadeCloth, description: 'Temporarily protect an outdoor plant from intense light and heat.' },
  { id: 'windbreak', name: 'Windbreak', category: 'Lab Item', price: 40, featured: true, visual: 'wind', accent: '#7cc9be', imageUrl: imageAssets.windbreak, description: 'Temporarily reduce stress from strong outdoor wind.' },
  { id: 'frost-cover', name: 'Frost Cover', category: 'Lab Item', price: 40, featured: true, visual: 'frost', accent: '#9dc9ef', imageUrl: imageAssets.frostCover, description: 'Temporarily protect an outdoor plant from sudden cold.' },
]

export const shopCategories = [
  { label: 'Lab Item', count: 3 },
  { label: 'Friend Prank', count: 2 },
]

export const priceRange = {
  min: 20,
  max: 1000,
}
