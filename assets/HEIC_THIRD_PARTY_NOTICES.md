# HEIC import components

HEIC conversion uses the following independently distributed components:

- heic-convert 2.1.0 — ISC — https://github.com/catdad-experiments/heic-convert
- heic-decode 2.1.0 — ISC — https://github.com/catdad-experiments/heic-decode
- libheif-js 1.23.5 — LGPL-3.0 — https://github.com/catdad-experiments/libheif-js
- libheif — LGPL-3.0 — https://github.com/strukturag/libheif
- pngjs 6.0.0 — MIT — https://github.com/pngjs/pngjs
- jpeg-js 0.4.4 — BSD-3-Clause — https://github.com/jpeg-js/jpeg-js

The libheif-js distribution includes its separately loaded WebAssembly decoder.
Corresponding source and build scripts: https://github.com/catdad-experiments/libheif-js/tree/v1.23.5
License text: https://www.gnu.org/licenses/lgpl-3.0.html
These components retain their own licenses; eQc’s MIT license does not replace them.
