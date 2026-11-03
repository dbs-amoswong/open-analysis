# React UI primitives audit

Date: 2026-11-04

This note is the evidence behind `req-react-ui-primitives` and
`dec-react-ui-primitives`. The user constraints were: no commercial licence,
React preferred, SSR optional. The requirement is specifically about **headless
or minimally styled primitives**, not a finished design system.

## Result

- **Adopt primary:** `react-aria-components@1.22.1`, with
  `react-aria@3.53.1` and `react-stately@3.51.0` as the hooks/state runtime.
- **Adopt alternative:** `@base-ui/react@1.9.0`.
- **Hold:** `radix-ui@1.8.1`, `@headlessui/react@2.2.10`,
  `@ark-ui/react@5.40.0`, `@ariakit/react@0.4.42`.
- **Reference only:** styled systems such as Mantine, Chakra UI, MUI,
  Ant Design, HeroUI, Fluent UI and React Spectrum S2.

## Comparison

| Package | Version | Licence | React | Install with React 19 | Dialog bundle | Provenance | Result |
|---|---|---|---|---|---|---|---|
| `react-aria-components` | 1.22.1 | Apache-2.0 | 16.8–19 | ~68 MB | 277.23 KB / 88.22 KB gzip | no | adopt primary |
| `react-aria` | 3.53.1 | Apache-2.0 | 16.8–19 | ~58 MB | (same runtime) | no | adopt hooks |
| `react-stately` | 3.51.0 | Apache-2.0 | 16.8–19 | ~14 MB | (same runtime) | no | adopt state |
| `@base-ui/react` | 1.9.0 | MIT | 17/18/19 | ~30 MB | 257.79 KB / 82.46 KB gzip | yes | adopt alternative |
| `radix-ui` | 1.8.1 | MIT | 16.8–19 | ~16 MB | 235.03 KB / 74.66 KB gzip | yes | hold |
| `@headlessui/react` | 2.2.10 | MIT | 18/19 | ~63 MB | 239.38 KB / 76.76 KB gzip | yes (personal) | hold |
| `@ark-ui/react` | 5.40.0 | MIT | >=18 | ~44 MB | 258.60 KB / 81.97 KB gzip | yes | hold |
| `@ariakit/react` | 0.4.42 | MIT | 17/18/19 | ~18 MB | 253.93 KB / 81.67 KB gzip | yes | hold |

All eight packages had no recorded OSV advisories at the reviewed versions and
no install scripts in their isolated trees.

## Why React Aria wins

- Broadest accessible coverage: collections, tables, date/time,
  drag-and-drop, overlays, menus, forms and internationalization.
- React Aria Components provides the component layer; react-aria and
  react-stately provide lower-level hooks and state when a custom primitive is
  needed.
- Apache-2.0, active, React 18/19 compatible, and no required CSS-in-JS runtime.
- The dialog spike opened with `role="dialog"`, an accessible label and focus
  inside the dialog.
- The trade-offs are real: about 68 MB installed with React, no npm provenance,
  and a more verbose composition model.

## Why Base UI is the alternative

- MIT, provenance-signed, active and React 17/18/19 compatible.
- About 30 MB installed with React; the dialog bundle was 257.79 KB / 82.46 KB
  gzip.
- The dialog spike exposed `role="dialog"`, `aria-labelledby`,
  `aria-describedby` and focus inside.
- It is broader than Radix but less comprehensive than React Aria for complex
  tables, date/time and internationalized collections.

## Why the others are held

- **Radix:** mature, provenance-signed and the smallest dialog bundle, but the
  unified `radix-ui` package installs 76 packages and complex table/date-time
  coverage is narrower. Use individual `@radix-ui/react-*` packages only for a
  focused surface or an existing Radix codebase.
- **Headless UI:** good dialog/menu/listbox ergonomics and a clean spike, but a
  narrower catalogue and about 63 MB installed with React.
- **Ark UI:** broad and provenance-signed, but 69 pinned `@zag-js` dependencies
  and about 44 MB installed. Good fallback when its state-machine API fits.
- **Ariakit:** composable, provenance-signed and only about 18 MB installed,
  but still 0.x and narrower than React Aria or Base UI.

## Spike results

All spikes rendered an open dialog with React 19.2.0, a shared plain-CSS
dialog, Vite production build and a 1200x800 Chrome screenshot.

| Spike | Result | Bundle | Observed accessibility |
|---|---|---|---|
| `spikes/react-aria` | pass | 277.23 KB / 88.22 KB gzip | role=dialog, labelledby, focus inside |
| `spikes/base-ui` | pass | 257.79 KB / 82.46 KB gzip | role=dialog, labelledby, describedby, focus inside |
| `spikes/radix-ui` | pass | 235.03 KB / 74.66 KB gzip | role=dialog, labelledby, describedby, focus inside |
| `spikes/headlessui` | pass | 239.38 KB / 76.76 KB gzip | role=dialog, aria-modal=true, focus inside |
| `spikes/ark-ui` | pass | 258.60 KB / 81.97 KB gzip | role=dialog, aria-modal=true, focus inside |
| `spikes/ariakit` | pass | 253.93 KB / 81.67 KB gzip | role=dialog, labelledby, describedby, focus inside |

Screenshots are in `assets/evaluations/react-aria.png`, `base-ui.png`,
`radix-ui.png`, `headlessui.png`, `ark-ui.png` and `ariakit.png`.

The `aria-modal` attribute was not observed on React Aria, Base UI, Radix or
Ariakit in this simple composition; Headless UI and Ark UI exposed it. This is
an observation, not a verdict: all six libraries are established accessible
primitive sets, and the consuming application should still test with its actual
screen-reader and keyboard matrix.

## Caveats

- Only the dialog primitive was spiked. Tables, date/time, drag-and-drop,
  combobox and screen-reader output were not exercised.
- React 18 was not spiked; peer ranges cover it.
- Install sizes include React 19 and vary with deduping.
- React Aria has no npm provenance; pin exact versions and record the gap.
- Styled design systems were not reviewed in depth because they are outside
  the headless requirement.
