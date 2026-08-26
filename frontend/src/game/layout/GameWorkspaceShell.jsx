import { AppIcon } from '../icons/FontAwesomeIcon'

const leftTabs = [
  { id: 'plants', icon: 'plant', th: 'พืช', en: 'Plants' },
  { id: 'tools', icon: 'shop', th: 'เครื่องมือ', en: 'Tools' },
  { id: 'monitor', icon: 'speed', th: 'ติดตาม', en: 'Monitor' },
]

const rightTabs = [
  { id: 'overview', icon: 'speed', th: 'ภาพรวม', en: 'Overview' },
  { id: 'comments', icon: 'chat', th: 'ความคิดเห็น', en: 'Comments' },
  { id: 'friends', icon: 'groups', th: 'เพื่อน', en: 'Friends' },
]

function clampPercent(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : fallback
}

function Metric({ color, icon, label, value }) {
  return (
    <div className="command-summary__metric">
      <span className="command-summary__metric-icon" style={{ '--metric-color': color }}><AppIcon name={icon} /></span>
      <span className="command-summary__metric-copy"><small>{label}</small><strong>{Math.round(value)}%</strong></span>
      <span className="command-summary__track" aria-hidden="true"><i style={{ width: `${value}%`, '--metric-color': color }} /></span>
    </div>
  )
}

function NeedGauge({ color, icon, label, value }) {
  return (
    <div className="command-summary__need" style={{ '--need-color': color }}>
      <span className="command-summary__need-label"><AppIcon name={icon} /><small>{label}</small><strong>{Math.round(value)}%</strong></span>
      <span className="command-summary__need-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(value)}>
        <i style={{ width: `${value}%` }} />
      </span>
    </div>
  )
}

