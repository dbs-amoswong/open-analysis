import * as go from 'gojs'

const start = performance.now()
const diagram = new go.Diagram('graph', { 'undoManager.isEnabled': true, layout: new go.GridLayout({ cellSize: new go.Size(180, 80), spacing: new go.Size(25, 25), wrappingColumn: 5 }) })
const $ = go.GraphObject.make
diagram.nodeTemplate = $(
  go.Node,
  'Auto',
  $(go.Shape, 'RoundedRectangle', { fill: '#e9f1ff', stroke: '#3669a8', strokeWidth: 1.5, parameter1: 9, parameter2: 9 }),
  $(go.TextBlock, { margin: 8, font: '12px sans-serif', stroke: '#172033' }, new go.Binding('text', 'label')),
)
diagram.linkTemplate = $(
  go.Link,
  { routing: go.Link.Orthogonal, corner: 6 },
  $(go.Shape, { stroke: '#8aa7c6', strokeWidth: 1.2 }),
  $(go.Shape, { toArrow: 'Standard', fill: '#8aa7c6', stroke: null, scale: 0.8 }),
)
const nodes = Array.from({ length: 20 }, (_, i) => ({ key: i, label: `Node ${i + 1}` }))
const links = Array.from({ length: 20 }, (_, i) => ({ from: i, to: (i + 3) % 20 }))
diagram.model = new go.GraphLinksModel(nodes, links)
window.__spike = { lib: 'gojs', mount_ms: Math.round(performance.now() - start), nodes: 20, edges: 20 }
document.getElementById('status').textContent = `Mounted in ${window.__spike.mount_ms} ms · ${nodes.length} nodes · 20 edges · evaluation licence`
