import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'

const HEALTHY_STATES = new Set(['', 'upright', 'normal', 'healthy'])

const LEAF_STRESS_PROFILES = {
  wilted: { leafDroop: 0.92, stemLean: 0.42, curl: 0.24, compression: 0.12, stiffness: 0.28 },
  drooping: { leafDroop: 1, stemLean: 0.24, curl: 0.12, compression: 0.16, stiffness: 0.18 },
  yellowing: { leafDroop: 0.3, stemLean: 0.16, curl: 0.08, compression: 0.08, stiffness: 0.34 },
  pale: { leafDroop: 0.24, stemLean: 0.18, curl: 0.05, compression: 0.1, stiffness: 0.3 },
  burnt_edges: { leafDroop: 0.46, stemLean: 0.24, curl: 0.88, compression: 0.18, stiffness: 0.82 },
  root_burn: { leafDroop: 0.7, stemLean: 0.58, curl: 0.72, compression: 0.22, stiffness: 0.76 },
  darkened: { leafDroop: 0.22, stemLean: 0.14, curl: 0.08, compression: 0.1, stiffness: 0.9 },
  spotted: { leafDroop: 0.38, stemLean: 0.2, curl: 0.18, compression: 0.12, stiffness: 0.48 },
  small: { leafDroop: 0.12, stemLean: 0.08, curl: 0.04, compression: 0.22, stiffness: 0.5 },
  dead: { leafDroop: 1, stemLean: 1, curl: 0.68, compression: 0.5, stiffness: 1 },
}

