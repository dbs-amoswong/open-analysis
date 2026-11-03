import { dia, shapes } from '@joint/core'

const start = performance.now()
const graph = new dia.Graph({}, { cellNamespace: shapes })
const paper = new dia.Paper({
  el: document.getElementById('graph'),
  model: graph,
  width: 1100,
  height: 620,
  gridSize: 10,
  cellViewNamespace: shapes,
  background: { color: '#ffffff' },
})
const nodes = []
for (let i = 0; i < 20; i += 1) {
  const node = new shapes.standard.Rectangle({
    id: `n${i}`,
    position: { x: 40 + (i % 5) * 205, y: 40 + Math.floor(i / 5) * 130 },
    size: { width: 130, height: 54 },
    attrs: {
      body: { fill: '#e9f1ff', stroke: '#3669a8', strokeWidth: 1.5, rx: 9, ry: 9 },
      label: { text: `Node ${i + 1}`, fill: '#172033', fontSize: 12 },
    },
  })
  nodes.push(node)
}
graph.addCells(nodes)
for (let i = 0; i < 20; i += 1) {
  graph.addCell(new shapes.standard.Link({
    source: { id: `n${i}` },
    target: { id: `n${(i + 3) % 20}` },
    attrs: { line: { stroke: '#8aa7c6', strokeWidth: 1.2, targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z' } } },
  }))
}
window.__spike = { lib: 'jointjs', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${nodes.length} nodes · 20 edges · core only`
