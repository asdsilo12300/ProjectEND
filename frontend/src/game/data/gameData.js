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
  { label: 'หอยทาก', value: 18, icon: 'snail', color: '#b58a5a' },
  { label: 'เพลี้ย', value: 24, icon: 'aphid', color: '#f29b72' },
  { label: 'เชื้อรา', value: 9, icon: 'fungus', color: '#c48bf2' },
]

export const climateIcons = {
  water: { icon: 'drop', color: '#67d5cf' },
  light: { icon: 'bolt', color: '#f7d35c' },
  fertilizer: { icon: 'plus', color: '#9bcf82' },
  soil: { icon: 'soil', color: '#b58a5a' },
  air: { icon: 'wind', color: '#9fd7ff' },
  temp: { icon: 'temp', color: '#f29b72' },
}

export const labLibrary = {
  Plants: [
    { id: 'sprout', name: 'Sprout', detail: 'Early stage', color: '#9bcf82', type: 'plant', icon: 'sprout', planted: true },
    { id: 'pea', name: 'Pea Shoot', detail: 'Climber', color: '#7fb069', type: 'plant', icon: 'vine', planted: false },
    { id: 'basil', name: 'Basil', detail: 'Herb sample', color: '#b8dea2', type: 'plant', icon: 'leaf', planted: false },
    { id: 'fern', name: 'Fern', detail: 'Shade tolerant', color: '#87b978', type: 'plant', icon: 'fern', planted: true },
  ],
  Items: [
    { id: 'water', name: 'Water', detail: '+ moisture', color: '#67d5cf', type: 'item', icon: 'drop' },
    { id: 'lamp', name: 'Lamp', detail: '+ light', color: '#f7d35c', type: 'item', icon: 'bolt' },
    { id: 'nutrient', name: 'Nutrient', detail: '+ growth', color: '#9bcf82', type: 'item', icon: 'plus' },
    { id: 'soil-kit', name: 'Soil Kit', detail: '+ roots', color: '#b58a5a', type: 'item', icon: 'soil' },
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

