import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Lottie } from 'lottie-react'
import animationData from '../../lottie-assets/spike.json'

const start = performance.now()

function App() {
  useEffect(() => {
    let cancelled = false
    const check = () => {
      if (cancelled) return
      const svg = document.querySelector('#root svg')
      const canvas = document.querySelector('#root canvas')
      if (!svg && !canvas) {
        setTimeout(check, 50)
        return
      }
      window.__spike = {
        lib: 'lottie-react',
        mount_ms: Math.round(performance.now() - start),
        renderer: svg ? 'svg' : 'canvas',
        format: 'json',
        react: React.version,
      }
      document.getElementById('status').textContent =
        `Mounted in ${window.__spike.mount_ms} ms · ${window.__spike.renderer} · React ${React.version}`
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Lottie
      src={animationData}
      loop
      autoplay
      style={{ width: '100%', height: '100%' }}
    />
  )
}

createRoot(document.getElementById('root')).render(<App />)
