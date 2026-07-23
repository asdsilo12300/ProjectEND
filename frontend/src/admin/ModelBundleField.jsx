import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../game/icons/FontAwesomeIcon'

const supportedDependencyExtensions = new Set(['bin', 'png', 'jpg', 'jpeg', 'webp'])

function extension(file) {
  return String(file?.name ?? '').split('.').pop()?.toLowerCase() ?? ''
}

function relativePath(file) {
  const rawPath = String(file?.webkitRelativePath || file?.name || '').replaceAll('\\', '/')
  const segments = rawPath.split('/').filter(Boolean)
  if (file?.webkitRelativePath && segments.length > 1) segments.shift()
  return segments.join('/')
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function decodePath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function dependencyUris(document) {
  return [
    ...(Array.isArray(document?.buffers) ? document.buffers : []),
    ...(Array.isArray(document?.images) ? document.images : []),
  ]
    .map((entry) => entry?.uri)
    .filter((uri) => typeof uri === 'string' && uri.trim() && !uri.trim().toLowerCase().startsWith('data:'))
    .map((uri) => decodePath(uri.split(/[?#]/, 1)[0]).replaceAll('\\', '/').replace(/^\.\//, ''))
}

export function ModelBundleField({ label, value, required = false, disabled = false, bundle, onChange }) {
  const folderInputRef = useRef(null)
  const [error, setError] = useState('')
  const [inspection, setInspection] = useState(null)

  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.webkitdirectory = true
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!bundle?.model) {
      return () => { cancelled = true }
    }

    bundle.model.text()
      .then((text) => {
        const document = JSON.parse(text)
        const requiredFiles = dependencyUris(document)
        const uploadedPaths = (bundle.resources ?? []).map(relativePath)
        const matches = requiredFiles.map((requiredPath) => {
          const exact = uploadedPaths.filter((uploadedPath) => uploadedPath === requiredPath || uploadedPath.endsWith(`/${requiredPath}`))
          const candidates = exact.length ? exact : uploadedPaths.filter((uploadedPath) => uploadedPath.split('/').pop() === requiredPath.split('/').pop())
          return { requiredPath, candidates }
        })
        const missing = matches.filter(({ candidates }) => candidates.length === 0).map(({ requiredPath }) => requiredPath)
        const ambiguous = matches.filter(({ candidates }) => candidates.length > 1).map(({ requiredPath }) => requiredPath)
        if (!cancelled) setInspection({ valid: String(document?.asset?.version ?? '').startsWith('2'), requiredFiles, missing, ambiguous })
      })
      .catch(() => { if (!cancelled) setInspection({ valid: false, requiredFiles: [], missing: [] }) })

    return () => { cancelled = true }
  }, [bundle])

  const packageSize = useMemo(() => (
    Number(bundle?.model?.size ?? 0) + (bundle?.resources ?? []).reduce((sum, file) => sum + Number(file.size ?? 0), 0)
  ), [bundle])

  function choosePackage(fileList) {
    const files = Array.from(fileList ?? [])
    const models = files.filter((file) => extension(file) === 'gltf')
    const unsupported = files.filter((file) => extension(file) !== 'gltf' && !supportedDependencyExtensions.has(extension(file)))

    if (models.length !== 1) {
      setError(models.length ? 'Select a package containing only one main .gltf file.' : 'The package must include one main .gltf file.')
      return
    }
    if (unsupported.length) {
      setError(`Unsupported supporting file: ${unsupported[0].name}`)
      return
    }

    setError('')
    setInspection(null)
    onChange({ model: models[0], resources: files.filter((file) => file !== models[0]) })
  }

  const currentName = value ? decodePath(String(value).split(/[?#]/, 1)[0].split('/').pop() || 'model.gltf') : ''
  const ready = bundle?.model && inspection?.valid && !inspection?.missing?.length && !inspection?.ambiguous?.length

  return (
    <div className="admin-model-bundle-field">
      <div className="admin-model-bundle-field__heading">
        <span>{label}{required && <em>*</em>}</span>
        <small>GLTF 2.x · .bin and PNG/JPG/WebP textures</small>
      </div>

      {value && !bundle?.model && (
        <div className="admin-model-bundle-current"><i />Current model: <strong>{currentName}</strong><span>Choose a package below only when replacing it.</span></div>
      )}

      <div className={`admin-model-bundle-dropzone ${bundle?.model ? 'has-package' : ''}`}>
        <div>
          <strong>{bundle?.model ? bundle.model.name : 'Select the complete model package'}</strong>
          <span>{bundle?.model ? `${bundle.resources.length} supporting files · ${formatBytes(packageSize)}` : 'Include the .gltf, its .bin file, and every texture it uses.'}</span>
        </div>
        <div className="admin-model-bundle-actions">
          <label className="admin-file-button">
            <AppIcon name="uploadFile" />
            <span>Choose files</span>
            <input accept=".gltf,.bin,.png,.jpg,.jpeg,.webp" disabled={disabled} multiple type="file" onChange={(event) => { choosePackage(event.target.files); event.target.value = '' }} />
          </label>
          <label className="admin-file-button is-secondary">
            <AppIcon name="folderOpen" />
            <span>Choose folder</span>
            <input disabled={disabled} multiple ref={folderInputRef} type="file" onChange={(event) => { choosePackage(event.target.files); event.target.value = '' }} />
          </label>
          {bundle?.model && <button disabled={disabled} type="button" onClick={() => { setError(''); setInspection(null); onChange(null) }}>Clear</button>}
        </div>
      </div>

      {error && <div className="admin-model-bundle-message is-error">{error}</div>}
      {bundle?.model && inspection && !inspection.valid && <div className="admin-model-bundle-message is-error">This is not a valid GLTF 2.x JSON file.</div>}
      {bundle?.model && inspection?.missing?.length > 0 && <div className="admin-model-bundle-message is-error">Missing: {inspection.missing.join(', ')}</div>}
      {bundle?.model && inspection?.ambiguous?.length > 0 && <div className="admin-model-bundle-message is-error">Duplicate file names could match: {inspection.ambiguous.join(', ')}. Choose the model folder so relative paths are preserved.</div>}
      {ready && <div className="admin-model-bundle-message is-ready" role="status">Package ready · all {inspection.requiredFiles.length} referenced files were found.</div>}
    </div>
  )
}
