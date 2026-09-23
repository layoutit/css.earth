# IBEX heliopause surface

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

```text
heliosphere/
├── object.json                         Physical frame and source/prepared pins
├── source/
│   ├── shell.json                      Scientific grid and display recipe
│   ├── provenance.json                 Original sources, limitations and hashes
│   ├── galaxio-heliosphereRenderer.ts.txt Original rim presentation reference
│   ├── LICENSE.GALAXIO-MIT.txt          Galaxio presentation software notice
│   └── ibex/
│       ├── apjsabf658.tar.gz            Original workbook and publisher ReadMe
│       ├── apjsabf658f8_int.html.gz      Lossless original interactive Figure 8
│       ├── extract.py                  Checked offline numerical extraction
│       ├── heliopause-grid.json         Complete published model envelope
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
extent does not establish the end of the heliopause. The complete published
envelope retains these uncertain distances for display; its closed geometry
must not be interpreted as a measured physical tail closure. Category 4's
noisy, manually constrained values also remain as published.

Offline display tessellation interpolates between the retained source samples
to avoid magnifying giant facets. It adds no scientific measurements, improves
no source resolution and does not reduce the reported uncertainties. Original
scientific arrays and category metadata remain separate from the prepared
display geometry. Four segments per original triangle edge produce 1,920
display triangles. Radius interpolates linearly while direction is normalized;
original samples and shared edges remain fixed. Surface-derived smooth normals
replace the old Sun-radial presentation normals. A conservative ±383 AU bound
contains both the source and the curved display interpolation.

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
license. The original Galaxio renderer and its MIT notice document the retained rim presentation; IBEX supplies the geometry.

From a clean checkout, run from the repository root (Python 3 is required):

```sh
pnpm install --frozen-lockfile --ignore-scripts
python3 src/objects/heliosphere/source/ibex/extract.py --check
pnpm build:tools
node tools/objects/dist/prepare-shell.js src/objects/heliosphere
node tools/contract/test-preparation.mts --universe
```

Both original scientific inputs are checked in. To regenerate their numerical
derivatives deliberately, run the same sequence with `--check` omitted from
the Python command; unchanged inputs must reproduce unchanged hashes.
