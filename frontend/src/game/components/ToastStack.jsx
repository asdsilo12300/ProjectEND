import { AppIcon } from '../icons/FontAwesomeIcon'
import { getAppLanguage } from '../../i18n/appI18n'
import './ToastStack.css'

const toastMeta = {
  error: { icon: 'warning' },
  info: { icon: 'leaf' },
  progress: { icon: 'restartAlt' },
  success: { icon: 'check' },
  warning: { icon: 'warning' },
}

const toastLabels = {
  en: { error: 'Error', info: 'Notification', progress: 'In progress', success: 'Success', warning: 'Attention' },
  th: { error: 'ข้อผิดพลาด', info: 'การแจ้งเตือน', progress: 'กำลังดำเนินการ', success: 'สำเร็จ', warning: 'โปรดตรวจสอบ' },
}

export function ToastStack({ onDismiss, toasts = [] }) {
  if (!toasts.length) return null
  const language = getAppLanguage() === 'th' ? 'th' : 'en'
  const labels = toastLabels[language]

  return (
    <section className="game-toast-stack" aria-label={language === 'th' ? 'การแจ้งเตือนของระบบจำลอง' : 'Simulation notifications'} aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const meta = toastMeta[toast.type] ?? toastMeta.info

        return (
          <article className={`game-toast game-toast--${toast.type}`} key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="game-toast__icon" aria-hidden="true">
              <AppIcon className={toast.type === 'progress' ? 'game-toast__spinner' : ''} name={meta.icon} />
            </span>
            <div className="game-toast__content">
              <strong>{labels[toast.type] ?? labels.info}</strong>
              <p>{toast.message}</p>
            </div>
            <button className="game-toast__close" type="button" aria-label={language === 'th' ? 'ปิดการแจ้งเตือน' : 'Dismiss notification'} onClick={() => onDismiss(toast.id)}>×</button>
            <span className="game-toast__timer" aria-hidden="true" />
          </article>
        )
      })}
    </section>
  )
}
