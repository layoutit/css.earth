# Andromeda Galaxy (M31)

A survey photograph of M31, cleaned of the Milky Way stars and companion galaxies in front of it and colour-tied to its
measured integrated colour, is spread through a modelled disc and a round bulge. Published catalogues of its HII regions,
Cepheids, supernova remnants, planetary nebulae and stars are drawn as dots on the same disc. Image brightness does not
measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Panorama of Spiral Galaxy, M31](https://noirlab.edu/public/images/noao-m31lgs_ubvIha/) | [Record](../../sources/noirlab-noao-m31lgs.json). The Local Group Survey's Mayall 4-meter panorama in U, B, V, I and H-alpha: the photograph's main input. |
| [Wide-field view of the Andromeda Galaxy](https://esahubble.org/images/heic1112f/) | [Record](../../sources/esa-heic1112f.json). ESA/Hubble's DSS2 view (`heic1112f`), filling the survey mosaic's notches and the outer disc. |
| [Dorman et al. (2013)](https://arxiv.org/abs/1310.4179) | [Record](../../sources/dorman-2013-m31-structural-decomposition.json). Table 3's bulge-plus-disc fit: a Sérsic bulge (half-light radius 0.778 kpc, n = 1.917) and an exponential disc (scale length 5.76 kpc). |
| [Dalcanton et al. (2023)](https://arxiv.org/abs/2304.08613) | [Record](../../sources/dalcanton-2023-m31-thick-disk.json). Red-giant scale height 770 ± 80 pc, taken by the planetary nebulae. |
| [Braun (1991)](https://doi.org/10.1086/169954) | [Record](../../sources/braun-1991-m31-neutral-gas.json). The H I layer's scale height, 182 + 16 R pc (R in kpc), taken by the young dots, stars and diffuse slabs. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | [Gaia record](../../sources/gaia-2023-dr3.json), [Ren record](../../sources/ren-2021-m31-m33-red-supergiants.json). The 148,335 sources within 2.3° of M31 that Ren et al.'s criterion marks as Milky Way stars. |
| [Local Volume Database v1.1.1](../../sources/lvdb-v1-1-1.json) | M32's and NGC 205's centres and half-light ellipses (structure from McConnachie 2012). |
| [RC3](../../sources/rc3-1991.json) | NGC 224's total B-V, 0.92 ± 0.02 as observed (CDS VII/155). |
| [Azimlu et al. (2011)](https://doi.org/10.1088/0004-6256/142/4/139) | [HII regions](source/azimlu-hii/points.json): 3,961 regions (CDS J/AJ/142/139). |
| [Kodric et al. (2013)](https://doi.org/10.1088/0004-6256/145/4/106) | [Cepheids](source/pandromeda-cepheids/points.json): 2,009 Cepheids from Pan-STARRS1 PAndromeda (CDS J/AJ/145/106). |
| [Lee & Lee (2014)](https://doi.org/10.1088/0004-637X/786/2/130) | [Supernova remnant candidates](source/lee-snr/points.json): 156 (CDS J/ApJ/786/130). |
| [Merrett et al. (2006)](https://doi.org/10.1111/j.1365-2966.2006.10268.x) | [Planetary nebulae](source/merrett-pne/points.json) (CDS J/MNRAS/369/120). |
| [Massey et al. (2006)](https://doi.org/10.1086/503256) | [Stars](source/lggs-stars/points.json): the Local Group Galaxies Survey's 371,781 M31 stars with UBVRI photometry (CDS J/AJ/131/2478). |
| [Johnson et al. (2015)](https://doi.org/10.1088/0004-637X/802/2/127) | [Star clusters](source/phat-clusters/points.json): 2,753 PHAT clusters, north-east third of the disc only; prepared, not drawn. |
| [Ibata et al. (2005)](https://arxiv.org/abs/astro-ph/0504164) | [Stellar extent](source/stellar-extent.json): stars measured out to about 40 kpc; inside it M31's caption hides. |

## The photograph

[`compose-optical.mts`](../../../packages/bake/authoring/m31/compose-optical.mts) builds the image-layer input
(`source/optical-composite.jpg`, 7560 × 2520 px). The DSS2 view fills the panorama's
mosaic notches and the outer disc, histogram-matched to the survey with a 2′ fade inside the mosaic's edge. The
composite is not tracked; `restore-source-inputs.mts` restores it from `source-cache/m31/src/objects/m31/source/optical-composite.jpg`.

The image-layer bake ([`prepare.ts`](../../../packages/bake/src/image-layers/prepare.ts)) then:

- **Removes foreground stars** ([`foreground.ts`](../../../packages/bake/src/image-layers/foreground.ts)), replacing
  30,084 of the 52,363 Gaia foreground stars in the image with the light around them.
- **Removes M32 and NGC 205** the same way, out to 8.4 and 3 half-light radii.
- **Ties the colour** to RC3's B-V of 0.92 by scaling red and blue in linear light (gains red 0.896, blue 1.154).
- **Splits bulge from disc** by Dorman et al.'s fitted share of the light at each sky position. Where the photograph is
  saturated, the fit's own light stands in.

## Disc, bulge and depth

- **Disc:** inclination 74.0° (from Dorman et al.'s disc ellipticity), line of nodes 37.7° (Chemin et al. 2009). It
  ends at 27.2 kpc, where the DSS2 frame stops, fading from 20.4 kpc so no frame edge shows.
- **Thickness:** 32 diffuse slabs follow an exponential of 342 pc, Braun's value at the 10 kpc ring, chosen because
  770 pc visibly smeared the photograph seen from above.
- **Bulge:** an oblate spheroid with Dorman et al.'s Sérsic profile, deprojected (Prugniel & Simien 1997), with intrinsic
  axis ratio 0.695. The view from the Sun is the photograph; seen from above the bulge stays round.
- **Levels:** none; the photograph is shown as published apart from the steps above.

## Dots and stars

The catalogues give sky positions only. [`prepare-catalogue-points.mts`](../../../packages/bake/cli/prepare-catalogue-points.mts)
places each object on the image layers' disc ([`disc.ts`](../../../packages/bake/src/image-layers/disc.ts)), and
[`merge-catalogue-points.mts`](../../../packages/bake/cli/merge-catalogue-points.mts) joins them into the
[dots](source/dots/merge.json) and the [stars](source/stars/merge.json):

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| HII regions (Azimlu et al. 2011) | 3,961 | none |
| Cepheids (Kodric et al. 2013) | 1,992 | 17 beyond the photograph |
| Supernova remnant candidates (Lee & Lee 2014) | 156 | none |
| Planetary nebulae (Merrett et al. 2006) | 2,463, 355 of them in the bulge | 111 beyond the photograph, 726 flagged by the authors |
| Stars (Massey et al. 2006) | 4,969 | 18,959 Gaia foreground stars; then one in 71 is kept |

Each dot keeps its place in the disc at a height drawn from its population's layer: Braun's gas layer for young objects,
770 pc for planetary nebulae. Dots are toned by the photograph beneath them so they sit in the galaxy's light; stars are
coloured by their measured B-V. These are presentation choices.

## Evidence

- [Composite report](evidence/2026-09-29/optical-composite.json): pixels from each input (6,849,915 from the survey,
  10,004,307 from the fill) and the histogram-matching curve.
- Bytes: 170 layer images, 3.09 MB. The midplane texture's WebP alpha quality 60 shows no pixel differences under
  pixelmatch at threshold 0.1 against lossless alpha, at half the bytes.

## Known problems

- **One flat disc and one bulge fit:** the warp to 86° beyond 30 kpc, the bar and the boxy inner bulge are not
  modelled. The fit's position angle (44.4°) differs from the disc's line of nodes (37.7°). Dorman et al.'s halo term is
  left out of the share.
- **Saturated core:** 26,239 pixels carry the fit's light, not the photograph's.
- **Fill:** the DSS2 fill is blurrier than the survey; a fading seam may show up close in the outer disc.
- **Depth is modelled:** the slabs and bulge are copies of the photograph along our sight lines, so side views are
  approximations; the dots' heights are drawn, not measured.
- **Remaining stars:** 1,080 foreground stars on extended light are left, as are Gaia stars too faint to show,
  uncatalogued ones and M31's own compact sources. Seen at a slant they still stretch a little. The survey could not
  resolve the crowded bulge, so its stars thin out toward the centre.

<details>
<summary>Reproduction</summary>

Restore `source/lggs-panorama.jpg` from the NOIRLab Large JPEG, `source/gaia-dr3-foreground.csv` from the query in the
Gaia record and `source/lggs-stars/table4.dat.gz` from CDS, then run `node packages/bake/authoring/m31/compose-optical.mts`,
`node packages/bake/cli/prepare-image-layers.mts src/objects/m31`, the catalogue commands for each bank and the two
merges. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes the image-layer bank; the
[manifest](source/manifest.json), [provenance](source/provenance.json) and [investigation ledger](investigations.json)
record the inputs.

</details>
