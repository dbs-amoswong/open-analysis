import { Graph, InternalEvent } from '@maxgraph/core'

const container = document.getElementById('graph')
InternalEvent.disableContextMenu(container)
const start = performance.now()
const graph = new Graph(container)
graph.setPanning(true)
const parent = graph.getDefaultParent()
const nodes = []
graph.batchUpdate(() => {
  for (let i = 0; i < 20; i += 1) {
    const node = graph.insertVertex({
      parent,
      position: [40 + (i % 5) * 205, 40 + Math.floor(i / 5) * 130],
      size: [130, 54],
      value: `Node ${i + 1}`,
      style: { fillColor: '#e9f1ff', strokeColor: '#3669a8', rounded: true, fontColor: '#172033', fontSize: 12 },
    })
    nodes.push(node)
  }
  for (let i = 0; i < 20; i += 1) {
    graph.insertEdge({
      parent,
      source: nodes[i],
      target: nodes[(i + 3) % 20],
      value: '',
      style: { strokeColor: '#8aa7c6', rounded: true, edgeStyle: 'orthogonalEdgeStyle' },
    })
  }
})
window.__spike = { lib: 'maxgraph', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${nodes.length} nodes · 20 edges`
