# M89

The elliptical galaxy M89 (NGC 4552) of the Virgo Cluster, drawn as a volume of starlight on its own page,
[M89](../m89/README.md). A survey image, cleaned of the Milky Way stars and neighbouring galaxies, supplies the light
along every sight line; the depth of that light follows the measured shape of M89's profile. Its globular clusters are drawn as dots through the same volume.
**Depth is modelled, not measured.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey DR9](https://www.sdss.org/) | [Record](../../sources/sdss-dr9-color-hips.json). The survey's g, r, i color composite as the CDS HiPS `CDS/P/SDSS9/color`, cut out by the CDS hips2fits service: 2100 × 2100 px over 17.7 × 17.7 arcmin, tangent projection, north up. A display composite, not calibrated photometry. |
| [Kormendy et al. (2009)](https://arxiv.org/abs/0810.1681) | [Record](../../sources/kormendy-2009-virgo-ellipticals.json). Table 1, row NGC 4552: the major-axis Sérsic fit, n = 9.22 (+1.13, −0.83), half-light radius 138.6 (+33.4, −21.5)″. [Table 3](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/182/216): V-band surface brightness, ellipticity and position angle along the major axis out to 530.884″. |
| [HyperLEDA PGC](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/237) (Paturel et al. 2003) | [Record](../../sources/paturel-2003-hyperleda-pgc.json). Positions and D25 sizes of 9 masked neighbouring galaxies. |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Skrutskie et al. 2006) | [Record](../../sources/publication-skrutskie2006aj-131-1163s.json). Sizes (K-band 20 mag isophotal radius) of 4 masked neighbours that HyperLEDA lists without a D25. |
| [Gaia DR3](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355) | [Record](../../sources/gaia-2023-dr3.json). Positions and G magnitudes of the 18 masked stars brighter than G = 15. |
| [Jordán et al. (2009)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/180/54) | [Record](../../sources/jordan-2009-acsvcs-globular-clusters.json). [Globular clusters](source/jordan-gc/points.json) of the ACS Virgo Cluster Survey: the 456 sources of VCC 1632 in Table 4 with a probability of being a globular cluster of at least 0.5, the authors' own cut, in the Hubble field on the centre. |

The position, distance and velocity that place M89 are cited on [its own page's record](../m89/README.md).

## Method

The Nebula Lab recipe is [labs/nebula/models/m89/experiment.json](../../../labs/nebula/models/m89/experiment.json);
`node labs/nebula/run.mts prepare-emission` runs it, and [delivery.json](source/delivery.json) places the result. It is
[M49's route](../m49-volume/README.md#method) with M89's measurements.

1. **Stars:** NOX removes the Milky Way stars from the cutout.
2. **Masks:** 9 HyperLEDA galaxies are masked out to three times their D25 radius, 4 2MASS galaxies to three times
   their K-band 20 mag radius, and 18 Gaia stars, whose haloes NOX leaves, to 45″ at G = 11, scaled with brightness. No
   mask reaches beyond nine tenths of its distance from M89's centre. A masked pixel takes the median of the unmasked
   light on its isophote and never gains light.
3. **Compact leftovers:** each pixel is clamped to the median of the 35 px around it (18″, 1.4 kpc, about two and
   a half of the grid's cells), so star haloes and small background galaxies drop out and the smooth light stays.
4. **Black level:** each channel loses the median of the cleaned cutout's four 105 px corners (0.024, 0.024, 0.016 for red,
   green, blue), the survey's sky around M89.
5. **Depth:** the light along each sight line is spread in depth by the deprojected density (Prugniel & Simien 1997) of
   Kormendy et al.'s Sérsic fit: n = 9.22, half-light radius 138.6″ (10.8 kpc at 16.1 Mpc). The spheroid's axis is
   M89's minor axis (position angle 230.04°: the major axis is at 140.04° at the half-light radius, interpolated between
   the Table 3 rows at 124.738″ and 138.739″), placed in the plane of the sky, with the axis ratio 0.857 from the
   ellipticity interpolated the same way; no intrinsic axis is measured. It ends at 3.83 half-light radii (41.4 kpc),
   where the profile stops.
6. **Dots:** each cluster sits along its sight line at a depth drawn from the same density
   (`frame.placement: spheroid` in [prepare-catalogue-points](../../../packages/bake/cli/prepare-catalogue-points.mts)).

Values chosen here, not measured: the display exposure 1.5 and the 150-cell grid are M87's; the mask radius of three
D25 radii and the clamp window are M87's rules; the nine-tenths limit on a mask and the star mask radius are this
route's; the dots' color is the Milky Way globular clusters'.

## Evidence

![M89 in the app](evidence/2026-10-03/views.jpg)

The M89 page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-03: the default
arrival, then the camera turned to the side and to above the galaxy.

- The volume reproduces the cleaned image along every sight line it covers (the method conditions on it); at most
  2.3% of a channel's light lies outside the 41.4 kpc spheroid and is not drawn.
- The cutout's registration is its request: a tangent projection on the HyperLEDA position, north up.
- Tests: `labs/nebula/packages/reconstruction/src/methods/symmetry/processing.test.ts` pins the isophote fill;
  `shape-prior.test.ts` pins the Sérsic spheroid.

## Known problems

- A faint straight streak towards the south-west corner of the cutout remains in the cleaned image and is spread in depth like the rest of the light.
- One smooth spheroid: any shells, dust or discs in M89 are spread through it like the rest of the light.
- The image is a stretched display composite, so the volume's brightness is not proportional to the starlight.
- The survey image is shallower than Kormendy et al.'s photometry: its light comes within one count of the sky
  400″ from the centre, before the spheroid's edge at 530.884″, so the outermost part of the spheroid is nearly empty.
- The red channel reaches 255 at the nucleus, so sight lines through the very centre carry less red light than the
  profile gives them. M49's volume shows a faint cross through its core for the same reason.
- The clusters fill only the Hubble ACS field on the centre, about 200″ across; none are drawn beyond it.
