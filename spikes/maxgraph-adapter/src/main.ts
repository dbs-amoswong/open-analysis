import { MaxGraphAdapter } from './maxgraph-adapter'
import type { GraphSnapshot } from './types'

const start = performance.now()
const adapter = new MaxGraphAdapter()
adapter.mount(document.getElementById('graph') as HTMLElement)

function baseSnapshot(): GraphSnapshot {
  const nodes = Array.from({ length: 20 }, (_, i) => ({
    id: `n${i}`,
    x: 40 + (i % 5) * 205,
    y: 40 + Math.floor(i / 5) * 130,
    label: `Node ${i + 1}`,
  }))
  const edges = Array.from({ length: 20 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${(i + 3) % 20}`,
  }))
  return { nodes, edges }
}

let lastNode = 20
let lastEdge = 20
adapter.load(baseSnapshot())
const output = document.getElementById('output') as HTMLElement
const status = document.getElementById('status') as HTMLElement
function render(message?: string) {
  const snapshot = adapter.snapshot()
  output.textContent = JSON.stringify({
    message: message ?? 'snapshot',
    canUndo: adapter.canUndo(),
    canRedo: adapter.canRedo(),
    nodes: snapshot.nodes.length,
    edges: snapshot.edges.length,
    sample: snapshot.nodes.slice(0, 2),
  }, null, 2)
}
document.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => {
    const action = (button as HTMLButtonElement).dataset.action
    if (action === 'load') adapter.load(baseSnapshot())
    if (action === 'add-node') {
      adapter.addNode({ id: `new-node-${lastNode}`, x: 80 + (lastNode % 3) * 50, y: 560, label: `New ${lastNode + 1}` })
      lastNode += 1
    }
    if (action === 'add-edge') {
      adapter.addEdge({ id: `new-edge-${lastEdge}`, source: `n${lastEdge % 20}`, target: `n${(lastEdge + 7) % 20}` })
      lastEdge += 1
    }
    if (action === 'select') adapter.select(snapshotLastNode())
    if (action === 'undo') adapter.undo()
    if (action === 'redo') adapter.redo()
    render(action ?? 'snapshot')
  })
})
function snapshotLastNode() {
  const nodes = adapter.snapshot().nodes
  return nodes[nodes.length - 1]?.id ?? 'n0'
}
render('initial load')
const spike = { lib: 'maxgraph-adapter', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
;(window as any).__spike = spike
status.textContent = `Mounted in ${spike.mount_ms} ms · adapter operations ready · state in the panel`
