# 1P/Halley

The nucleus of Halley's comet, as a historical shape model with two views: **Historical model**, a neutral gray
shape, and **Giotto + Vega**, which projects the Giotto close-up and two Vega 2 photographs onto it. About 28% of the
nucleus model has accepted photographic coverage; uncertain and missing areas remain grid. Shadows is off by default.
The gray (#808080 sRGB) is a display convention, not a measured color or albedo. The package has no coma, tail or
outgassing.

## Sources

- The [PDS4 Stooke Halley product](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml)
  has 2,701 longitude/latitude/radius rows at 5° intervals. Philip Stooke built it from Giotto/Vega limb and
  terminator fits with pointing by Alain Abergel.
- [Stooke & Abergel (1991), A&A 248, 656–668](https://articles.adsabs.harvard.edu/pdf/1991A%26A...248..656S) publishes
  a separate 10° radius table in a different frame. The two must not be mixed.
- Stooke's [Small Body Mapping Results — 1994 (LPSC 1995)](https://www.lpi.usra.edu/meetings/lpsc1995/pdf/1683.pdf)
  reports a revised shape using Belton et al.'s slow long-axis rotation.
- The [MPS Halley Multicolour Camera page](https://www2.mps.mpg.de/de/projekte/giotto/hmc/) supplies a 68-image Giotto
  composite and a nucleus outline. It permits educational use with MPS attribution; commercial reuse requires
  permission.
- [Samarasinha, Mueller, Belton & Jorda (2004)](https://pdssbn.astro.umd.edu/holdings/ear-c-compil-5-comet-nuc-rotation-v1.0/dataset.shtml)
  supply the long-axis rotation state. [NASA SPDF Vega ephemerides](https://spdf.gsfc.nasa.gov/pub/data/vega/mag/) and
  original PDS FITS headers supply spacecraft geometry. Exact inputs are in the
  [registration](source/reference/giotto-registration.json).
- The two Vega 2 frames are original KFKI-processed archive images.
- Heliocentric placement uses JPL Horizons `DES=1P;CAP;` at JD 2461286.5 (3 September 2026). The osculating conic omits
  perturbations and outgassing.

The [investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying.

## Processing

Preparation converts the rows to XYZ, welds poles and seams into 2,522 vertices and 5,040 triangles, and reduces them
to 1,000 triangles with Meshoptimizer 1.2.0 (estimated error 99.48 m). The equivalent-volume radius,
4.57906433330178 km, sets display scale only. Extents are about 7.53 × 7.58 × 15.14 km. No mass is claimed.

The long axis is placed along ICRF +Z and held fixed. This is a presentation choice, not Halley's spin.

The [Giotto preparer](../../../packages/bake/authoring/comet-1p/prepare-giotto.mts) projects the MPS display
composite. The camera comes from the published long-axis state (precession 3.69 days, roll 7.1 days), anchored to
Stooke's Vega image at 07:19:58 UTC on 9 March 1986, and places Giotto at about 161.41° E, 18.53° N. Only image scale
and centre are fitted to the catalogue outline. Coverage is an authored polygon inset about 0.5 km from the lit
region. Samples with emission over 75°, incidence over 80° or occlusion are rejected. No contrast gain, albedo
correction or synthetic detail is added.

The [encounter preparer](../../../packages/bake/authoring/comet-1p/prepare-encounters.mts) adds two Vega 2 frames:

| Frame | UTC on 9 March 1986 | Filter / exposure | Native projected pixel size |
| --- | --- | --- | --- |
| T11190 | 07:19:58 | Near infrared / 0.32 s | 120 × 160 m |
| T11194 | 07:21:38 | Visible / 0.08 s | 170 × 220 m |

Vega samples must lie at least 1 km inside the authored footprint and pass the same angle and occlusion cuts. Every
accepted Giotto sample wins; remaining pixels take the finer Vega view. T11194 gets a display gain of 1.9591 fitted
against T11190, a display adjustment between filters, not photometric correction. Giotto keeps its original RGB.

Reproduce, after restoring the declared inputs:

```sh
node packages/bake/authoring/comet-1p/prepare-giotto.mts --write
node packages/bake/authoring/comet-1p/prepare-encounters.mts --write
node site/build/prepare/prepare-authored.ts comet-1p --write
```

## Evidence

- The [encounter projection report](source/reference/encounter-projection-report.json) puts accepted coverage at
  27.807% of model surface area, up from 4.314% with Giotto alone. The
  [lossless attribution map](source/reference/encounter-attribution.bin) records every source and gap.
- Of 64 transcribed Giotto outline points, 22 are held out. Their distance to the projected silhouette is 0.211 km RMS,
  0.456 km maximum ([projection report](source/reference/giotto-projection-report.json)). Vega held-out RMS/max
  distances are 0.262/0.492 km for T11190 and 0.366/0.683 km for T11194. All sit within the source's 0.5–1 km
  shape uncertainty. They check silhouette consistency, not feature positions.
- The 27 September 2026 audit decoded all 68 sensor-C CLEAR frames in the
  [PDS HMC archive](https://pdssbn.astro.umd.edu/holdings/gio-c-hmc-3-rdr-halley-v1.0/). Sampling improves from
  451.58 to 43.30 m/pixel, but the shape uncertainty spans 11.5–23.1 pixels in the last frame. No replacement surface
  or shape qualified.
- At 35 AU a 15 km nucleus subtends about 0.00059 arcsec, against
  [NIRCam's approximately 0.07 arcsec](https://jwst-docs.stsci.edu/jwst-near-infrared-camera), so JWST would leave it
  unresolved.

## Known problems

- This is a highly uncertain historical inverse model. The label estimates about 500–1,000 m absolute and around
  100 m relative uncertainty, and warns that facets and depressions may be exaggerated.
- The photographs keep their original lighting and dust. Mixing visible and near-infrared images does not make a
  measured albedo or true-color map.
- Giotto + Vega is deferred for image-to-shape feature registration. The silhouette check supports an approximate
  projection only; Historical model remains the supported view.
- Registration is approximate: rotation parameters are rounded, the Vega position is extrapolated for 148 seconds, and
  a multi-exposure composite is treated as one frame. Bright patches and jets are excluded.
- The 1991 paper reports that its model does not reproduce the Giotto terminator or part of the dark limb. That does
  not reject the 1995 revision. [Reitsema, Delamere & Keller (1989)](https://doi.org/10.1016/0273-1177(89)90244-5)
  catalogue 21 bright features that may support independent checks once their frame is matched.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
