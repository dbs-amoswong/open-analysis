import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import cytoscape from 'cytoscape'

const start = performance.now()

const elements = []
for (let i = 0; i < 20; i += 1) {
  elements.push({
    data: { id: `n${i}`, label: `Node ${i + 1}` },
  })
}
for (let i = 0; i < 20; i += 1) {
  elements.push({
    data: { id: `e${i}`, source: `n${i}`, target: `n${(i + 3) % 20}` },
  })
}

function App() {
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  useEffect(() => {
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            width: 92,
            height: 36,
            'background-color': '#e9f1ff',
            'border-color': '#3669a8',
            'border-width': 1.5,
            color: '#172033',
            'font-size': 11,
            'text-valign': 'center',
            'text-halign': 'center',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.2,
            'line-color': '#8aa7c6',
            'target-arrow-color': '#8aa7c6',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#1d4ed8',
            'border-width': 3,
          },
        },
      ],
      layout: { name: 'grid', rows: 4, padding: 30 },
      wheelSensitivity: 0.2,
    })

    cy.on('tap', 'node', (event) => {
      const node = event.target
      window.__spike.lastNode = node.id()
      window.__spike.taps = (window.__spike.taps ?? 0) + 1
      document.getElementById('status').textContent =
        `Mounted in ${window.__spike.mount_ms} ms · ${window.__spike.nodes} nodes · ${window.__spike.edges} edges · last tap ${node.id()}`
    })

    cyRef.current = cy
    window.__cy = cy
    window.__spike = {
      lib: 'cytoscape-react',
      mount_ms: Math.round(performance.now() - start),
      nodes: 20,
      edges: 20,
      react: React.version,
      taps: 0,
    }
    document.getElementById('status').textContent =
      `Mounted in ${window.__spike.mount_ms} ms · 20 nodes · 20 edges · React ${React.version}`

    return () => cy.destroy()
  }, [])

  return <div id="graph" ref={containerRef} />
}

createRoot(document.getElementById('root')).render(<App />)
