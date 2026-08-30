import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { resolveAssetUrl } from '../lib/api'

function isSvgReference(value) {
  const path = String(value ?? '').split(/[?#]/, 1)[0].toLowerCase()
  return path.endsWith('.svg')
}

export function IconSourceField({ disabled = false, file, label, language = 'en', onFileChange, onRemove, required = false, value = '' }) {
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const thai = language === 'th'

  useEffect(() => {
    if (!(file instanceof File)) return undefined
    let cancelled = false
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (!cancelled) setPreviewUrl(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.readAsDataURL(file)
    return () => {
      cancelled = true
      reader.abort()
    }
  }, [file])

  const svgUrl = file instanceof File ? previewUrl : (isSvgReference(value) ? resolveAssetUrl(value) : '')
  function chooseSvg(selectedFile) {
    if (!selectedFile) return
    if (selectedFile.type !== 'image/svg+xml' && !selectedFile.name.toLowerCase().endsWith('.svg')) {
      setError(thai ? 'กรุณาเลือกไฟล์ SVG เท่านั้น' : 'Choose an SVG file.')
      return
    }
    if (selectedFile.size > 512 * 1024) {
      setError(thai ? 'ไฟล์ SVG ต้องมีขนาดไม่เกิน 512 KB' : 'The SVG must be no larger than 512 KB.')
      return
    }
    setError('')
    onFileChange(selectedFile)
  }

  return (
    <section className="admin-icon-source-field is-wide">
      <div className="admin-icon-source-field__heading">
        <span>{label}{required && <em>*</em>}</span>
        <small>{thai ? 'รองรับไฟล์ SVG เท่านั้น' : 'SVG files only'}</small>
      </div>
      <div className="admin-icon-source-field__layout">
        <div className="admin-icon-source-field__preview">
          {svgUrl ? <img alt="" src={svgUrl} /> : <AppIcon name="uploadFile" />}
        </div>
        <div className="admin-icon-source-field__editor">
          <div className="admin-icon-source-field__upload">
            <strong>{file?.name || (svgUrl ? (thai ? 'ใช้ไฟล์ SVG ปัจจุบัน' : 'Current SVG icon') : (thai ? 'ยังไม่ได้เลือกไฟล์' : 'No SVG selected'))}</strong>
            <small>{thai ? 'ไฟล์ SVG ไม่เกิน 512 KB ระบบจะลบโค้ดที่ไม่ปลอดภัยก่อนบันทึก' : 'SVG up to 512 KB. Unsafe markup is removed before storage.'}</small>
            <div><button disabled={disabled} type="button" onClick={() => inputRef.current?.click()}><AppIcon name="uploadFile" />{thai ? 'เลือกไฟล์ SVG' : 'Choose SVG'}</button>{(file || svgUrl) && <button className="is-danger" disabled={disabled} type="button" onClick={() => { setPreviewUrl(''); onFileChange(null); onRemove() }}><AppIcon name="delete" />{thai ? 'นำออก' : 'Remove'}</button>}</div>
          </div>
        </div>
      </div>
      <input ref={inputRef} accept="image/svg+xml,.svg" className="admin-icon-source-field__input" disabled={disabled} type="file" onChange={(event) => { chooseSvg(event.target.files?.[0]); event.target.value = '' }} />
      {error && <div className="admin-model-bundle-message is-error">{error}</div>}
    </section>
  )
}
