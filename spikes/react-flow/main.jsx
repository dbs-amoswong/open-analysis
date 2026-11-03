import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlow, Background, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const start = performance.now()
const nodes = Array.from({ length: 20 }, (_, i) => ({
  id: `n${i}`,
  position: { x: 40 + (i % 5) * 205, y: 40 + Math.floor(i / 5) * 130 },
  data: { label: `Node ${i + 1}` },
  style: { width: 130, height: 54, borderRadius: 9, border: '1.5px solid #3669a8', background: '#e9f1ff', color: '#172033', fontSize: 12 },
}))
const edges = Array.from({ length: 20 }, (_, i) => ({
  id: `e${i}`,
  source: `n${i}`,
  target: `n${(i + 3) % 20}`,
  animated: false,
  style: { stroke: '#8aa7c6', strokeWidth: 1.2 },
}))

function App() {
  useEffect(() => {
    window.__spike = { lib: 'react-flow', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
    document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · 20 nodes · 20 edges · React ${React.version}`
  }, [])
  return <ReactFlow nodes={nodes} edges={edges} fitView><Background /><MiniMap /></ReactFlow>
}
createRoot(document.getElementById('root')).render(<App />)
