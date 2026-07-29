/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'

const PlantAttachmentContext = createContext(null)

export function PlantAttachmentProvider({ children }) {
  const [attachments, setAttachments] = useState([])
  const value = useMemo(() => ({ attachments, setAttachments }), [attachments])

  return (
    <PlantAttachmentContext.Provider value={value}>
      {children}
    </PlantAttachmentContext.Provider>
  )
}

export function useRegisterPlantAttachments(attachments) {
  const context = useContext(PlantAttachmentContext)
  const setAttachments = context?.setAttachments

  useLayoutEffect(() => {
    if (!setAttachments || !Array.isArray(attachments)) return undefined

    setAttachments(attachments)
    return () => {
      setAttachments((current) => current === attachments ? [] : current)
    }
  }, [attachments, setAttachments])
}

export function usePlantAttachments() {
  return useContext(PlantAttachmentContext)?.attachments ?? []
}

function normalizedName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function attachmentFor(object, index, surface = 'leaf') {
  return {
    object,
    surface,
    position: surface === 'leaf' ? [0, 0.012, 0.016] : [0.008, 0.025, 0],
    rotation: surface === 'leaf'
      ? [Math.PI / 2, index * 0.37, index % 2 === 0 ? 0.12 : -0.12]
      : [0, index * 0.42, index % 2 === 0 ? 0.18 : -0.18],
  }
}

/**
 * Chooses one midrib bone from every Elephant Ear leaf. A portal rendered
 * into these bones inherits growth, wilt, wind and death deformation.
 */
export function collectElephantEarPestAttachments(root) {
  if (!root?.traverse) return []

  const leafJunctions = []
  root.traverse((object) => {
    if (object.isBone && /^stem[\s_]*bone[\s_]*11_/i.test(object.name)) {
      leafJunctions.push(object)
    }
  })

  return leafJunctions.map((junction, index) => {
    const leafBones = []
    junction.traverse((object) => {
      if (object.isBone && /leaf/i.test(object.name) && !/_end_/i.test(object.name)) {
        leafBones.push(object)
      }
    })

    const midrib = leafBones.find((bone) => /leaf_bonedown005_/i.test(bone.name))
      ?? leafBones.find((bone) => /leaf_bonedown004_/i.test(bone.name))
      ?? leafBones[Math.floor(leafBones.length * 0.45)]
      ?? junction

    return attachmentFor(midrib, index, 'leaf')
  })
}

/**
 * Uploaded plants use different bone names. Prefer stress pivots because they
 * already follow the procedural wilt pose, then fall back to leaf/petal bones.
 */
export function collectGenericPestAttachments(root) {
  if (!root?.traverse) return []

  const stressEntries = Array.isArray(root.userData?.plantStressPivots)
    ? root.userData.plantStressPivots
    : []
  const movingSurfaces = stressEntries.filter((entry) => ['leaf', 'petal', 'flower', 'stem'].includes(entry.role))

  if (movingSurfaces.length > 0) {
    return movingSurfaces.slice(0, 6).map((entry, index) => (
      attachmentFor(entry.object, index, entry.role === 'stem' ? 'stem' : 'leaf')
    ))
  }

  const preferredBones = []
  root.traverse((object) => {
    if (!object.isBone) return
    const name = normalizedName(object.name)
    if (/leaf|petal|flower|bloom/.test(name)) preferredBones.push({ object, surface: 'leaf' })
    else if (/stem|stalk/.test(name)) preferredBones.push({ object, surface: 'stem' })
  })

  if (preferredBones.length === 0) return []

  const step = Math.max(1, Math.floor(preferredBones.length / 6))
  return preferredBones
    .filter((_, index) => index % step === 0)
    .slice(0, 6)
    .map((entry, index) => attachmentFor(entry.object, index, entry.surface))
}
