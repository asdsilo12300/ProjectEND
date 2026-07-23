import { useEffect, useRef } from 'react'
import './ParticleNetworkBackground.css'

const palettes = {
  green: {
    accent: '224, 197, 112',
    dot: '167, 222, 143',
    glow: '151, 217, 121',
    line: '142, 205, 116',
  },
  history: {
    accent: '145, 185, 244',
    dot: '154, 225, 191',
    glow: '108, 167, 239',
    line: '121, 197, 172',
  },
  community: {
    accent: '190, 137, 255',
    dot: '176, 226, 139',
    glow: '153, 112, 218',
    line: '153, 198, 130',
  },
  shop: {
    accent: '243, 206, 122',
    dot: '163, 226, 174',
    glow: '233, 185, 95',
    line: '202, 187, 112',
  },
}

export function ParticleNetworkBackground({ variant = 'green' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.closest('.particle-network-surface')
    const context = canvas?.getContext('2d')
    const palette = palettes[variant] ?? palettes.green
    if (!canvas || !host || !context) return undefined

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = document.documentElement
    const pointer = { x: -1000, y: -1000, active: false }
    let particles = []
    let frameId = 0
    let width = 1
    let height = 1
    let visible = true
    let reducedMotion = false
    let previousTime = performance.now()

    function prefersReducedMotion() {
      return motionQuery.matches || root.classList.contains('settings-reduced-motion')
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = Math.max(1, Math.round(bounds.width))
      height = Math.max(1, Math.round(bounds.height))
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      const particleCount = Math.min(90, Math.max(55, Math.round((width * height) / 12000)))
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1 + Math.random() * 1.35,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }))
    }

    function drawNetwork(timestamp, animate) {
      const delta = Math.min(2.2, Math.max(0.5, (timestamp - previousTime) / 16.67))
      previousTime = timestamp
      context.clearRect(0, 0, width, height)

      if (animate) {
        particles.forEach((particle) => {
          particle.x += particle.vx * delta
          particle.y += particle.vy * delta

          if (pointer.active) {
            const dx = particle.x - pointer.x
            const dy = particle.y - pointer.y
            const distance = Math.hypot(dx, dy) || 1
            const radius = 145
            if (distance < radius) {
              const force = ((radius - distance) / radius) * 2.8 * delta
              particle.x += (dx / distance) * force
              particle.y += (dy / distance) * force
            }
          }

          if (particle.x < -8 || particle.x > width + 8) particle.vx *= -1
          if (particle.y < -8 || particle.y > height + 8) particle.vy *= -1
          particle.x = Math.min(width + 7, Math.max(-7, particle.x))
          particle.y = Math.min(height + 7, Math.max(-7, particle.y))
        })
      }

      const connectionDistance = Math.min(175, Math.max(135, width * 0.14))
      for (let first = 0; first < particles.length; first += 1) {
        for (let second = first + 1; second < particles.length; second += 1) {
          const a = particles[first]
          const b = particles[second]
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (distance >= connectionDistance) continue
          const opacity = (1 - distance / connectionDistance) * 0.62
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.strokeStyle = `rgba(${palette.line}, ${opacity})`
          context.lineWidth = 0.75
          context.stroke()
        }
      }

      particles.forEach((particle, index) => {
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fillStyle = index % 5 === 0 ? `rgba(${palette.accent}, 0.84)` : `rgba(${palette.dot}, 0.9)`
        context.shadowColor = `rgba(${palette.glow}, 0.46)`
        context.shadowBlur = 7
        context.fill()
      })
      context.shadowBlur = 0
    }

    function tick(timestamp) {
      drawNetwork(timestamp, true)
      frameId = window.requestAnimationFrame(tick)
    }

    function restartAnimation() {
      window.cancelAnimationFrame(frameId)
      frameId = 0
      reducedMotion = prefersReducedMotion()
      previousTime = performance.now()
      if (!visible) return
      if (reducedMotion) drawNetwork(previousTime, false)
      else frameId = window.requestAnimationFrame(tick)
    }

    function handlePointerMove(event) {
      if (reducedMotion || event.pointerType === 'touch') return
      const bounds = canvas.getBoundingClientRect()
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top
      pointer.active = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height
    }

    function handlePointerLeave() {
      pointer.active = false
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
      restartAnimation()
    })
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      restartAnimation()
    }, { rootMargin: '120px' })
    const settingsObserver = new MutationObserver(restartAnimation)

    resizeCanvas()
    restartAnimation()
    resizeObserver.observe(canvas)
    visibilityObserver.observe(host)
    settingsObserver.observe(root, { attributes: true, attributeFilter: ['class'] })
    host.addEventListener('pointermove', handlePointerMove, { passive: true })
    host.addEventListener('pointerleave', handlePointerLeave)
    motionQuery.addEventListener('change', restartAnimation)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      settingsObserver.disconnect()
      host.removeEventListener('pointermove', handlePointerMove)
      host.removeEventListener('pointerleave', handlePointerLeave)
      motionQuery.removeEventListener('change', restartAnimation)
    }
  }, [variant])

  return (
    <div className="particle-network-background" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
