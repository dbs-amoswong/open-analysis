import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import Graph from 'graphology'
import Sigma from 'sigma'

const start = performance.now()

function App() {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const graph = new Graph()
    const columns = 5
    for (let i = 0; i < 20; i += 1) {
      graph.addNode(`n${i}`, {
        x: 80 + (i % columns) * 160,
        y: 100 + Math.floor(i / columns) * 120,
        size: 14,
        label: `Node ${i + 1}`,
        color: '#e9f1ff',
      })
    }
    for (let i = 0; i < 20; i += 1) {
      graph.addEdge(`n${i}`, `n${(i + 3) % 20}`, {
        size: 1,
        color: '#8aa7c6',
      })
    }

    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      labelColor: { color: '#172033' },
      labelDensity: 0.2,
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 6,
      defaultNodeColor: '#e9f1ff',
      defaultEdgeColor: '#8aa7c6',
    })
    rendererRef.current = renderer
    window.__sigma = renderer
    window.__spike = {
      lib: 'sigma-react',
      mount_ms: Math.round(performance.now() - start),
      nodes: 20,
      edges: 20,
      react: React.version,
      webgl2: Boolean(containerRef.current.querySelector('canvas')?.getContext('webgl2')),
    }
    document.getElementById('status').textContent =
      `Mounted in ${window.__spike.mount_ms} ms · 20 nodes · 20 edges · React ${React.version} · WebGL2 ${window.__spike.webgl2}`

    return () => {
      renderer.kill()
    }
  }, [])

  return <div id="graph" ref={containerRef} />
}

createRoot(document.getElementById('root')).render(<App />)
