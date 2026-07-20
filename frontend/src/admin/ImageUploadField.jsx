import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../game/icons/IconifyIcon'
import { resolveAssetUrl } from '../lib/api'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const maxImageBytes = 8 * 1024 * 1024

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function currentFileName(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value).split(/[?#]/, 1)[0].split('/').pop() || 'image')
  } catch {
    return 'image'
  }
}

export function ImageUploadField({ label, value, required = false, disabled = false, file, onFileChange, onRemove }) {
  const inputRef = useRef(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!(file instanceof File)) return undefined

    let cancelled = false
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (!cancelled) setFilePreviewUrl(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.readAsDataURL(file)

    return () => {
      cancelled = true
      reader.abort()
    }
  }, [file])

  const previewUrl = file instanceof File ? filePreviewUrl : resolveAssetUrl(value)

  function chooseFile(selectedFile) {
    if (!selectedFile) return
    if (!acceptedTypes.has(selectedFile.type)) {
      setError('Choose a JPG, PNG, WebP, or GIF image.')
      return
    }
    if (selectedFile.size > maxImageBytes) {
      setError('The image must be no larger than 8 MB.')
      return
    }

    setError('')
    onFileChange(selectedFile)
  }

  function clearSelection() {
    setError('')
    onFileChange(null)
  }

  return (
    <div className="admin-image-upload-field">
      <div className="admin-image-upload-field__heading">
        <span>{label}{required && <em>*</em>}</span>
        <small>JPG, PNG, WebP, or GIF · up to 8 MB</small>
      </div>

      <div className={`admin-image-upload-field__content ${previewUrl ? 'has-image' : ''}`}>
        <div className="admin-image-upload-field__preview">
          {previewUrl ? <img src={previewUrl} alt="" /> : <AppIcon name="camera" />}
        </div>
        <div className="admin-image-upload-field__details">
          <strong>{file?.name || currentFileName(value) || 'No image selected'}</strong>
          <span>{file ? `${formatBytes(file.size)} · ready to upload when you save` : value ? 'Current image · choose a file only when replacing it' : 'Choose an image from this device.'}</span>
          <div className="admin-image-upload-field__actions">
            <button disabled={disabled} type="button" onClick={() => inputRef.current?.click()}><AppIcon name="camera" />{file || value ? 'Replace image' : 'Choose image'}</button>
            {file && <button disabled={disabled} type="button" onClick={clearSelection}>Cancel replacement</button>}
            {!file && value && <button className="is-danger" disabled={disabled} type="button" onClick={onRemove}><AppIcon name="delete" />Remove image</button>}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        className="admin-image-upload-field__input"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={disabled}
        type="file"
        onChange={(event) => {
          chooseFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {error && <div className="admin-model-bundle-message is-error">{error}</div>}
    </div>
  )
}
