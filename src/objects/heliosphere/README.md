# IBEX heliopause surface

```text
heliosphere/
├── object.json                         Physical frame and source/prepared pins
├── source/
│   ├── shell.json                      Scientific grid and display recipe
│   ├── provenance.json                 Original sources, limitations and hashes
│   ├── LICENSE.rendering-MIT.txt        Retained presentation software notice
│   └── ibex/
│       ├── apjsabf658.tar.gz            Original workbook and publisher ReadMe
│       ├── apjsabf658f8_int.html.gz      Lossless original interactive Figure 8
│       ├── extract.py                  Checked offline numerical extraction
│       ├── heliopause-grid.json         Published positions, open tail mask
│       ├── macropixels.json             All 56 samples, models and categories
│       └── NOTICE.md                    Scientific credits and rights notice
└── prepared/
    ├── shell.json                      Retained PolyCSS triangle leaves
    ├── surface-mesh.json               Prepared positions, normals and indices
    └── rim-atlas.png                   Fixed display material image bank
```

The geometry comes from Reisenfeld et al. (2021),
[A Three-dimensional Map of the Heliosphere from IBEX](https://doi.org/10.3847/1538-4365/abf658),
using Figure 8's heliopause surface and its Zirnstein–Heerikhuisen termination
shock model. It replaces the earlier illustrative shape.
The result is an IBEX-derived, model-dependent estimate from 2009–2019
observations, not a direct photograph or a fully measured closed boundary.

The publisher supplies a 13 × 7 grid. Its 67 directly corresponding entries,
including repeated poles and longitude seam, agree with the original workbook
within 10⁻¹⁰ AU. The remaining 24 entries are the authors' high-latitude
interpolation. Their ±85° polar macropixels are placed at ±90° in the figure.
Extraction preserves these choices and all retained coordinates exactly.

Category 1 and 2 distances carry the paper's approximate ±10 and ±15 AU
uncertainties. Category 3 traces the detectable tail ENA region; its reported
extent does not establish the end of the heliopause. We omit every triangle
touching these tail-limit vertices, leaving an open tail. Category 4's noisy,
manually constrained values remain as published and are recorded separately.
No new interpolation or closing cap is added during preparation.

The original frame is right-handed, with +Y toward ecliptic longitude 255°
and +Z toward the north J2000 ecliptic pole. The source frame explicitly
applies `Rx(J2000 obliquity) × Rz(165°)` to align it with the shared Sun ICRF
world. Units are astronomical units; one AU is 149,597,870,700 metres.

The green rim, transparency, visibility distances and fixed 2,024-tile atlas
are display choices, preserved from the previous presentation. They are not
measurements from the paper. Finite facing bins, coarse source geometry and
rasterized edges remain visual approximations. Runtime transports retained
prepared leaves and selects atlas addresses; it generates no geometry or
images. Original archives and extraction code are offline inputs only.

The scientific source has its original AAS notice, not a claimed CC-BY/MIT
license. The separate MIT notice covers the retained software derivation.

From a clean checkout, run from the repository root (Python 3 is required):

```sh
pnpm install --frozen-lockfile --ignore-scripts
python3 src/objects/heliosphere/source/ibex/extract.py --check
pnpm build:packages
pnpm build:preparation
pnpm prepare:surface-shell src/objects/heliosphere
node tools/test-preparation.mjs --universe
```

Both original scientific inputs are checked in. To regenerate their numerical
derivatives deliberately, run the same sequence with `--check` omitted from
the Python command; unchanged inputs must reproduce unchanged hashes.
