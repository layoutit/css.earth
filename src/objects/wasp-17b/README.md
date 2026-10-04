# WASP-17 b

## Sources

It is the only planet known around Dìwö. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.87 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 133,690 km at 71,492 km per Jupiter radius. GM from the mass 0.78 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 3.73548545 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 8.97; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 86.63 degrees Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): e 0 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457569.98347 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-17's measured color (#f8f3ff, the color dataset of wasp-17 (src/objects/wasp-17/source/photometry/stellar-color.json)) at the gray's own brightness.

**Heat map.** The page opens on a brightness-temperature map at 5 to 12 µm from Valentine et al. (2024, [arXiv:2410.08148](https://arxiv.org/abs/2410.08148), [doi:10.3847/1538-3881/ad5c61](https://doi.org/10.3847/1538-3881/ad5c61)): the eclipse map they fitted with ThERESA to the white light curve of one JWST MIRI LRS eclipse on UT 2023 March 14 (GTO 1353), their "L2N2" model of two patterns, a day-night contrast and an east-west shift. The map is the file they released, `ThERESA/eclipse_mapping_l2n2_model/tmap.pkl` in `ThERESA.zip` of [Zenodo record 12571830](https://zenodo.org/records/12571830) (CC BY 4.0): a pickled 240 × 240 array of brightness temperature in kelvin, read as saved by a [restricted pickle reader](../../../packages/bake/src/objects/raster/numpy/npy-pickle.ts) that runs nothing the file names. Nothing is refitted. The release does not state its grid; it is read on the pixel-centre grid ThERESA builds, south to north and west to east from −180°. The paper shows the map only where the planet faced the telescope, within about 110° of the point under the star (Figure 5 and Section 4.3), and the same longitudes are shown here: 92 of the 240 columns are blank. The false color runs from 500 to 2,200 K.

**Charts.** The orbits of Dìwö's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (12, 38, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-17b.json).

- Run of 2026-10-04: [`new-object --published-map`](../../../packages/telescope-cli/src/new-object/map/published-map-dataset.mts) wrote the dataset from the release. The paper's hot-spot longitude was not an input: the map's hottest cell is at 18.75° east, the paper prints 18.7° (+11.1, −3.8) in Section 4.3. A grid read mirrored or shifted would put it elsewhere. The shown cells run from 549 to 2,165 K.


## Known problems

- **The map is a fit, not an image.** Two patterns fitted to how the light fell and rose as the star covered and uncovered the planet in one eclipse. A third pattern, north to south, was not justified by the data (Section 4.6), so the map is the same above and below the equator.
- **The edges are weakly measured.** The paper finds the region around the hot spot contributes about 1,000 times more to the map than the limbs. The release's uncertainty map (`tmap_unc.pkl`) is not shown.
- **A second reduction differs in confidence.** The paper's Eureka! reduction gives a tighter hot-spot offset that the authors judge unrepresentative of the data; the map shown is the ExoTiC-MIRI one they publish.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-17b" (revision 1374242841) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
