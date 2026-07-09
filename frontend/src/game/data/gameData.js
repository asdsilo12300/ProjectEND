import { storageAsset } from '../../lib/api'

export const imageAssets = {
  plant: storageAsset('icon picture/Elephant Ear-Photoroom.png'),
  hand: storageAsset('icon picture/hand-Photoroom.png'),
  insecticide: storageAsset('icon picture/Insecticide spray-Photoroom.png'),
  antifungal: storageAsset('icon picture/Antifungal spray-Photoroom.png'),
  snailSpray: storageAsset('icon picture/snail spray.png'),
  water: storageAsset('icon picture/waterS-Photoroom.png'),
  light: storageAsset('icon picture/light-Photoroom.png'),
  fertilizer: storageAsset('icon picture/fertilizer-Photoroom.png'),
  soil: storageAsset('icon picture/Soil moisture-Photoroom.png'),
  air: storageAsset('icon picture/Air humidity-Photoroom.png'),
  temp: storageAsset('icon picture/temp-Photoroom.png'),
  aphid: storageAsset('icon picture/aphid-Photoroom.png'),
  snail: storageAsset('icon picture/snails-Photoroom.png'),
  fungus: storageAsset('icon picture/fungus-Photoroom.png'),
  coin: storageAsset('icon picture/coin.png'),
  uproot: storageAsset('icon picture/uproot.jpg'),
  harvest: storageAsset('icon picture/harvest.jpg'),
}
export const navItems = ['Plant Lab', 'Shop', 'History', 'Community']
export const navTargets = {
  'Plant Lab': 'monitor',
  Shop: 'climate',
  History: 'comments',
  Community: 'friends',
}

export const pestChances = [
  { label: 'Snail', value: 18, icon: 'snail', color: '#b58a5a', imageUrl: imageAssets.snail },
  { label: 'Aphid', value: 24, icon: 'aphid', color: '#f29b72', imageUrl: imageAssets.aphid },
  { label: 'Fungus', value: 9, icon: 'fungus', color: '#c48bf2', imageUrl: imageAssets.fungus },
]

export const climateIcons = {
  water: { icon: 'drop', color: '#67d5cf', imageUrl: imageAssets.water },
  light: { icon: 'bolt', color: '#f7d35c', imageUrl: imageAssets.light },
  fertilizer: { icon: 'plus', color: '#9bcf82', imageUrl: imageAssets.fertilizer },
  soil: { icon: 'soil', color: '#b58a5a', imageUrl: imageAssets.soil },
  air: { icon: 'wind', color: '#9fd7ff', imageUrl: imageAssets.air },
  temp: { icon: 'temp', color: '#f29b72', imageUrl: imageAssets.temp },
}

export const defaultClimate = {
  water: 55,
  light: 72,
  fertilizer: 35,
  soil: 62,
  air: 58,
  temp: 29,
}



