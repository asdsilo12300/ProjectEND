import { storageAsset } from '../../../lib/api'

export const shopItems = [
  { id: 'insecticide-spray', name: 'Insect Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#67d5cf', imageUrl: storageAsset('icon picture/Insecticide spray-Photoroom.png') },
  { id: 'snail-spray', name: 'Snail Spray', category: 'Lab Item', price: 25, featured: true, visual: 'spray', accent: '#b58a5a', imageUrl: storageAsset('icon picture/snail spray.png') },
  { id: 'antifungal-spray', name: 'Fungus Spray', category: 'Lab Item', price: 50, featured: true, visual: 'spray', accent: '#c48bf2', imageUrl: storageAsset('icon picture/Antifungal spray-Photoroom.png') },
  { id: 'aphid-prank', name: 'Aphid Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#f29b72', imageUrl: storageAsset('icon picture/aphid-Photoroom.png') },
  { id: 'snail-prank', name: 'Snail Prank', category: 'Friend Prank', price: 100, featured: true, visual: 'pest', accent: '#b58a5a', imageUrl: storageAsset('icon picture/snails-Photoroom.png') },
]

export const shopCategories = [
  { label: 'Lab Item', count: 3 },
  { label: 'Friend Prank', count: 2 },
]

export const priceRange = {
  min: 20,
  max: 1000,
}
