import { AppIcon } from './FontAwesomeIcon'

const navIconMap = {
  Home: 'home',
  Learn: 'bookmark',
  'Plant Lab': 'plant',
  Shop: 'shop',
  History: 'history',
  Community: 'groups',
  Settings: 'settings',
}

export function NavIcon({ type, className = '' }) {
  return <AppIcon className={className} name={navIconMap[type] ?? 'plant'} />
}
