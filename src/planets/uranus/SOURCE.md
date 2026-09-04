# Uranus source and preparation record

This adapter is built from checked, hash-pinned source bytes. Runtime code does
not contact any source authority and does not interpret raw scientific data.

## Visible surface and observation lenses

The visible-color surface is the rotation-A global map from
[Hubble OPAL Uranus Cycle 33](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33),
observed in October 2025. The checked composite combines F467M, F547M, and
F657N. FQ727N and F845M FITS maps supply two separately prepared false-color
observation lenses. Their palettes and percentile stretches are declared in
`tools/prepare-scene.mjs`; no browser filtering is used.

The OPAL map contains observed northern coverage and an unobserved black
southern region. Preparation detects the non-black edge, then conservatively
ends the usable observation six rows north of the map equator so resampling at
the coverage fringe cannot become a fabricated feature. The checked NASA/JPL
Voyager 2 PIA18182 full-disc observation supplies a central-disc chromatic
baseline for the visible-color map. OPAL detail is feathered into that uniform
baseline across twelve prepared rows. The single-filter lenses use the
observed-disc mean from their own checked FITS products as their uniform
unobserved-area baseline. No local feature is reflected, extended, or invented
outside the observed OPAL coverage.

The checked [Webb NIRCam Uranus portrait](https://science.nasa.gov/asset/webb/uranus-nircam-image/)
is a visual-composition reference only. It is not sampled into the runtime
surface. The navigation disc is an adapter-owned exact copy of the already
accepted NASA/JPL PIA18182 Uranus source. The same exact bytes bind the
featureless visible-color baseline described above. Its generic marker recipe
preserves the frozen shared atlas bytes when Uranus changes from planned to
implemented.

## Rings

Ring radii, widths, and normal optical depths come from the
[PDS Rings Node Uranus table](https://pds-rings.seti.org/uranus/uranus_rings_table.html).
Preparation verifies the table labels and measurements before baking one
transparent projective ring texture and one transparent projective
planet-shadow texture. The physical center radii are kept in the prepared
module. Extremely narrow rings receive a recorded minimum-pixel presentation
width so they remain visible at the accepted Saturn composition; their radii
and ordering are not moved. NASA's public Uranus facts supply the documented
gray inner-ring, reddish Nu, and blue Mu color interpretation.

## Moons

The checked JPL discovery and mean-elements tables are parsed into 29 Uranian
satellites. The five major moon portraits come from NASA/JPL PIA01361, a
Voyager 2 montage published at correct relative sizes and brightness. The
source itself discloses incomplete image coverage of Miranda and Ariel; the
prepared billboards retain that limitation. JPL mean radii set the five
prepared portrait diameters. Preparation separates each portrait into a
source-color base and a black alpha layer derived from the source-observed
darkening; compositing both layers reconstructs the source brightness while
the shared Shadows control can suppress the darkening layer. The remaining
satellites render as prepared retained dots from the JPL catalog.

Each prepared moon position propagates the JPL mean anomaly and period from
its source epoch to the fixed 2026-08-30 12:00 TDB presentation epoch. Display
orbit radii use the Saturn adapter's accepted logarithmic presentation rule so
the large physical distance range remains legible; the ordering and all
physical semi-major axes remain the checked JPL values. The prepared orbit
containers retain each JPL inclination and ascending node. Equal-duration
counter-orbit containers keep portraits, dots, and major-moon labels facing
the camera without per-frame JavaScript geometry.

NASA's editorial snapshot may carry an older dated moon count. The panel keeps
that dated value and separately identifies the newer rendered JPL count. It
does not rewrite NASA's prose.

## Body, orientation, and charts

The equatorial and polar radii, 97.77 degree axial tilt, retrograde rotation,
distance, day, year, temperature, winds, and ring count are checked against
[NASA Uranus facts](https://science.nasa.gov/uranus/facts/) and the checked JPL
physical-parameter page. The body is 1,060 retained projective CSS texture leaves:
1,056 longitude-latitude faces, two polar surfaces, and two inset polar seam
leaves. Its source-color equirectangular and polar atlases are prepared at DPR
1 and DPR 2. A separate one-leaf material root carries only prepared directional
illumination and atmospheric-limb correction; it is not the planet albedo and
does not replace the retained CSS sphere. Camera-facing material transforms are
prepared for all 8,901 accepted pitch states. A narrow, horizontally expanded
and vertically inset resolved-color limb backing covers the projective cells'
side chord dents at close zoom without extending the top or adding runtime
geometry. Its opacity resolves from that inset backing boundary, so surface
vertices cannot show through as bright points. The browser only selects and
transports these products.

The two panel charts are rendered at preparation time from the checked NASA
GSFC Planetary Spectrum Generator configuration and raw 253-sample I/F
response. Acquisition removes only PSG's request timestamp and elapsed-time
comments so the checked scientific rows are reproducible. The model date is
2026-08-30 12:00, range 0.35-1.0 micrometers, and
resolving power 240. The temperature-pressure panel is extracted from the same
checked expanded atmosphere configuration.

## Reproduction

Run `node src/planets/uranus/tools/acquire.mjs --verify-only` to prove the
local source closure. `--refresh` contacts only the declared authorities and
publishes bytes after the pinned size and SHA-256 checks succeed. Run
`node src/planets/uranus/tools/prepare.mjs` to rebuild every browser asset,
prepared module, chart, and runtime manifest.
