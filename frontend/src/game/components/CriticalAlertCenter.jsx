import { AppIcon } from '../icons/FontAwesomeIcon'
import { getAppLanguage } from '../../i18n/appI18n'

export function CriticalAlertCenter({ alert, onClose }) {
  if (!alert) return null
  const isThai = getAppLanguage() === 'th'
  const tone = alert.tone ?? 'warning'
  return (
    <div className="critical-alert-center" role="alertdialog" aria-live="assertive">
      <div className={`critical-alert-center__card critical-alert-center__card--${tone}`}>
        <span className="critical-alert-center__icon"><AppIcon name={tone === 'danger' ? 'warning' : tone === 'success' ? 'check' : 'info'} /></span>
        <div className="min-w-0 flex-1">
          <strong>{alert.title}</strong>
          {alert.message && <p>{alert.message}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={isThai ? 'ปิดการแจ้งเตือน' : 'Close alert'}><AppIcon name="close" /></button>
      </div>
    </div>
  )
}
