# X6 v2 vs v3 audit

Date: 2026-11-04

This note audits the X6 v2/v3 comparison against the package registry and the
actual npm tarballs. It is the evidence behind `req-legacy-graph` and supersedes
the earlier mixed-version review in PR #10.

## Scope

- `@antv/x6@2.19.2` — latest 2.x
- `@antv/x6@3.1.8` — latest 3.x
- the separate 2.x plugin packages
- the deprecated 3.0.0 plugin packages
- the v2 utility/geometry packages

## Verified facts

| Claim | Result |
|---|---|
| v2 latest is `2.19.2` | Confirmed |
| v3 latest is `3.1.8` | Confirmed |
| v2 core published 2025-11-17 | Confirmed; reaches 12 months on 2026-11-17 |
| v2 line lifecycle | **Marked deprecated at 2.19.0 (2025-10-20); 2.19.2 is a late patch** |
| v3 core published 2026-08-11 | Confirmed |
| v3 bundles common, geometry and official plugins | Confirmed in the tarball |
| v2 plugins require `@antv/x6 ^2.x` | Confirmed |
| v3 plugin packages `3.0.0` are deprecated | Confirmed |
| v2 core has no declared Node engine | Confirmed |
| v3 core declares Node >=20 | Confirmed |
| v2 native ESM import works | Confirmed |
| v2 native CJS require works | Confirmed |
| v3 native ESM import works | **Fails** |
| v3 native CJS require works | **Fails** |
| v2/v3 have npm provenance | No for both |
| v2/v3 have known OSV advisories at these versions | None found |
| v2/v3 top-level packages run install scripts | None |
| v2 full plugin stack unpacked size | ~9.9 MB |
| v3 core unpacked size | ~8.36 MB |

## The v3 packaging failure

`@antv/x6@3.1.8` has:

```json
"type": "module",
"main": "lib/index.js",
"module": "es/index.js"
```

`lib/index.js` is CommonJS, while `"type": "module"` makes Node treat `.js` as
ESM. There is no `exports` map.

Reproduction in a clean temporary project installed from the 3.1.8 tarball:

```text
node --input-type=module -e "import('@antv/x6')"
ReferenceError: exports is not defined in ES module scope

node -e "require('@antv/x6')"
Error: Cannot find module 'tslib'
```

The CommonJS failure is additional to the known ESM issue: `lib/index.js`
requires `tslib`, but `tslib` is not in `dependencies` (only `devDependencies`).

The same tests pass for v2:

```text
node --input-type=module -e "import('@antv/x6')"  → ok
node -e "require('@antv/x6')"                     → ok
```

This does not prove v3 is broken in every browser bundler. Bundlers use the
`module` field and may use `es/index.js`, which avoids the CJS `tslib` issue.
But v3 is not currently safe for native Node ESM, native CJS, SSR or test
runners that bypass the bundler. The upstream issue is
[antvis/X6#5048](https://github.com/antvis/X6/issues/5048).

## v2 architecture

A full suite is:

```text
@antv/x6
@antv/x6-common
@antv/x6-geometry
@antv/x6-plugin-selection
@antv/x6-plugin-transform
@antv/x6-plugin-scroller
@antv/x6-plugin-keyboard
@antv/x6-plugin-history
@antv/x6-plugin-clipboard
@antv/x6-plugin-snapline
@antv/x6-plugin-dnd
@antv/x6-plugin-minimap
@antv/x6-plugin-stencil
@antv/x6-plugin-export
```

The core is recent, but only just: as of 2026-11-04 it is inside the 12-month window and reaches the boundary on 2026-11-17. More importantly, the v2 line was marked **deprecated** at 2.19.0. The 2.x plugin packages are from 2023–2024. v2 is therefore a short-term compatibility bridge, not a long-term support line.

`@antv/x6-plugin-clipboard@3.0.0` is deprecated; on v2 the compatible version is
`2.1.6`.

## v3 architecture

v3 consolidates common, geometry and the official plugins into `@antv/x6`:

```text
@antv/x6
```

The plugin APIs remain available from the core:

```ts
import { Selection, Transform, Scroller } from '@antv/x6'
```

The deprecated 3.0.0 plugin packages must not be installed.

## Behavioural changes in v3

From the official upgrade guide:

- `panning` is enabled by default in v3.
- With `Scroller`, panning is disabled by default and `virtual: true` enables
  virtual rendering.
- `transition` is removed; use `animate`.
- React/Vue/Angular shape packages must use 3.x.
- The React provider API changes from `Portal.getProvider()` to
  `getProvider()`.
- Plugin imports move from `@antv/x6-plugin-*` to `@antv/x6`.
- `@antv/x6-common` and `@antv/x6-geometry` imports move to `@antv/x6`.

No serialized graph-data migration is documented, but custom shapes, event
handlers and editor behaviour still need regression testing.

## Corrected conclusion

- **v2 is the correct short-term bridge for the legacy application today.** Pin
  `@antv/x6@2.19.2` and compatible 2.x plugins. Record the provenance gap and
  set an exit/review date; v2 is deprecated and must not become the permanent
  destination.
- **v3 is the maintained future path, but not a safe drop-in.** It is blocked
  for native Node/SSR/test environments by the packaging failure, and it
  requires Node >=20 plus behaviour migration.
- **Do not mix v3 core with 2.x plugins.** Their peer ranges are incompatible.
- **Do not install the deprecated 3.0.0 plugin packages.**
- A browser-only bundled proof of concept can still evaluate v3, but the
  bundle, legacy browser baseline and all editor workflows must be tested.
