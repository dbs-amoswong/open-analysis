import Drawflow from 'drawflow'
import 'drawflow/dist/drawflow.min.css'

const start = performance.now()
const editor = new Drawflow(document.getElementById('graph'))
editor.start()
const ids = []
for (let i = 0; i < 20; i += 1) {
  const id = editor.addNode(
    `Node ${i + 1}`,
    1,
    1,
    40 + (i % 5) * 205,
    40 + Math.floor(i / 5) * 130,
    'node',
    { label: `Node ${i + 1}` },
    `<div class="drawflow-node-title">Node ${i + 1}</div>`,
  )
  ids.push(id)
}
for (let i = 0; i < 20; i += 1) editor.addConnection(ids[i], ids[(i + 3) % 20], 'output_1', 'input_1')
window.__spike = { lib: 'drawflow', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${ids.length} nodes · 20 edges`
