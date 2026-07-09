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
}
export const navItems = ['Plant Lab', 'Shop', 'History', 'Community']
export const navTargets = {
  'Plant Lab': 'monitor',
  Shop: 'climate',
  History: 'comments',
  Community: 'friends',
}
export const comments = [
  {
    author: 'Mina Chen',
    role: 'Student',
    posted: 'Today, 09:12',
    body: 'When I reduced light and kept water stable, the sprout grew slower but stayed healthy. I want to compare this with high fertilizer next.',
    likes: 12,
  },
  {
    author: 'Mr. Arun',
    role: 'Teacher',
    posted: 'Yesterday, 15:40',
    body: 'Good observation. For the next run, change only one variable at a time so the comparison is easier to explain.',
    likes: 8,
  },
]

export const friends = [
  { name: 'Tearchoi', handle: '@Tearchoi', role: 'Student', status: 'Online', color: '#9bcf82' },
  { name: 'Brassel', handle: '@Brassel', role: 'Student', status: 'Online', color: '#7fb069' },
  { name: 'JuzMyhero', handle: '@JuzMyhero', role: 'Student', status: 'Offline', color: '#b8dea2' },
  { name: 'VividLol', handle: '@VividLol', role: 'Student', status: 'Offline', color: '#87b978' },
  { name: 'Mina Chen', handle: '@MinaLab', role: 'Student', status: 'Online', color: '#9bcf82' },
  { name: 'Mr. Arun', handle: '@ArunClass', role: 'Teacher', status: 'Online', color: '#d8f3c9' },
]

export const growthChartSeries = [
  {
    name: 'Growth points',
    data: [6500, 6418, 6456, 6526, 6356, 6456, 6724],
  },
]

export const plantStats = [
  { label: 'Health', value: 100, icon: 'heart', color: '#ef6f61' },
  { label: 'Growth', value: 18, icon: 'leaf', color: '#9bcf82' },
  { label: 'Pest Risk', value: 12, icon: 'shield', color: '#c48bf2' },
]

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

export const labLibrary = {
  Plants: [
    { id: 'sprout', name: 'à¸•à¹‰à¸™à¸«à¸¹à¸Šà¹‰à¸²à¸‡', detail: 'Elephant ear', color: '#9bcf82', type: 'plant', icon: 'sprout', imageUrl: imageAssets.plant, planted: true },
    { id: 'pea', name: 'Pea Shoot', detail: 'Climber', color: '#7fb069', type: 'plant', icon: 'vine', imageUrl: imageAssets.plant, planted: false },
    { id: 'basil', name: 'Basil', detail: 'Herb sample', color: '#b8dea2', type: 'plant', icon: 'leaf', imageUrl: imageAssets.plant, planted: false },
    { id: 'fern', name: 'Fern', detail: 'Shade tolerant', color: '#87b978', type: 'plant', icon: 'fern', imageUrl: imageAssets.plant, planted: true },
  ],
  Items: [
    {
      id: 'hand-pick',
      itemKey: 'hand-pick',
      name: 'Hand Pick',
      detail: 'aphid + snail',
      color: '#9bcf82',
      type: 'item',
      icon: 'hand',
      imageUrl: imageAssets.hand,
      targetImages: [{ label: 'Aphid', imageUrl: imageAssets.aphid }, { label: 'Snail', imageUrl: imageAssets.snail }],
      quantityLabel: 'Manual',
      successText: 'Aphid 40% / Snail 80%',
      failText: 'Aphid fail 60% / Snail fail 20%',
      help: 'Manual removal: aphids succeed 40% and snails succeed 80%. No spray is consumed.',
    },
    {
      id: 'insecticide-spray',
      itemKey: 'insecticide-spray',
      name: 'Insect Spray',
      detail: 'clears aphids',
      color: '#67d5cf',
      type: 'item',
      icon: 'hand',
      imageUrl: imageAssets.insecticide,
      targetImages: [{ label: 'Aphid', imageUrl: imageAssets.aphid }],
      successText: 'Success 100%',
      failText: 'Fail 0%',
      help: 'Spray for aphids. Removes active aphids with 100% success. Costs 50 coins in shop.',
    },
    {
      id: 'snail-spray',
      itemKey: 'snail-spray',
      name: 'Snail Spray',
      detail: 'clears snails',
      color: '#b58a5a',
      type: 'item',
      icon: 'hand',
      imageUrl: imageAssets.snailSpray,
      targetImages: [{ label: 'Snail', imageUrl: imageAssets.snail }],
      successText: 'Success 100%',
      failText: 'Fail 0%',
      help: 'Spray for snails. Removes active snails with 100% success. Costs 25 coins in shop.',
    },
    {
      id: 'antifungal-spray',
      itemKey: 'antifungal-spray',
      name: 'Fungus Spray',
      detail: 'clears fungus',
      color: '#c48bf2',
      type: 'item',
      icon: 'hand',
      imageUrl: imageAssets.antifungal,
      targetImages: [{ label: 'Fungus', imageUrl: imageAssets.fungus }],
      successText: 'Success 100%',
      failText: 'Fail 0%',
      help: 'Spray for fungus. Removes active fungus with 100% success.',
    },
  ],
}

export const defaultClimate = {
  water: 55,
  light: 72,
  fertilizer: 35,
  soil: 62,
  air: 58,
  temp: 29,
}



