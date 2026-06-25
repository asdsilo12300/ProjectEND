import AddIcon from '@iconify-react/material-symbols/add'
import AirIcon from '@iconify-react/material-symbols/air'
import ArrowForwardIcon from '@iconify-react/material-symbols/arrow-forward-ios'
import BoltIcon from '@iconify-react/material-symbols/bolt'
import BugReportIcon from '@iconify-react/material-symbols/bug-report'
import CheckIcon from '@iconify-react/material-symbols/check'
import CompostIcon from '@iconify-react/material-symbols/compost'
import ConstructionIcon from '@iconify-react/material-symbols/construction'
import CrownIcon from '@iconify-react/material-symbols/crown'
import DeviceThermostatIcon from '@iconify-react/material-symbols/device-thermostat'
import EcoIcon from '@iconify-react/material-symbols/eco'
import FavoriteIcon from '@iconify-react/material-symbols/favorite'
import GrassIcon from '@iconify-react/material-symbols/grass'
import GroupsIcon from '@iconify-react/material-symbols/groups'
import HardwareIcon from '@iconify-react/material-symbols/hardware'
import HeadphonesIcon from '@iconify-react/material-symbols/headphones'
import HistoryIcon from '@iconify-react/material-symbols/history'
import KeyboardArrowDownIcon from '@iconify-react/material-symbols/keyboard-arrow-down'
import KeyboardArrowUpIcon from '@iconify-react/material-symbols/keyboard-arrow-up'
import LocalFloristIcon from '@iconify-react/material-symbols/local-florist'
import LogoutIcon from '@iconify-react/material-symbols/logout'
import MicrobiologyIcon from '@iconify-react/material-symbols/microbiology'
import MilitaryTechIcon from '@iconify-react/material-symbols/military-tech'
import MouseIcon from '@iconify-react/material-symbols/mouse'
import PestControlIcon from '@iconify-react/material-symbols/pest-control'
import PersonIcon from '@iconify-react/material-symbols/person'
import PrecisionManufacturingIcon from '@iconify-react/material-symbols/precision-manufacturing'
import PsychiatryIcon from '@iconify-react/material-symbols/psychiatry'
import RestartAltIcon from '@iconify-react/material-symbols/restart-alt'
import SaveIcon from '@iconify-react/material-symbols/save'
import SearchIcon from '@iconify-react/material-symbols/search'
import SendIcon from '@iconify-react/material-symbols/send'
import SettingsIcon from '@iconify-react/material-symbols/settings'
import ShieldIcon from '@iconify-react/material-symbols/shield'
import ShoppingBagIcon from '@iconify-react/material-symbols/shopping-bag'
import ShoppingCartIcon from '@iconify-react/material-symbols/shopping-cart'
import SmartToyIcon from '@iconify-react/material-symbols/smart-toy'
import SortIcon from '@iconify-react/material-symbols/sort'
import SportsEsportsIcon from '@iconify-react/material-symbols/sports-esports'
import StadiaControllerIcon from '@iconify-react/material-symbols/stadia-controller'
import ThumbUpIcon from '@iconify-react/material-symbols/thumb-up'
import WaterDropIcon from '@iconify-react/material-symbols/water-drop'

const iconMap = {
  add: AddIcon,
  air: AirIcon,
  aphid: BugReportIcon,
  arrowForward: ArrowForwardIcon,
  bolt: BoltIcon,
  bug: BugReportIcon,
  check: CheckIcon,
  controller: StadiaControllerIcon,
  crown: CrownIcon,
  drop: WaterDropIcon,
  eco: EcoIcon,
  fern: PsychiatryIcon,
  fungus: MicrobiologyIcon,
  groups: GroupsIcon,
  hardware: HardwareIcon,
  headset: HeadphonesIcon,
  heart: FavoriteIcon,
  history: HistoryIcon,
  leaf: EcoIcon,
  logout: LogoutIcon,
  mouse: MouseIcon,
  pest: PestControlIcon,
  person: PersonIcon,
  plant: LocalFloristIcon,
  plus: AddIcon,
  profile: PersonIcon,
  robot: SmartToyIcon,
  restartAlt: RestartAltIcon,
  save: SaveIcon,
  search: SearchIcon,
  send: SendIcon,
  settings: SettingsIcon,
  shield: ShieldIcon,
  shop: ShoppingBagIcon,
  shoppingCart: ShoppingCartIcon,
  snail: PestControlIcon,
  soil: CompostIcon,
  sort: SortIcon,
  sprout: LocalFloristIcon,
  switch: SportsEsportsIcon,
  temp: DeviceThermostatIcon,
  thumbUp: ThumbUpIcon,
  tool: ConstructionIcon,
  trophy: MilitaryTechIcon,
  vine: GrassIcon,
  wind: AirIcon,
  arrowDown: KeyboardArrowDownIcon,
  arrowUp: KeyboardArrowUpIcon,
  axe: ConstructionIcon,
  gun: PrecisionManufacturingIcon,
}

export function AppIcon({ name, className = '', label, ...props }) {
  const Icon = iconMap[name] ?? EcoIcon

  return (
    <Icon
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      role={label ? 'img' : undefined}
      {...props}
    />
  )
}

