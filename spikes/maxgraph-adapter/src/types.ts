export interface NodeData {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  label?: string
}

export interface EdgeData {
  id: string
  source: string
  target: string
  label?: string
}

export interface GraphSnapshot {
  nodes: NodeData[]
  edges: EdgeData[]
}

export interface GraphAdapter {
  mount(container: HTMLElement): void
  load(snapshot: GraphSnapshot): void
  addNode(node: NodeData): void
  addEdge(edge: EdgeData): void
  select(id: string): void
  undo(): void
  redo(): void
  snapshot(): GraphSnapshot
  canUndo(): boolean
  canRedo(): boolean
  destroy(): void
}
