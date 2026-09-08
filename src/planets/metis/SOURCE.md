# Metis sources

## Selected view and limitations

**Monochrome** combines original Galileo SSI clear-filter frames C0532890500, C0420681401, C0420685801, C0394682801 and C0401751800. The finest sampling is 2.97 km/pixel, only about 14 pixels across the projected illuminated body; complementary views are 5.78–8.74 km/pixel. The soft appearance is the information in the original photographs. No invented crater detail or colour is added.

The surface is a **smooth reference ellipsoid**, with semi-axes 30 × 20 × 17 km from `BODY516_RADII` in NAIF `pck00011.tpc`. It describes measured overall dimensions, not Metis's detailed irregular outline. No Elevation lens is exposed because the ellipsoid contains no resolved terrain measurements. The prepared surface uses 480 native raster triangles and shared flood and directional lighting.

## Candidate survey

| Candidate | Disposition |
| --- | --- |
| [Galileo reconstructed SSI archive](https://pds-rings.seti.org/galileo/), January 2000 frame C0532890500 | Included: the best resolved photographic view, at approximately 3 km/pixel. |
| Earlier Galileo G8/C9/E11 observations | Five complementary views selected after inspecting originals. C0401639113 is badly affected by radiation noise; C0401773600 and C0401786800 add much coarser or redundant coverage and are excluded. |
| [NASA PIA02531 montage](https://science.nasa.gov/photojournal/best-images-yet-of-thebe-amalthea-and-metis/) | Source comparison only. It is a presentation of the same January 2000 image, not an independent high-resolution texture. |
| Voyager discovery images and Hubble images in OPUS | Unresolved or nearly unresolved; useful for detection/orbits, not additional surface lenses. |
| [Stooke shape-model archive](https://sbn.psi.edu/pds/resource/stkshape.html) | No Metis model in this archive's released body list. Thomas et al. (1998) and later research describe a Metis shape reconstruction, but a reusable numerical release was not located. The explicitly labeled PCK ellipsoid is used instead. |
| Colour, composition, altimetry and geological maps | No registered, resolved complementary map qualified from the inspected mission and mapping releases. Disk-integrated colour or albedo is not a resolved colour map. |

## Geometry and photographic preparation

Original eight-bit reconstructed SSI data are decoded from their attached VICAR layout, preserving line prefixes and binary-header offsets. They are relative detector counts, **not calibrated I/F**. The original files and detached labels are preserved unchanged.

OPUS owns observer and Sun planetocentric latitude, west-positive longitude and range, checked against recorded phase and image pixel scale. Several early raw PDS labels contain inconsistent Sun/range values, so those fields are not used. `NORTH_AZIMUTH` is clockwise from image right under the [PDS definition](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html); adding 90 degrees supplies the shared camera's clockwise angle from image up. In particular, north is approximately down in the January 2000 raw image. The OPUS image-center and pole-clock values disagree with that image and are not used. Image-center translation is refined against the illuminated ellipsoid while holding its dimensions, camera scale and source directions fixed. Coordinates and the original metadata are recorded in `source/geometry/`.

A measured empty-sky median is removed, then the shared bounded lunar-Lambert approximation (weight 0.5, maximum gain 2, incidence/emission below 70 degrees) reduces photographed illumination. Overlap levels are bounded to 0.7–1.4. These are empirical display corrections, not recovery of calibrated albedo. The coarse ellipsoid limits registration. Unreliable source samples and cast shadows remain missing; no geometry, hidden texture or false neutral colour is inferred from them.

`source/shape/model.json` records the analytic ellipsoid sampling formula. `metis-ellipsoid.tab` is a checked-in 5-degree sampling of that formula, not independent radius measurements. Its sampling is verified against the original PCK dimensions in the numerical source test. Shared meshoptimizer preparation simplifies its 5,040 triangles to 480 within a 500 m library error allowance; that allowance is a preparation setting, not a measurement uncertainty. Original dimension uncertainties are roughly kilometres.

Surface, pole atlas, minimap and navigation portrait use the same interpreted map. Gaps use the shared neutral grid. The context portrait preserves the complete measured silhouette; shared lighting stays available instead of hiding source shadows by disabling application controls.

## Reproduce

Original imagery is pinned in `source/manifest.json` and restored through `source/preparation/acquisition.json`. The small measured ellipsoid, geometry records and prepared context portrait are checked in. Stars: ESO/S. Brunier; font: Inter.

- Restore: `node tools/objects/dist/operations.js acquire metis`
- Prepare: `node tools/objects/dist/prepare-authored.js metis --write` after shared tools are built.
- Install published runtime: `pnpm setup:assets --object=metis`

Useful source review: Denk et al., *Io and the Minor Jovian Moons – Prospects for JUICE*, Figure 10 and Table 3. Its image identifications guided the survey; no extracted paper artwork is used as a texture.
