# Gaspra mosaic coordinate validation

The 2021 PDS4 migration label says the 720×360 FITS display is bottom-to-top. The raw bytes interpreted that way place almost all resolved terrain in the southern hemisphere. This conflicts with the source image list: both observations used in the mosaic view the body from approximately +52° latitude and 64° west longitude, with the Sun at +5° latitude and 40° west longitude. The original PDS3 label specifies the central longitude and west-positive coordinate convention but does not specify storage direction.

A diagnostic evaluates four array orientations against the released Thomas shape and source-image geometry. It samples every second nonzero mosaic pixel, omitting the nearest two degrees at each pole; estimates the surface normal from central differences at ±0.1°; tests the finite spacecraft vector and approximate solar direction; and retains a sample if either of the two published views can see and illuminate its location. There is no cast-shadow or terrain-occlusion calculation, so the score is supporting geometric evidence rather than an exact source reconstruction.

| Row order | Direction of increasing sample columns | Observer-facing | Sun-facing | Both |
| --- | --- | ---: | ---: | ---: |
| North to south | East | 99.539% | 95.419% | 94.993% |
| North to south | West | 78.545% | 51.747% | 50.569% |
| South to north | East | 28.979% | 77.743% | 28.567% |
| South to north | West | 7.895% | 29.073% | 0.793% |

All candidates use the same 22,330 samples. The accepted orientation is also visually consistent with the independently published Stooke cylindrical mosaic, pinned as `stooke-gascylmo.jpg`: matching craters occupy the northern half and the same horizontal direction. Thus the recipe treats the bytes as north-to-south, eastward-increasing image columns. This is an evidence-backed interpretation of ambiguous/contradictory metadata, explicitly distinct from the source's west-positive coordinate labels.

`registration.json` preserves the numerical diagnostic. Recompute with `evaluateRegistration()` from `tests/objects/unit/gaspra/registration.mjs`; the unit test compares the accepted and reversed results. The underlying inputs are `maps/951gaspram.fit`, `shape/951gaspra.tab`, and the sub-spacecraft/sub-solar values of `reference/951gaspimg.tab` interpreted by its XML label. Source previews and the diagnostic CLI are retained in `output/asteroids-optical/gaspra/` for this run.