export function GameWorkspaceShell({
  centerContent,
  commentUnreadCount = 0,
  language = 'en',
  leftCollapsed,
  leftLibrary,
  leftMonitor,
  leftTab,
  mode = 'greenhouse',
  onLeftCollapsedChange,
  onLeftTabChange,
  onRightCollapsedChange,
  onRightTabChange,
  plant,
  readOnly = false,
  rightCollapsed,
  rightComments,
  rightFriends,
  rightOverview,
  rightTab,
  simulationVisual,
}) {
  const isThai = language === 'th'
  const health = clampPercent(simulationVisual?.health, 100)
  const growth = clampPercent(simulationVisual?.growth_point ?? simulationVisual?.growth, 0)
  const pace = clampPercent(simulationVisual?.growth_rate, 0)
  const water = clampPercent(simulationVisual?.plant_needs?.water ?? simulationVisual?.water, 100)
  const nutrients = clampPercent(simulationVisual?.plant_needs?.fertilizer ?? simulationVisual?.fertilizer, 100)
  const modeLabel = mode === 'seasonal'
    ? (isThai ? 'ฤดูกาลจริง' : 'Seasonal journey')
    : mode === 'outdoor'
      ? (isThai ? 'กลางแจ้ง' : 'Outdoor')
      : (isThai ? 'ควบคุมปัจจัย' : 'Controlled')
  const plantName = plant?.name ?? simulationVisual?.plant?.plant_name ?? simulationVisual?.plant?.name ?? (isThai ? 'ยังไม่เลือกพืช' : 'No plant selected')
  const condition = health <= 0 ? 'critical' : health < 40 ? 'danger' : health < 70 ? 'warning' : 'stable'
  const unreadCommentLabel = commentUnreadCount > 99 ? '99+' : String(commentUnreadCount)

  const tabLabel = (tab) => {
    const label = isThai ? tab.th : tab.en
    if (tab.id !== 'comments' || commentUnreadCount <= 0) return label
    return isThai ? `${label} มี ${commentUnreadCount} รายการที่ยังไม่ได้อ่าน` : `${label}, ${commentUnreadCount} unread`
  }

  const tabBadge = (tab, compact = false) => tab.id === 'comments' && commentUnreadCount > 0 ? (
    <span className="command-tab__unread" data-compact={compact ? 'true' : 'false'} aria-hidden="true">{unreadCommentLabel}</span>
  ) : null

  return (
    <section
      className="game-command-center"
      data-left-collapsed={leftCollapsed ? 'true' : 'false'}
      data-right-collapsed={rightCollapsed ? 'true' : 'false'}
      data-read-only={readOnly ? 'true' : 'false'}
    >
      <aside className="command-rail command-rail--left command-rail--game-library" data-mode={mode} data-tour="lab-workspace" aria-label={isThai ? 'พื้นที่ทำงานห้องทดลอง' : 'Lab workspace'}>
        <header className="command-rail__header">
          {!leftCollapsed && <>
            <span className="command-library-signal" aria-hidden="true"><i /><i /><i /></span>
            <span className="command-rail__identity-icon"><AppIcon name="plant" /></span>
            <span className="command-rail__identity"><small>{modeLabel}</small><strong title={plantName}>{plantName}</strong></span>
          </>}
          <button className="command-icon-button" data-tour="lab-left-toggle" type="button" aria-label={leftCollapsed ? (isThai ? 'เปิดแถบซ้าย' : 'Open left rail') : (isThai ? 'พับแถบซ้าย' : 'Collapse left rail')} aria-expanded={!leftCollapsed} onClick={() => onLeftCollapsedChange(!leftCollapsed)}>
            <AppIcon name={leftCollapsed ? 'panelOpen' : 'panelClose'} />
          </button>
        </header>
        {leftCollapsed && (
          <nav className="command-collapsed-rail command-collapsed-rail--left" aria-label={isThai ? 'เมนูลัดพื้นที่ทำงาน' : 'Workspace shortcuts'}>
            <span className="command-collapsed-rail__asset command-collapsed-rail__asset--lab" aria-hidden="true" />
            {leftTabs.map((tab) => (
              <button key={`collapsed-${tab.id}`} type="button" title={isThai ? tab.th : tab.en} aria-label={isThai ? `เปิด${tab.th}` : `Open ${tab.en}`} onClick={() => { onLeftTabChange(tab.id); onLeftCollapsedChange(false) }}>
                <AppIcon name={tab.icon} />
              </button>
            ))}
            <span className="command-collapsed-rail__spine" aria-hidden="true"><i /><b>LAB</b><i /></span>
          </nav>
        )}
        <nav className="command-tabs command-tabs--left" role="tablist" aria-label={isThai ? 'ข้อมูลห้องทดลอง' : 'Lab information'}>
          {leftTabs.map((tab) => (
            <button key={tab.id} className="command-tab" data-active={leftTab === tab.id ? 'true' : 'false'} data-tour={`lab-tab-${tab.id}`} type="button" role="tab" aria-selected={leftTab === tab.id} title={isThai ? tab.th : tab.en} onClick={() => onLeftTabChange(tab.id)}>
              <AppIcon name={tab.icon} /><span>{isThai ? tab.th : tab.en}</span>
            </button>
          ))}
        </nav>
        <div className="command-rail__body">
          <div className="command-tab-panel" data-visible={leftTab === 'plants' || leftTab === 'tools' ? 'true' : 'false'} role="tabpanel">{leftLibrary}</div>
          <div className="command-tab-panel" data-visible={leftTab === 'monitor' ? 'true' : 'false'} role="tabpanel">{leftMonitor}</div>
        </div>
      </aside>

      <button
        className="command-drawer-trigger command-drawer-trigger--left"
        type="button"
        aria-label={leftCollapsed ? (isThai ? 'เปิดพื้นที่ทำงาน' : 'Open lab workspace') : (isThai ? 'ปิดพื้นที่ทำงาน' : 'Close lab workspace')}
        aria-expanded={!leftCollapsed}
        onClick={() => onLeftCollapsedChange(!leftCollapsed)}
      >
        <AppIcon name={leftCollapsed ? 'panelOpen' : 'panelClose'} />
        <span>{isThai ? 'ห้องทดลอง' : 'Lab'}</span>
      </button>

      <main className="command-center-stage">
        <div className="command-center-viewport">{centerContent}</div>
      </main>

      <aside className="command-rail command-rail--right command-rail--game-console" data-condition={condition} data-mode={mode} data-tour="lab-console" aria-label={isThai ? 'ข้อมูลตามบริบท' : 'Contextual information'}>
        <header className="command-rail__header command-rail__header--right">
          {!rightCollapsed && <>
            <span className="command-console-signal" aria-hidden="true"><i /><i /><i /></span>
            <span className="command-rail__identity"><small>{isThai ? 'สถานะปัจจุบัน' : 'Current status'}</small><strong>{readOnly ? (isThai ? 'ดูอย่างเดียว' : 'View only') : (isThai ? 'การจำลอง' : 'Live simulation')}</strong></span>
          </>}
          <button className="command-icon-button" data-tour="lab-right-toggle" type="button" aria-label={rightCollapsed ? (isThai ? 'เปิดแถบขวา' : 'Open right rail') : (isThai ? 'พับแถบขวา' : 'Collapse right rail')} aria-expanded={!rightCollapsed} onClick={() => onRightCollapsedChange(!rightCollapsed)}><AppIcon name={rightCollapsed ? 'panelClose' : 'panelOpen'} /></button>
        </header>
        {rightCollapsed && (
          <nav className="command-collapsed-rail command-collapsed-rail--right" aria-label={isThai ? 'เมนูลัดข้อมูลพืช' : 'Plant information shortcuts'}>
            <span className="command-collapsed-rail__asset command-collapsed-rail__asset--status" aria-hidden="true" />
            {rightTabs.map((tab) => (
              <button key={`collapsed-${tab.id}`} type="button" title={tabLabel(tab)} aria-label={isThai ? `เปิด${tabLabel(tab)}` : `Open ${tabLabel(tab)}`} onClick={() => { onRightTabChange(tab.id); onRightCollapsedChange(false) }}>
                <AppIcon name={tab.icon} />{tabBadge(tab, true)}
              </button>
            ))}
            <span className="command-collapsed-rail__spine" aria-hidden="true"><i /><b>DATA</b><i /></span>
          </nav>
        )}
        {!rightCollapsed && <>
          <section className="command-summary command-summary--game-console" data-tour="lab-status-summary" aria-label={isThai ? 'สรุปสถานะพืช' : 'Plant summary'}>
            <div className="command-summary__heading"><span><small>{isThai ? 'สรุปพืช' : 'Plant summary'}</small><strong>{plantName}</strong></span><span className="command-summary__status">{health <= 0 ? (isThai ? 'ตาย' : 'Dead') : growth >= 100 ? (isThai ? 'พร้อมเก็บเกี่ยว' : 'Harvest ready') : (isThai ? 'กำลังเติบโต' : 'Growing')}</span></div>
            <Metric color="#ff827a" icon="heart" label={isThai ? 'สุขภาพ' : 'Health'} value={health} />
            <Metric color="#8fd878" icon="plant" label={isThai ? 'การเติบโต' : 'Growth'} value={growth} />
            <Metric color="#b2f09c" icon="speed" label={isThai ? 'ความเร็ว' : 'Pace'} value={pace} />
            <div className="command-summary__needs">
              <NeedGauge color="#62d5f3" icon="drop" label={isThai ? 'น้ำ' : 'Water'} value={water} />
              <NeedGauge color="#ffd36a" icon="fertilizer" label={isThai ? 'ธาตุอาหาร' : 'Nutrients'} value={nutrients} />
            </div>
          </section>
          <nav className="command-tabs command-tabs--right" role="tablist" aria-label={isThai ? 'รายละเอียด' : 'Details'}>
            {rightTabs.map((tab) => <button key={tab.id} className="command-tab" data-active={rightTab === tab.id ? 'true' : 'false'} data-tour={`lab-tab-${tab.id}`} type="button" role="tab" aria-label={tabLabel(tab)} aria-selected={rightTab === tab.id} onClick={() => onRightTabChange(tab.id)}><AppIcon name={tab.icon} /><span>{isThai ? tab.th : tab.en}</span>{tabBadge(tab)}</button>)}
          </nav>
          <div className="command-rail__body command-rail__body--right">
            <div className="command-tab-panel" data-visible={rightTab === 'overview' ? 'true' : 'false'} role="tabpanel">{rightOverview}</div>
            <div className="command-tab-panel" data-visible={rightTab === 'comments' ? 'true' : 'false'} role="tabpanel">{rightComments}</div>
            <div className="command-tab-panel" data-visible={rightTab === 'friends' ? 'true' : 'false'} role="tabpanel">{rightFriends}</div>
          </div>
        </>}
      </aside>

      <button
        className="command-drawer-trigger command-drawer-trigger--right"
        type="button"
        aria-label={rightCollapsed ? (isThai ? 'เปิดข้อมูลพืช' : 'Open plant details') : (isThai ? 'ปิดข้อมูลพืช' : 'Close plant details')}
        aria-expanded={!rightCollapsed}
        onClick={() => onRightCollapsedChange(!rightCollapsed)}
      >
        <span>{isThai ? 'ข้อมูล' : 'Info'}</span>
        <AppIcon name={rightCollapsed ? 'panelClose' : 'panelOpen'} />
      </button>

      <nav className="command-mobile-navigation" aria-label={isThai ? 'เมนูพื้นที่จำลอง' : 'Simulation workspace navigation'}>
        {leftTabs.map((tab) => (
          <button key={`mobile-${tab.id}`} type="button" data-active={!leftCollapsed && leftTab === tab.id ? 'true' : 'false'} onClick={() => { onLeftTabChange(tab.id); onLeftCollapsedChange(false); onRightCollapsedChange(true) }}>
            <AppIcon name={tab.icon} /><span>{isThai ? tab.th : tab.en}</span>
          </button>
        ))}
        {rightTabs.slice(1).map((tab) => (
          <button key={`mobile-${tab.id}`} type="button" data-active={!rightCollapsed && rightTab === tab.id ? 'true' : 'false'} aria-label={tabLabel(tab)} onClick={() => { onRightTabChange(tab.id); onRightCollapsedChange(false); onLeftCollapsedChange(true) }}>
            <AppIcon name={tab.icon} /><span>{isThai ? tab.th : tab.en}</span>{tabBadge(tab)}
          </button>
        ))}
      </nav>
    </section>
  )
}
