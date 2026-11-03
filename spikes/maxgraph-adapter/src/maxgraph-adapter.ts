import { Graph, InternalEvent, UndoManager, type Cell } from '@maxgraph/core'
import type { EdgeData, GraphAdapter, GraphSnapshot, NodeData } from './types'

export class MaxGraphAdapter implements GraphAdapter {
  private graph?: Graph
  private parent?: Cell
  private undoManager?: UndoManager
  private nodeCells = new Map<string, Cell>()
  private edgeCells = new Map<string, Cell>()

  mount(container: HTMLElement): void {
    const graph = new Graph(container)
    graph.setPanning(true)
    this.graph = graph
    this.parent = graph.getDefaultParent() ?? graph.getDataModel().getRoot() ?? undefined
    this.undoManager = new UndoManager()

    const listener = (_sender: unknown, event: { getProperty: (key: string) => unknown }) => {
      const edit = event.getProperty('edit')
      if (edit) this.undoManager?.undoableEditHappened(edit as never)
    }
    graph.getDataModel().addListener(InternalEvent.UNDO, listener)
    graph.getView().addListener(InternalEvent.UNDO, listener)
  }

  load(snapshot: GraphSnapshot): void {
    const graph = this.requireGraph()
    this.nodeCells.clear()
    this.edgeCells.clear()
    const model = graph.getDataModel()
    const root = model.getRoot()
    const cells = (Object.values(model.cells ?? {}) as Cell[]).filter(
      (cell) => cell !== root && (cell.isVertex() || cell.isEdge()),
    )
    if (cells.length) graph.removeCells(cells)
    graph.batchUpdate(() => {
      for (const node of snapshot.nodes) this.addNode(node)
      for (const edge of snapshot.edges) this.addEdge(edge)
    })
  }

  addNode(node: NodeData): void {
    const graph = this.requireGraph()
    const cell = graph.insertVertex({
      parent: this.parent,
      position: [node.x, node.y],
      size: [node.width ?? 130, node.height ?? 54],
      value: node.label ?? node.id,
      style: {
        fillColor: '#e9f1ff',
        strokeColor: '#3669a8',
        rounded: true,
        fontColor: '#172033',
        fontSize: 12,
      },
    })
    cell.setId(node.id)
    this.nodeCells.set(node.id, cell)
  }

  addEdge(edge: EdgeData): void {
    const graph = this.requireGraph()
    const source = this.nodeCells.get(edge.source)
    const target = this.nodeCells.get(edge.target)
    if (!source || !target) throw new Error(`Edge ${edge.id} has an unknown endpoint`)
    const cell = graph.insertEdge({
      parent: this.parent,
      source,
      target,
      value: edge.label ?? '',
      style: { strokeColor: '#8aa7c6', rounded: true, edgeStyle: 'orthogonalEdgeStyle' },
    })
    cell.setId(edge.id)
    this.edgeCells.set(edge.id, cell)
  }

  select(id: string): void {
    const cell = this.nodeCells.get(id) ?? this.edgeCells.get(id)
    if (!cell) throw new Error(`Unknown cell ${id}`)
    this.requireGraph().setSelectionCell(cell)
  }

  undo(): void {
    this.undoManager?.undo()
  }

  redo(): void {
    this.undoManager?.redo()
  }

  canUndo(): boolean {
    return this.undoManager?.canUndo() ?? false
  }

  canRedo(): boolean {
    return this.undoManager?.canRedo() ?? false
  }

  snapshot(): GraphSnapshot {
    const graph = this.requireGraph()
    const nodes: NodeData[] = []
    const edges: EdgeData[] = []
    for (const cell of Object.values(graph.getDataModel().cells ?? {}) as Cell[]) {
      if (cell.isVertex()) {
        const geo = cell.getGeometry()
        nodes.push({
          id: cell.getId() ?? '',
          x: geo?.x ?? 0,
          y: geo?.y ?? 0,
          width: geo?.width ?? 0,
          height: geo?.height ?? 0,
          label: String(cell.getValue() ?? ''),
        })
      } else if (cell.isEdge()) {
        edges.push({
          id: cell.getId() ?? '',
          source: cell.getTerminal(true)?.getId() ?? '',
          target: cell.getTerminal(false)?.getId() ?? '',
          label: String(cell.getValue() ?? ''),
        })
      }
    }
    return { nodes, edges }
  }

  destroy(): void {
    this.graph?.destroy()
    this.graph = undefined
    this.nodeCells.clear()
    this.edgeCells.clear()
  }

  private requireGraph(): Graph {
    if (!this.graph) throw new Error('Adapter is not mounted')
    return this.graph
  }
}
