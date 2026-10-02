# NGC 4889

The giant elliptical galaxy NGC 4889, the brightest galaxy of the Coma Cluster. It is drawn as a volume of starlight on its own page, [NGC 4889](../ngc-4889/README.md). A survey image, cleaned of
the Milky Way stars and neighbouring galaxies, supplies the light along every sight line; the depth of that light
follows a published fit to NGC 4889's profile. **Depth is modelled, not measured.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey DR9](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 1800 × 1800 px over 8.0 × 8.0 arcmin, tangent projection, north up. A display composite, not calibrated photometry. |
| [Dullo (2019)](https://arxiv.org/abs/1910.10240) | [Record](../../sources/dullo-2019-large-cores.json). Table 3, row NGC 4889: the core-Sérsic fit to the major-axis profile (Hubble F606W inside, SDSS r band outside), n = 13.3, half-light radius 563.9″, break radius 1.89″. The paper puts 20% on n and 25% on the radius. |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Skrutskie et al. 2006) | Row 2MASX J13000809+2758372: position 195.033737°, +27.977024°; K-band 3σ isophote axis ratio 0.68 and position angle 85°. Also the sizes (K-band 20 mag isophotal radius) of 14 masked neighbours. |
| [HyperLEDA PGC](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/237) (Paturel et al. 2003) | [Record](../../sources/paturel-2003-hyperleda-pgc.json). Positions and D25 sizes of 24 masked neighbouring galaxies. |
| [Gaia DR3](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355) | [Record](../../sources/gaia-2023-dr3.json). Positions and G magnitudes of the 4 masked stars brighter than G = 15. |
| [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) (Tully et al. 2023) | Table 3, group 1PGC 44715, whose dominant galaxy is NGC 4889: distance modulus DMzp = 34.891 ± 0.025, 95.1 Mpc (±1.1 Mpc from the modulus error). It is the distance the [Coma Cluster's circle](../galaxy-clusters/README.md) and its member dots are drawn at, so NGC 4889 sits among them. |

## Method

The Nebula Lab recipe is [labs/nebula/models/ngc-4889/experiment.json](../../../labs/nebula/models/ngc-4889/experiment.json);
`node labs/nebula/run.mts prepare-emission` runs it, and [delivery.json](source/delivery.json) places the result. It is
[M49's route](../m49-volume/README.md#method) with NGC 4889's measurements.

1. **Stars:** NOX removes the Milky Way stars from the cutout.
2. **Masks:** 24 HyperLEDA galaxies are masked out to three times their D25 radius, 14 2MASS galaxies (which
   sizes those HyperLEDA gives no D25) to three times their K-band 20 mag radius, and 4 Gaia stars, whose haloes
   NOX leaves, to 45″ at G = 11, scaled with brightness. No mask reaches beyond half its distance from NGC 4889's
   centre. A masked pixel takes the median of the unmasked light on its isophote and never gains light.
3. **Compact leftovers:** each pixel is clamped to the median of the 75 px around it (20″, 9.2 kpc), so
   uncatalogued galaxies and faint haloes drop out and the smooth light stays.
4. **Black level:** each channel loses the median of the cleaned cutout on the isophote where the spheroid ends
   (0.035, 0.031, 0.020 for red, green, blue), so the light fades to nothing at that edge.
5. **Depth:** the light along each sight line is spread in depth by the deprojected density (Prugniel & Simien 1997) of
   the Sérsic part of Dullo's fit: n = 13.3, half-light radius 563.9″ (260.0 kpc at 95.1 Mpc). The depleted core is smaller than a grid cell and is not modelled. The spheroid's axis is NGC 4889's minor axis (position angle 175°), placed in the plane of the sky,
   with the axis ratio 0.68; no intrinsic axis is measured. It ends at 240″ (110.7 kpc).

Values chosen here, not measured or published:

- The end of the spheroid, 240″: where the cleaned cutout reaches its sky level in 10″ elliptical annuli. The
  published fit runs on; the survey image does not.
- The mask sizes, the cap at half a neighbour's distance, the star mask scale and the median window.
- The display exposure 1.5 and the 150-cell grid are M87's.
- A black level per channel is new to the lab recipe (`blackLevel` takes three values).

## Evidence

![NGC 4889 in the app](evidence/2026-10-02/views.jpg)

The NGC 4889 page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival, then the camera turned to the side and to above the galaxy.

- The volume reproduces the cleaned image along every sight line it covers (the method conditions on it); under 0.8%
  of the image's light lies outside the spheroid and is not drawn.
- The cutout's registration is its request: the brightest pixel of the core falls within 0.8″ (3 px) of the image
  centre, the 2MASS position.
- Tests: `labs/nebula/packages/reconstruction/src/methods/symmetry/processing.test.ts` pins the isophote fill and the
  per-channel black level; `shape-prior.test.ts` pins the Sérsic spheroid.

## Known problems

- From the side and from above the core looks pinched into a faint cross, as M49's does, though the image is not saturated.
- The spheroid ends at 0.43 of the fit's half-light radius: the survey image shows no light of the galaxy beyond 240″.
- NGC 4886 and several other galaxies sit inside NGC 4889's light. They are masked and filled from the isophote; a faint bulge north of the core remains where NGC 4886's light exceeds its capped mask.
- One smooth spheroid about an axis in the plane of the sky: the true shape along the line of sight is unknown.
- The image is a stretched display composite, so the volume's brightness is not proportional to the starlight.
- The distance is the Coma Cluster's group average, not a measurement of NGC 4889 itself.
- No globular clusters are drawn.
