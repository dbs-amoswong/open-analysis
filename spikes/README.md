# Browser spikes

These are deliberately small integrations used by `data/evaluations/`.

Each spike:

- creates 20 nodes and 20 edges,
- enables panning where the library supports it,
- measures mount time from the first application statement until the graph is populated,
- is built with Vite and screenshotted at 1200×800 in Chrome.

The screenshots live in `assets/evaluations/` and are copied into the static
site by `scripts/build.mjs`.

## Run a spike

```bash
cd spikes/x6-v2
npm install
npm run build
python3 -m http.server 4171 --directory dist
```

Open the printed URL. The runtime reports its own mount time in
`window.__spike` and in the footer.

## Rebuild an evaluation screenshot

From the repository root:

```bash
npx playwright screenshot --channel chrome \
  --viewport-size "1200,800" --wait-for-timeout 1500 \
  http://127.0.0.1:4171/ assets/evaluations/x6-v2.png
```

## Notes

- These are integration spikes, not full feature-parity benchmarks.
- GoJS is used under its evaluation licence; its screenshot contains the
  evaluation watermark and is not a production licence.
- The X6 v3 spike needs `tslib` added to the app because the published package
  does not declare it.
- `x6-v3-react/` is the React 19 + `@antv/x6-react-shape` 3.0.1 integration. It
  renders 20 React-rendered nodes, a node button updates component state, and
  selection works. It is browser-only.
- `cytoscape-react/` mounts Cytoscape 3.34.4 through a React 19 ref wrapper. It
  renders 20 nodes and 20 edges, selects a node through the core API, and does
  not use the stale `react-cytoscapejs` package.
- `sigma-react/` mounts Sigma 4.0.4 with graphology 0.26.0 through a React 19
  ref wrapper. It renders 20 nodes and 20 edges on WebGL2. This validates the
  technical path; graphology's maintenance status remains a policy hold.
- The formal comparison and caveats are in `data/evaluations/` and
  `docs/x6-v2-v3-audit.md`.

## Adapter prototype

`maxgraph-adapter/` demonstrates the application-owned `GraphAdapter` boundary:
`load`, `addNode`, `addEdge`, `select`, `snapshot`, `undo` and `redo`.

The load/add/select/snapshot path passes. Undo/redo is marked **partial**: the
prototype records edits through maxGraph's `UndoManager`, but the observed
undo/redo counts did not match the expected cell counts. Treat this as an
adapter-shape spike, not a finished undo implementation.
