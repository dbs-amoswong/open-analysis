import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react'

setWasmUrl(`${import.meta.env.BASE_URL}dotlottie-player.wasm`)

const start = performance.now()

function Player({ label, src, onReady }) {
  return (
    <div className="player">
      <h2>{label}</h2>
      <DotLottieReact
        src={src}
        loop
        autoplay
        dotLottieRefCallback={(instance) => {
          if (!instance) return
          const check = () => {
            if (instance.isLoaded) onReady(instance)
            else setTimeout(check, 50)
          }
          check()
        }}
      />
    </div>
  )
}

function App() {
  const [ready, setReady] = useState({ lottie: false, json: false })
  const instances = useRef({})

  useEffect(() => {
    if (!ready.lottie || !ready.json) return
    const elapsed = Math.round(performance.now() - start)
    window.__spike = {
      lib: 'dotlottie-react',
      mount_ms: elapsed,
      formats: ['.lottie', 'json'],
      wasm: 'self-hosted',
      canvasCount: document.querySelectorAll('canvas').length,
      frames: {
        lottie: instances.current.lottie?.totalFrames ?? null,
        json: instances.current.json?.totalFrames ?? null,
      },
      react: React.version,
    }
    document.getElementById('status').textContent =
      `Loaded in ${elapsed} ms · .lottie + JSON · self-hosted WASM · React ${React.version}`
  }, [ready])

  const markReady = (kind) => (instance) => {
    instances.current[kind] = instance
    setReady((current) => (current[kind] ? current : { ...current, [kind]: true }))
  }

  return (
    <>
      <Player label="DotLottie .lottie" src={`${import.meta.env.BASE_URL}spike.lottie`} onReady={markReady('lottie')} />
      <Player label="Lottie JSON" src={`${import.meta.env.BASE_URL}spike.json`} onReady={markReady('json')} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
