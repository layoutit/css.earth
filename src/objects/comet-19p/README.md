# Borrelly: terrain and encounter photography

Borrelly compares two reconstructions of the Deep Space 1 encounter terrain and a registered MICAS photograph. The unobserved rear is an explicitly estimated completion.

## Sources

The panel's editorial credit is NASA's 19P/Borrelly overview: <https://science.nasa.gov/solar-system/comets/19p-borrelly/>.

| View or quantity | Source |
| --- | --- |
| USGS and DLR terrain | [Reviewed PDS DEM release](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/), September 2001 encounter |
| MICAS photograph | [Mission orthophoto and XYZ cubes](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-3-rdr-visccd-borrelly-v1.0/document/derived/topo/topo.htm) |
| Height and difference | Source Z and USGS-minus-registered-DLR Z, in kilometres |

Four terrain places follow [Britt et al. (2004), Figs. 1 and 4](https://doi.org/10.1016/j.icarus.2003.09.004): Upper Mottled Terrain, Central Mesas, Central Smooth Terrain and Lower Mottled Terrain.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

## Datasets

| Dataset | Source and interpretation |
| --- | --- |
| MICAS | The mission team's rectified photograph, registered to the USGS terrain through its original XYZ cubes. Original illumination is retained; brightness is not presented as albedo. |
| USGS | Reviewed stereo terrain, including manual stereo editing, with neutral material. |
| DLR | Independent reviewed stereo terrain, registered into the USGS image plane. |
| Height | USGS source Z in kilometres, before the presentation translation. |
| Difference | USGS Z minus registered DLR Z in kilometres, only where both released surfaces exist. This is model disagreement, not physical change. |

## Processing

The PDS release contains independent USGS and DLR reconstructions of the September 2001 Deep Space 1 encounter. They are open, observed surfaces. USGS supplies 62,879 XYZ/normal rows in metres; DLR supplies 3,765 XYZ rows. Height means displacement toward the observer from an arbitrary image plane. These coordinates do not establish a closed volume, centre of mass or gravity field.

Each pixel of the MICAS orthophoto's XYZ cubes identifies one reviewed USGS post, which places the photograph on the terrain. No contrast enhancement or photometric correction is added to it.

The [mapping paper](https://www.isprs.org/proceedings/xxxiv/part4/pdfpapers/277.pdf) does not publish the final registration between models. Our similarity and vertical-datum fit is recorded in `source/reference/registration.json`.

The viewer closes each surface with an estimated rear, specified in `source/reference/completion.json`. [Buratti et al. (2002)](https://pubs.usgs.gov/publication/70024562) report an 8.0 by 3.15 km nucleus; using that width as a 3.15 km depth scale is our assumption, not a measured third axis. Estimated geometry receives the missing-data grid in every dataset. JPL Horizons elements place the orbit; the attitude is illustrative.

Terrain places are transferred from the published unit map to the orthophoto by two image fits pinned in the [landmark recipe](source/features/image-registration.json). `node packages/bake/cli/project-orthophoto-landmarks.mts comet-19p` recomputes them.

## Evidence

- The orthophoto placement matches the USGS terrain within 0.000001 m in Z. This verifies placement, not radiometric calibration.
- Repeating the registration across thirteen control subsets gives held-out RMS differences of 200–206 m. This is alignment sensitivity, not ground-truth accuracy.
- Sampled source-to-display distances are below 110 m in both directions.
- The terrain-place fits have 1.41 pixels RMS (map to photo) and 1.10 native pixels RMS (photo to orthophoto) on withheld controls ([recomputed placements](source/features/evidence/image-landmarks.json)). These measure image correspondence, not absolute geological accuracy.
- The [ISIS2 cube reader test](../../../packages/bake/src/objects/layers/terrestrial/missions/isis2-qube.oracle.test.mts) checks the four MICAS cubes against an independent reader.

### Registration

<!-- registration-report:begin --><!-- registration-report:end -->

## Known problems

- The 16 m USGS grid oversamples roughly 150 m stereo terrain. Height is displacement above an arbitrary image plane.
- The orthophoto comes from a rescued website outside formal PDS product review; verified placement does not establish radiometric calibration.
- Model differences include registration sensitivity of about 200–206 m RMS. They are not physical change.
- The gridded rear and 3.15 km depth are assumptions. Sampled geometry checks are not continuous error bounds.
- Terrain labels are limited to the MICAS source-range mesh. They do not apply to the estimated rear, the DLR alternative, or a terrain-unit boundary.
- Lower Smooth Terrain remains withheld: its selected source point is too close to the photograph's support edge for the broad placement check. The four included places remain approximate and carry that qualification in their captions.
