import { imageAssets } from '../../data/gameData'

export const shopItems = [
  { id: 'insecticide-spray', name: 'Insect Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#67d5cf', imageUrl: imageAssets.insecticide },
  { id: 'snail-spray', name: 'Snail Spray', category: 'Lab Item', price: 25, featured: true, visual: 'spray', accent: '#b58a5a', imageUrl: imageAssets.snailSpray },
  { id: 'antifungal-spray', name: 'Fungus Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#c48bf2', imageUrl: imageAssets.antifungal },
  { id: 'aphid-prank', name: 'Aphid Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#f29b72', imageUrl: imageAssets.aphid },
  { id: 'snail-prank', name: 'Snail Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#b58a5a', imageUrl: imageAssets.snail },
]

export const shopCategories = [
  { label: 'Lab Item', count: 3 },
  { label: 'Friend Prank', count: 2 },
]

export const priceRange = {
  min: 20,
  max: 1000,
}
