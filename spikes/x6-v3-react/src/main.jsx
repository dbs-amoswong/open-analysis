import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Graph, Selection } from '@antv/x6'
import { register, getProvider } from '@antv/x6-react-shape'

const start = performance.now()
const Provider = getProvider()

let clicks = 0
function ReactNode({ node }) {
  const [count, setCount] = React.useState(0)
  return (
    <div className="react-node">
      <span>{node.getData()?.label ?? node.id}</span>
      <button
        type="button"
        onClick={() => {
          clicks += 1
          setCount((value) => value + 1)
          window.__spike.clicks = clicks
          window.__spike.lastNode = node.id
        }}
      >
        {count === 0 ? 'Click' : `+${count}`}
      </button>
    </div>
  )
}

register({
  shape: 'spike-react-node',
  width: 130,
  height: 54,
  component: ReactNode,
})

function App() {
  const containerRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => {
    const graph = new Graph({
      container: containerRef.current,
      width: 1100,
      height: 620,
      grid: true,
      panning: true,
      background: { color: '#ffffff' },
    })
    graph.use(new Selection({ enabled: true, rubberband: true, showNodeSelectionBox: true }))

    const nodes = []
    for (let i = 0; i < 20; i += 1) {
      const node = graph.addNode({
        id: `n${i}`,
        shape: 'spike-react-node',
        x: 40 + (i % 5) * 205,
        y: 40 + Math.floor(i / 5) * 130,
        width: 130,
        height: 54,
        data: { label: `Node ${i + 1}` },
      })
      nodes.push(node)
    }
    for (let i = 0; i < 20; i += 1) {
      graph.addEdge({
        source: nodes[i],
        target: nodes[(i + 3) % 20],
        attrs: {
          line: {
            stroke: '#8aa7c6',
            strokeWidth: 1.2,
            targetMarker: { name: 'block', width: 7, height: 7 },
          },
        },
      })
    }

    graphRef.current = graph
    window.__spike = {
      lib: 'x6-v3-react',
      mount_ms: Math.round(performance.now() - start),
      nodes: 20,
      edges: 20,
      react: React.version,
      shape: 'spike-react-node',
      clicks: 0,
    }
    document.getElementById('status').textContent =
      `Mounted in ${window.__spike.mount_ms} ms · 20 React nodes · 20 edges · React ${React.version}`

    return () => graph.dispose()
  }, [])

  return (
    <>
      <Provider />
      <div id="graph" ref={containerRef} />
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
