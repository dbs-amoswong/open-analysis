import { LiteGraph, LGraph, LGraphCanvas } from 'litegraph.js'
import 'litegraph.js/css/litegraph.css'

function SpikeNode() {
  this.addInput('in', '')
  this.addOutput('out', '')
  this.size = [140, 60]
  this.properties = { label: 'node' }
}
SpikeNode.title = 'Spike node'
LiteGraph.registerNodeType('spike/node', SpikeNode)

const start = performance.now()
const canvas = document.getElementById('canvas')
canvas.width = 1100
canvas.height = 620
const graph = new LGraph()
new LGraphCanvas(canvas, graph)
const nodes = []
for (let i = 0; i < 20; i += 1) {
  const node = LiteGraph.createNode('spike/node')
  node.pos = [40 + (i % 5) * 205, 40 + Math.floor(i / 5) * 130]
  node.title = `Node ${i + 1}`
  graph.add(node)
  nodes.push(node)
}
for (let i = 0; i < 20; i += 1) nodes[i].connect(0, nodes[(i + 3) % 20], 0)
graph.start()
window.__spike = { lib: 'litegraph', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${nodes.length} nodes · 20 edges`
