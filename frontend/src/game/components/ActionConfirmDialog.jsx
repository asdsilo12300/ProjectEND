import { AppIcon } from '../icons/FontAwesomeIcon'

const ACTION_ICONS = {
  water: 'drop',
  fertilizer: 'fertilizer',
  drainage: 'soil',
  shade: 'shade',
  windbreak: 'wind',
  'frost-cover': 'frost',
}

export function ActionConfirmDialog({ asset, busy = false, language = 'en', onCancel, onConfirm }) {
  if (!asset) return null

  const isThai = language === 'th'
  const actionKey = asset.actionKey ?? asset.itemKey ?? asset.id
  const name = isThai ? (asset.nameTh || asset.name) : asset.name
  const detail = isThai ? (asset.detailTh || asset.detail) : asset.detail
  const outcome = isThai ? (asset.successTextTh || asset.successText) : asset.successText

  return (
    <div className="action-confirm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel?.()
    }}>
      <section className="action-confirm__dialog" role="alertdialog" aria-modal="true" aria-labelledby="action-confirm-title">
        <button className="action-confirm__close" type="button" disabled={busy} onClick={onCancel} aria-label={isThai ? 'ยกเลิกการใช้ไอเท็ม' : 'Cancel item action'}>
          <AppIcon name="close" />
        </button>
        <div className={`action-confirm__visual action-confirm__visual--${actionKey}`}>
          <span>
            {asset.imageUrl
              ? <img src={asset.imageUrl} alt="" draggable="false" />
              : <AppIcon name={ACTION_ICONS[actionKey] ?? 'tool'} />}
          </span>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>
        <div className="action-confirm__copy">
          <span>{isThai ? 'ยืนยันการใช้งาน' : 'Confirm use'}</span>
          <h2 id="action-confirm-title">{name}</h2>
          <p>{detail}</p>
          {outcome ? <strong><AppIcon name="check" />{outcome}</strong> : null}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onCancel}>{isThai ? 'ยกเลิก' : 'Cancel'}</button>
          <button type="button" disabled={busy} onClick={onConfirm}>
            <AppIcon name={busy ? 'live' : 'check'} />
            {busy ? (isThai ? 'กำลังใช้งาน…' : 'Applying…') : (isThai ? 'ยืนยันการใช้งาน' : 'Confirm use')}
          </button>
        </footer>
      </section>
    </div>
  )
}
