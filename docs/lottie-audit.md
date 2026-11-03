# Lottie and DotLottie audit

Date: 2026-11-04

This note is the evidence behind `req-lottie` and `dec-lottie`. It compares
the JSON-first Lottie stack with the DotLottie player line for a React web
application. The user constraints were: no commercial licence, React preferred,
SSR optional.

## Result

- **Adopt:** `@lottiefiles/dotlottie-react@0.21.1` with the required runtime
  `@lottiefiles/dotlottie-web@0.82.1`.
- **Hold / replace:** `lottie-react@3.1.2`, `lottie-web@5.13.0` and
  `@lottiefiles/dotlottie-wc@0.11.1`.
- **Reject:** `@lottiefiles/react-lottie-player@3.6.0`,
  `@lottiefiles/lottie-player@2.0.12`, `react-lottie@1.2.10` and
  `@dotlottie/react-player@1.6.19`.
- **Out of scope:** `lottie-react-native` (React Native, not React DOM).

## Comparison

| Package | Version | Licence | React | JSON | .lottie | Release | Provenance | Install scripts | Result |
|---|---|---|---|---|---|---|---|---|---|
| `@lottiefiles/dotlottie-react` | 0.21.1 | MIT | 17/18/19 | yes | yes | 2026-11-02 | yes | none | adopt |
| `@lottiefiles/dotlottie-web` | 0.82.1 | MIT | n/a | yes | yes | 2026-11-02 | yes | none | adopt (runtime) |
| `lottie-react` | 3.1.2 | MIT | 18.2/19 | yes | no | 2026-09-07 | no | none | hold / replace |
| `lottie-web` | 5.13.0 | MIT | n/a | yes | no | 2025-05-21 | no | none | hold / replace |
| `@lottiefiles/dotlottie-wc` | 0.11.1 | MIT | web component | yes | yes | 2026-11-02 | yes | none | hold |
| `@lottiefiles/react-lottie-player` | 3.6.0 | MIT | 16–19 | yes | no | 2025-01-14 | no | none | reject |
| `@lottiefiles/lottie-player` | 2.0.12 | MIT | web component | yes | no | 2024-11-04 | yes | none | reject |
| `react-lottie` | 1.2.10 | MIT | >=15 | yes | no | 2024-11-30 | no | core-js | reject |
| `@dotlottie/react-player` | 1.6.19 | MIT | 16.8–18 | yes | yes | 2024-03-21 | no | sharp | reject |

## Why the DotLottie line wins

- Active releases on 2026-11-02, with commits the same day.
- MIT runtime tree and npm provenance via GitHub Actions trusted publishing.
- React peer range covers 17, 18 and 19.
- One component accepts `.lottie` and `.json`.
- WASM and worker are shipped in the package and can be self-hosted.
- No install scripts and no recorded OSV advisories.

The costs are real: the WASM is about 1.2 MB uncompressed / 481 KB gzip, and
the player is browser/canvas-only. A strict CSP must allow WebAssembly and,
if the worker is used, `worker-src`. The default player fetches the
version-pinned WASM from jsDelivr or unpkg, so self-host it for CSP or
offline use.

## Why lottie-web does not win

`lottie-web@5.13.0` is the long-standing JSON renderer and was fast in the
spike, but:

- last release 2025-05-21, more than 12 months before this audit;
- repository last pushed 2025-09-01 and 861 open issues;
- no .lottie support;
- no npm provenance;
- the browser bundle contains `eval()`.

`lottie-react@3.1.2` is an active wrapper, but it sits on that runtime, so the
chosen stack fails the active-maintenance constraint too.

## Spike results

All spikes used a 90-frame JSON animation; the DotLottie spike also used the
same animation inside a `.lottie` zip.

| Spike | Result | JS bundle | Notes |
|---|---|---|---|
| `spikes/lottie-web` | pass | 309.52 KB / 79.73 KB gzip | SVG renderer, 4–7 ms to load |
| `spikes/lottie-react` | pass | 521.17 KB / 145.52 KB gzip | React 19, SVG, 56 ms to first SVG |
| `spikes/dotlottie-react` | pass | 356.93 KB / 93.15 KB gzip + 481 KB gzip WASM | React 19, self-hosted WASM, .lottie + JSON, 58 ms, 90 frames each |

The DotLottie spike copied `dotlottie-player.wasm` and
`dotlottie.worker.js` from the installed package and called `setWasmUrl()`.
It made no CDN request for the runtime.

Screenshots are in `assets/evaluations/lottie-web.png`,
`lottie-react.png` and `dotlottie-react.png`.

## Caveats

- The audit covers simple playback, not state machines, themes, audio or very
  large animations.
- React 18 was not spiked; only React 19.2.0.
- The .lottie assets and their licensing are separate from the player licence.
- `@lottiefiles/dotlottie-wc` is a viable non-React fallback but adds `lit`.
- `@lottiefiles/lottie-interactivity` is an optional interaction layer; it has
  not shipped since 2023 and is not needed for basic playback.
