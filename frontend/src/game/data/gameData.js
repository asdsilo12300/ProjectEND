export const imageAssets = {
  plant: '/game-icons/elephant-ear.png',
  hand: '/game-icons/hand-pick.png',
  insecticide: '/game-icons/insect-spray.png',
  antifungal: '/game-icons/antifungal-spray.png',
  snailSpray: '/game-icons/snail-spray.png',
  // Use the supplied high-contrast illustration for need meters. Keep the
  // watering-can asset separate for the care-action card and 3D animation.
  water: '/game-icons/water-photoroom.png',
  light: '/game-icons/light.png',
  fertilizer: '/game-icons/fertilizer-photoroom.png',
  soil: '/game-icons/soil-moisture.png',
  air: '/game-icons/air-humidity.png',
  soilTemp: '/game-icons/soil-temp.jpg',
  temp: '/game-icons/temperature.png',
  wateringCan: '/game-icons/care/watering-can.jpg',
  fertilizerCare: '/game-icons/fertilizer-photoroom.png',
  strawMulch: '/game-icons/care/straw-mulch-retention.png',
  shadeCloth: '/game-icons/care/shade-cloth.jpg',
  windbreak: '/game-icons/care/windbreak.jpg',
  frostCover: '/game-icons/care/frost-cover.jpg',
  aphid: '/game-icons/aphid.png',
  snail: '/game-icons/snail.png',
  fungus: '/game-icons/fungus.png',
  coin: '/game-icons/coin.png',
  uproot: '/game-icons/uproot.jpg',
  harvest: '/game-icons/harvest.jpg',
}
export const navItems = ['Home', 'Learn', 'Plant Lab', 'Shop', 'History', 'Community']
export const navTargets = {
  'Plant Lab': 'monitor',
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
  soil: { icon: 'soil', color: '#b58a5a', imageUrl: imageAssets.strawMulch },
  air: { icon: 'wind', color: '#9fd7ff', imageUrl: imageAssets.air },
  soilTemp: { icon: 'temp', color: '#d2a06d', imageUrl: imageAssets.soilTemp },
  temp: { icon: 'temp', color: '#f29b72', imageUrl: imageAssets.temp },
}

export const defaultClimate = {
  water: 100,
  light: 72,
  fertilizer: 100,
  soil: 62,
  air: 58,
  soilTemp: 25,
  temp: 29,
}