const STEM_STRESS_PROFILES = {
  leaning: { stemLean: 0.82, stiffness: 0.28 },
  soft: { stemLean: 0.62, compression: 0.2, stiffness: 0.18 },
  thin: { stemLean: 0.32, compression: 0.13, stiffness: 0.38 },
  dry: { stemLean: 0.48, compression: 0.16, stiffness: 0.84 },
  slow: { stemLean: 0.16, compression: 0.08, stiffness: 0.92 },
  short: { stemLean: 0.1, compression: 0.24, stiffness: 0.56 },
  dead: { stemLean: 1, compression: 0.5, stiffness: 1 },
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function normalizeState(value) {
  return String(value ?? '').trim().toLowerCase()
}

function mergeMaximum(base, addition) {
  return {
    leafDroop: Math.max(base.leafDroop, addition.leafDroop ?? 0),
    stemLean: Math.max(base.stemLean, addition.stemLean ?? 0),
    curl: Math.max(base.curl, addition.curl ?? 0),
    compression: Math.max(base.compression, addition.compression ?? 0),
    stiffness: Math.max(base.stiffness, addition.stiffness ?? 0),
  }
}

/**
 * Converts the visual state returned by the simulation engine into a stable,
 * normalized motion profile. It intentionally uses only values that are saved
 * with a simulation so History and Community replays reproduce the same pose.
 */
export function buildPlantStressProfile(visualOverrides = {}, health = 100, fungusRisk = 0) {
  const leafState = normalizeState(visualOverrides?.leafState)
  const stemState = normalizeState(visualOverrides?.stemState)
  const isDead = leafState === 'dead' || stemState === 'dead' || Number(health) <= 0
  const hasStateStress = !HEALTHY_STATES.has(leafState) || !HEALTHY_STATES.has(stemState)
  const healthStress = clamp01((100 - Math.max(0, Number(health) || 0)) / 72)
  const fungusStress = clamp01(Number(fungusRisk) / 100)

  let profile = {
    leafDroop: 0,
    stemLean: 0,
    curl: 0,
    compression: 0,
    stiffness: 0,
  }

  profile = mergeMaximum(profile, LEAF_STRESS_PROFILES[isDead ? 'dead' : leafState] ?? {})
  profile = mergeMaximum(profile, STEM_STRESS_PROFILES[isDead ? 'dead' : stemState] ?? {})

  // A named stress state remains visually readable even while health is still
  // high. As health falls, the same symptom grows progressively stronger.
  const stateIntensity = hasStateStress ? 0.48 + healthStress * 0.52 : healthStress * 0.22
  const fungusInfluence = fungusStress * (0.34 + healthStress * 0.18)

  return {
    leafDroop: clamp01(profile.leafDroop * stateIntensity + fungusInfluence * 0.34),
    stemLean: clamp01(profile.stemLean * stateIntensity + fungusInfluence * 0.14),
    curl: clamp01(profile.curl * stateIntensity + fungusInfluence * 0.26),
    compression: clamp01(profile.compression * stateIntensity + healthStress * 0.035),
    stiffness: clamp01(Math.max(profile.stiffness * stateIntensity, isDead ? 1 : 0)),
    severity: isDead ? 1 : clamp01(Math.max(healthStress, hasStateStress ? stateIntensity : 0, fungusInfluence)),
    isDead,
  }
}

function boneRole(name) {
  const normalized = normalizeState(name)
  if (/petal/.test(normalized)) return 'petal'
  if (/head|flower|bloom/.test(normalized)) return 'flower'
  if (/leaf|frond/.test(normalized)) return 'leaf'
  if (/stem|stalk|trunk/.test(normalized)) return 'stem'
  return null
}

function insertPivotAbove(object, name) {
  const parent = object?.parent
  if (!parent) return null

  const childIndex = parent.children.indexOf(object)
  const pivot = new Group()
  pivot.name = name

  parent.remove(object)
  parent.add(pivot)
  pivot.add(object)

  const insertedIndex = parent.children.indexOf(pivot)
  if (childIndex >= 0 && insertedIndex !== childIndex) {
    parent.children.splice(insertedIndex, 1)
    parent.children.splice(childIndex, 0, pivot)
  }

  return pivot
}

function insertPivotForChildren(parent, children, name) {
  if (!parent || children.length === 0) return null

  const firstIndex = Math.min(...children.map((child) => parent.children.indexOf(child)).filter((index) => index >= 0))
  const pivot = new Group()
  pivot.name = name
  parent.add(pivot)

  children.forEach((child) => {
    parent.remove(child)
    pivot.add(child)
  })

  const insertedIndex = parent.children.indexOf(pivot)
  if (Number.isFinite(firstIndex) && insertedIndex !== firstIndex) {
    parent.children.splice(insertedIndex, 1)
    parent.children.splice(firstIndex, 0, pivot)
  }

  return pivot
}

/**
 * Inserts identity transform groups above meaningful rig branches. Animation
 * clips keep targeting the original bones, while these new groups add stress
 * motion without overwriting or accumulating on the growth animation.
 */
export function attachPlantStressPivots(root, { upAxis = 'y' } = {}) {
  if (!root?.traverse) return []
  if (Array.isArray(root.userData?.plantStressPivots)) return root.userData.plantStressPivots

  const candidates = []
  root.traverse((object) => {
    if (!object.isBone || !object.parent) return

    const role = boneRole(object.name)
    if (!role) return

    const parentRole = object.parent?.isBone ? boneRole(object.parent.name) : null
    if (role === parentRole) return

    candidates.push({ object, role })
  })

  const entries = candidates.map(({ object, role }, index) => {
    const pivot = insertPivotAbove(object, `PlantStress_${role}_${index}`)
    return { object: pivot, role, index, upAxis }
  }).filter((entry) => entry.object)

  root.userData = {
    ...root.userData,
    plantStressPivots: entries,
  }

  return entries
}

/**
 * The bundled Elephant Ear uses four separate deforming bone fans per leaf.
 * Moving those fans independently twists the blade. Group them at the leaf
 * junction instead, and bend the upper stem from its first articulated joint.
 */
export function attachElephantEarStressPivots(root) {
  if (!root?.traverse) return []
  if (Array.isArray(root.userData?.elephantEarStressPivots) && root.userData.elephantEarStressPivots.length > 0) {
    return root.userData.elephantEarStressPivots
  }

  const bones = []
  root.traverse((object) => {
    if (object.isBone) bones.push(object)
  })

  const entries = []
  const stemRoots = bones.filter((bone) => /^stem[\s_]*bone[\s_]*1_/i.test(bone.name))
  stemRoots.forEach((stemRoot) => {
    const upperStemBones = stemRoot.children.filter(
      (child) => child.isBone && /^stem[\s_]*bone[\s_]*2_/i.test(child.name),
    )
    const pivot = insertPivotForChildren(
      stemRoot,
      upperStemBones,
      `ElephantStress_stem_${entries.length}`,
    )
    if (pivot) entries.push({
      object: pivot,
      role: 'stem',
      index: entries.length,
      upAxis: 'y',
      motionScale: 0.72,
    })
  })

  const leafJunctions = bones.filter((bone) => /^stem[\s_]*bone[\s_]*11_/i.test(bone.name))
  leafJunctions.forEach((junction) => {
    const leafFans = junction.children.filter(
      (child) => child.isBone && boneRole(child.name) === 'leaf',
    )
    const pivot = insertPivotForChildren(
      junction,
      leafFans,
      `ElephantStress_leaf_${entries.length}`,
    )
    if (pivot) entries.push({
      object: pivot,
      role: 'leaf',
      index: entries.length,
      upAxis: 'y',
      motionScale: 0.86,
    })
  })

  root.userData = {
    ...root.userData,
    elephantEarStressPivots: entries,
  }

  return entries
}

function resolvedEntries(entries) {
  const value = entries?.current ?? entries
  return Array.isArray(value) ? value.filter((entry) => entry?.object) : []
}

function targetForEntry(entry, profile, elapsed) {
  const index = Number(entry.index) || 0
  const direction = index % 2 === 0 ? 1 : -1
  const phase = elapsed * (0.72 + (index % 3) * 0.08) + index * 1.73
  const breezeStrength = profile.isDead
    ? 0.0035
    : (1 - profile.stiffness * 0.86) * (0.012 + (1 - profile.severity) * 0.012)
  const breeze = Math.sin(phase) * breezeStrength
  const crossBreeze = Math.cos(phase * 0.73) * breezeStrength * 0.62

  if (entry.role === 'stem') {
    const deadCollapse = profile.isDead ? 1 : 0
    return {
      x: profile.stemLean * (0.18 + deadCollapse * 0.14) + crossBreeze * 0.42,
      y: breeze * 0.18,
      z: direction * profile.stemLean * (0.2 + deadCollapse * 0.08) + breeze,
      scaleY: 1 - profile.compression * (0.095 + deadCollapse * 0.035),
    }
  }

  if (entry.role === 'flower') {
    return {
      x: profile.leafDroop * 0.19 + profile.stemLean * 0.08 + crossBreeze,
      y: breeze * 0.32,
      z: direction * (profile.curl * 0.11 + profile.leafDroop * 0.045) + breeze,
      scaleY: 1 - profile.compression * 0.06,
    }
  }

  if (entry.role === 'petal') {
    return {
      x: profile.leafDroop * 0.11 + profile.curl * 0.14 + crossBreeze * 0.5,
      y: direction * profile.curl * 0.055,
      z: direction * profile.curl * 0.13 + breeze * 0.45,
      scaleY: 1 - profile.compression * 0.075,
    }
  }

  const variation = 0.88 + (index % 4) * 0.075
  const deadCollapse = profile.isDead ? 1 : 0
  return {
    x: profile.leafDroop * (0.55 + deadCollapse * 0.25) * variation
      + profile.curl * (0.08 + deadCollapse * 0.1)
      + crossBreeze,
    y: direction * profile.curl * 0.045,
    z: direction * (
      profile.curl * (0.18 + deadCollapse * 0.07)
      + profile.leafDroop * (0.075 + deadCollapse * 0.035)
    ) + breeze,
    scaleY: 1 - profile.compression * (0.105 + deadCollapse * 0.035),
  }
}

function neutralStressProfile() {
  return {
    leafDroop: 0,
    stemLean: 0,
    curl: 0,
    compression: 0,
    stiffness: 0,
    severity: 0,
    isDead: false,
  }
}

function stressProfileSignature(profile) {
  return [
    profile.leafDroop,
    profile.stemLean,
    profile.curl,
    profile.compression,
    profile.stiffness,
    profile.severity,
    profile.isDead ? 1 : 0,
  ].map((value) => typeof value === 'number' ? value.toFixed(4) : value).join(':')
}

function stressTransitionDuration(from, target) {
  if (target.isDead && !from.isDead) return 2.8
  if (target.severity > from.severity + 0.04) return 1.9
  return 1.35
}

function easeInOutCubic(value) {
  const progress = clamp01(value)
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2
}

function interpolateStressProfile(from, target, progress) {
  const easedProgress = easeInOutCubic(progress)
  return {
    leafDroop: MathUtils.lerp(from.leafDroop, target.leafDroop, easedProgress),
    stemLean: MathUtils.lerp(from.stemLean, target.stemLean, easedProgress),
    curl: MathUtils.lerp(from.curl, target.curl, easedProgress),
    compression: MathUtils.lerp(from.compression, target.compression, easedProgress),
    stiffness: MathUtils.lerp(from.stiffness, target.stiffness, easedProgress),
    severity: MathUtils.lerp(from.severity, target.severity, easedProgress),
    // Switch after the collapse is visibly underway so the stronger dead pose
    // does not snap in on the first frame.
    isDead: target.isDead && easedProgress >= 0.24,
  }
}

/**
 * Smoothly animates stress pivots after the GLTF mixer has updated. Because the
 * pivots are not animation-track targets, changing factor values never fights
 * the original growth clip or causes frame-to-frame transform accumulation.
 */
export function usePlantStressMotion(entries, visualOverrides, health = 100, fungusRisk = 0) {
  const targetProfile = buildPlantStressProfile(visualOverrides, health, fungusRisk)
  const targetSignature = stressProfileSignature(targetProfile)
  const displayedProfileRef = useRef(neutralStressProfile())
  const transitionRef = useRef({
    from: neutralStressProfile(),
    to: targetProfile,
    startedAt: null,
    duration: stressTransitionDuration(neutralStressProfile(), targetProfile),
  })

  useEffect(() => {
    const from = { ...displayedProfileRef.current }
    transitionRef.current = {
      from,
      to: targetProfile,
      startedAt: null,
      duration: stressTransitionDuration(from, targetProfile),
    }
    // The scalar signature prevents unrelated API refreshes and React renders
    // from restarting an in-progress wilt/death transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSignature])

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime()
    const transition = transitionRef.current

    if (transition.startedAt === null) transition.startedAt = elapsed
    const transitionProgress = transition.duration <= 0
      ? 1
      : clamp01((elapsed - transition.startedAt) / transition.duration)
    const profile = interpolateStressProfile(transition.from, transition.to, transitionProgress)
    displayedProfileRef.current = profile

    const blend = 1 - Math.exp(-Math.min(Math.max(delta, 0), 0.1) * 9)

    resolvedEntries(entries).forEach((entry) => {
      const target = targetForEntry(entry, profile, elapsed)
      const pivot = entry.object
      const motionScale = Math.min(1, Math.max(0, Number(entry.motionScale) || 1))
      const targetRotation = entry.upAxis === 'z'
        ? { x: target.x, y: target.z, z: target.y }
        : entry.upAxis === 'x'
          ? { x: target.y, y: target.x, z: target.z }
          : target

      pivot.rotation.x = MathUtils.lerp(pivot.rotation.x, targetRotation.x * motionScale, blend)
      pivot.rotation.y = MathUtils.lerp(pivot.rotation.y, targetRotation.y * motionScale, blend)
      pivot.rotation.z = MathUtils.lerp(pivot.rotation.z, targetRotation.z * motionScale, blend)
      pivot.scale.x = MathUtils.lerp(pivot.scale.x, 1, blend)
      pivot.scale.y = MathUtils.lerp(pivot.scale.y, 1 - (1 - target.scaleY) * motionScale, blend)
      pivot.scale.z = MathUtils.lerp(pivot.scale.z, 1, blend)
    })
  })
}
