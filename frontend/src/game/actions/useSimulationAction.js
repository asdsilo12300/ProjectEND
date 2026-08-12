import { useCallback, useEffect, useRef, useState } from 'react'

const initialState = {
  phase: 'idle',
  asset: null,
  error: null,
  result: null,
}

export function useSimulationAction() {
  const [state, setState] = useState(initialState)
  const timerRef = useRef(null)
  const selectedRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const select = useCallback((asset) => {
    clearTimer()
    selectedRef.current = asset ?? null
    setState({ phase: asset ? 'targeting' : 'idle', asset: asset ?? null, error: null, result: null })
  }, [clearTimer])

  const cancel = useCallback(() => {
    clearTimer()
    selectedRef.current = null
    setState(initialState)
  }, [clearTimer])

  const execute = useCallback(async (apply, directAsset = null) => {
    clearTimer()
    const selected = directAsset ?? selectedRef.current
    if (!selected) return null
    selectedRef.current = selected
    setState({ phase: 'animating', asset: selected, error: null, result: null })

    // Keep the physical care action visible long enough to read as an action,
    // not a flash. The authoritative change is still applied only afterwards.
    await new Promise((resolve) => {
      timerRef.current = window.setTimeout(resolve, 1800)
    })
    setState((current) => ({ ...current, phase: 'applying' }))

    try {
      const result = await apply(selected)
      setState((current) => ({ ...current, phase: 'success', result }))
      timerRef.current = window.setTimeout(() => {
        selectedRef.current = null
        setState(initialState)
      }, 950)
      return result
    } catch (error) {
      setState((current) => ({ ...current, phase: 'error', error }))
      timerRef.current = window.setTimeout(() => {
        selectedRef.current = null
        setState(initialState)
      }, 1400)
      throw error
    }
  }, [clearTimer])

  return { actionState: state, selectAction: select, executeAction: execute, cancelAction: cancel }
}
