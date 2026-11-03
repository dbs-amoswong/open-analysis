import { Graph } from '@antv/x6'
import { Selection } from '@antv/x6-plugin-selection'

const start = performance.now()
const graph = new Graph({
  container: document.getElementById('graph'),
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
    x: 40 + (i % 5) * 205,
    y: 40 + Math.floor(i / 5) * 130,
    width: 130,
    height: 54,
    label: `Node ${i + 1}`,
    attrs: {
      body: { fill: '#e9f1ff', stroke: '#3669a8', strokeWidth: 1.5, rx: 9, ry: 9 },
      label: { fill: '#172033', fontSize: 12 },
    },
  })
  nodes.push(node)
}
for (let i = 0; i < 20; i += 1) {
  graph.addEdge({
    source: nodes[i],
    target: nodes[(i + 3) % 20],
    attrs: { line: { stroke: '#8aa7c6', strokeWidth: 1.2, targetMarker: { name: 'block', width: 7, height: 7 } } },
  })
}
window.__spike = { lib: 'x6-v2', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${nodes.length} nodes · 20 edges`
