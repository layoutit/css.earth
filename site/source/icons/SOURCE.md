# Sidebar section icons

These SVGs preserve the six Unicode symbols used by the sidebar. Their
Wikimedia Commons vectors were adapted to one 20 by 20 pixel outer box, an
optical height of approximately 15 to 16 pixels, and the existing cssEarth
`#aaa` icon color. Each symbol keeps its natural width.

| Local source | Sidebar section | Wikimedia Commons source |
| --- | --- | --- |
| `symbol-square-crosshatch-fill.svg` | Factsheet (`▦`) | [U+25A6.svg](https://commons.wikimedia.org/wiki/File:U%2B25A6.svg) |
| `symbol-sine-wave.svg` | Reflectance spectrum (`∿`) | [Sine wave.svg](https://commons.wikimedia.org/wiki/File:Sine_wave.svg) |
| `symbol-proportional-to.svg` | Temperature–pressure profile (`∝`) | [Proportional To in Linux Biolinum Regular - U+221D.svg](https://commons.wikimedia.org/wiki/File:Proportional_To_in_Linux_Biolinum_Regular_-_U%2B221D.svg) |
| `symbol-quarter-phase.svg` | Photometric phase curve (`◔`) | [U+25D4.svg](https://commons.wikimedia.org/wiki/File:U%2B25D4.svg) |
| `symbol-half-black-circle.svg` | Surface lens (`◐`) | [GNU Unifont - U+25D0.svg](https://commons.wikimedia.org/wiki/File:GNU_Unifont_-_U%2B25D0.svg) |
| `symbol-reference-mark.svg` | Sources & Resources (`※`) | [Reference Mark in Linux Biolinum Regular - U+203B.svg](https://commons.wikimedia.org/wiki/File:Reference_Mark_in_Linux_Biolinum_Regular_-_U%2B203B.svg) |

The square-with-crosshatch and quarter-phase sources are public domain. The
half-black circle derives from GNU Unifont under SIL OFL 1.1. The
proportional-to and reference mark symbols derive from Linux Biolinum under
the same license. The sine-wave source is licensed under CC BY-SA 3.0.
Authors and license links are recorded in `manifest.mjs`.

`tools/prepare-shell-icons.mjs` verifies each adapted source hash and copies the
prepared SVGs to `public/shell/`.
