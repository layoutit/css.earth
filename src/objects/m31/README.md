# Andromeda Galaxy (M31)

A survey photograph of M31, cleaned of the Milky Way stars and companion galaxies in front of it and colour-tied to its
measured integrated colour, is spread through a modelled disc and a round bulge. Published catalogues of its HII regions,
Cepheids, supernova remnants, planetary nebulae and stars are drawn as dots on the same disc. Image brightness does not
measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Panorama of Spiral Galaxy, M31](https://noirlab.edu/public/images/noao-m31lgs_ubvIha/) | [Record](../../sources/noirlab-noao-m31lgs.json). The Local Group Survey's panorama from the Mayall 4-meter telescope (Mosaic camera, ten pointings in U, B, V, I and H-alpha), 48327 × 12185 px over 217.62 × 54.87 arcmin: the photograph's main input. Found with `telescope explore m31` among its WorldWide Telescope imagery. |
| [Wide-field view of the Andromeda Galaxy](https://esahubble.org/images/heic1112f/) | [Record](../../sources/esa-heic1112f.json). ESA/Hubble's DSS2 view (`heic1112f`, the tracked crop `source/source.jpg`), filling the survey mosaic's notches and the outer disc. |
| [Dorman et al. (2013)](https://arxiv.org/abs/1310.4179) | [Record](../../sources/dorman-2013-m31-structural-decomposition.json). Table 3's bulge-plus-disc fit of the sky light: a Sérsic bulge (half-light radius 0.778 kpc, n = 1.917, ellipticity 0.277) and an exponential disc (scale length 5.76 kpc, ellipticity 0.725) on one position angle (44.4°). It splits the photograph's light between bulge and disc, gives the bulge its shape, and its disc ellipticity gives the disc's inclination, 74.0° in the thin-disc limit. |
| [Dalcanton et al. (2023)](https://arxiv.org/abs/2304.08613) | [Record](../../sources/dalcanton-2023-m31-thick-disk.json). Sect. 3.3: M31's red-giant stars have an exponential scale height of 770 ± 80 pc. The planetary nebulae take it. |
| [Braun (1991)](https://doi.org/10.1086/169954) | [Record](../../sources/braun-1991-m31-neutral-gas.json). Sect. 5.3, eq. 13: the H I layer's exponential scale height, 182 + 16 R pc (R in kpc). The young dots and stars take it, and the photograph's diffuse slabs take its value at the 10 kpc ring, 342 pc. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | [Gaia record](../../sources/gaia-2023-dr3.json) (the query), [Ren record](../../sources/ren-2021-m31-m33-red-supergiants.json). The 148,335 Gaia DR3 sources within 2.3° of M31 that Ren et al.'s Sect. 3.2 criterion marks as Milky Way stars (`source/gaia-dr3-foreground.csv`, restored by the query). |
| [Local Volume Database v1.1.1](../../sources/lvdb-v1-1-1.json) | M32's and NGC 205's centres and half-light ellipses (structure from McConnachie 2012), read from `src/objects/local-group/source/lvdb/comb_all.csv`. |
| [RC3](../../sources/rc3-1991.json) | NGC 224's total B-V, 0.92 ± 0.02 as observed (0.68 corrected for Galactic and internal extinction; CDS VII/155). |
| [Azimlu et al. (2011)](https://doi.org/10.1088/0004-6256/142/4/139) | [HII regions](source/azimlu-hii/points.json): 3,961 regions from H-alpha images of the whole disc (CDS J/AJ/142/139). |
| [Kodric et al. (2013)](https://doi.org/10.1088/0004-6256/145/4/106) | [Cepheids](source/pandromeda-cepheids/points.json): 2,009 Cepheids from Pan-STARRS1 PAndromeda (CDS J/AJ/145/106). |
| [Lee & Lee (2014)](https://doi.org/10.1088/0004-637X/786/2/130) | [Supernova remnant candidates](source/lee-snr/points.json): 156 (CDS J/ApJ/786/130). |
| [Merrett et al. (2006)](https://doi.org/10.1111/j.1365-2966.2006.10268.x) | [Planetary nebulae](source/merrett-pne/points.json): 2,574 of 3,300 emission-line objects, after the authors' own flags (CDS J/MNRAS/369/120). |
| [Massey et al. (2006)](https://doi.org/10.1086/503256) | [Stars](source/lggs-stars/points.json): the Local Group Galaxies Survey's 371,781 M31 stars with UBVRI photometry over 2.2 deg² along the major axis (CDS J/AJ/131/2478 `table4.dat.gz`, 12.5 MB, restored from its origin). |
| [Johnson et al. (2015)](https://doi.org/10.1088/0004-637X/802/2/127) | [Star clusters](source/phat-clusters/points.json): 2,753 PHAT clusters, north-east third of the disc only; prepared, not drawn. |
| [Ibata et al. (2005)](https://arxiv.org/abs/astro-ph/0504164) | [Stellar extent](source/stellar-extent.json): stars measured out to about 40 kpc; inside it M31's caption hides. |

## The photograph

[`compose-optical.mts`](../../../packages/bake/authoring/m31/compose-optical.mts) builds the image-layer input
(`source/optical-composite.jpg`, 7560 × 2520 px at 2″ per pixel along the major axis) from the two publisher images:

- **Survey where it has data:** the panorama is about three times sharper than the DSS2 view, but it is a strip 55′ wide
  whose mosaic notches reach 11.8 kpc into the disc. The DSS2 view fills them and the outer disc: 6,849,915 pixels come from
  the survey, 10,004,307 from the fill.
- **Fill matched to the survey:** per-channel histogram matching over the pixels both cover, and a 2′ fade inside the
  mosaic's edge ([report](evidence/2026-09-29/optical-composite.json)).

The image-layer bake ([`prepare.ts`](../../../packages/bake/src/image-layers/prepare.ts)) then, in this order:

- **Removes foreground stars** ([`foreground.ts`](../../../packages/bake/src/image-layers/foreground.ts)): each Gaia
  foreground star is measured in the image and, where it shows, replaced by the light around it. 30,084 of the 52,363 in
  the image are removed; 1,080 sit on extended light (a galaxy core or cluster) and are left. Laid on the disc, a round
  foreground star becomes a dash 3.6 times longer than wide, which is why they must go.
- **Removes M32 and NGC 205** the same way, out to 8.4 and 3 half-light radii, where their glow ends in the image.
- **Ties the colour** to RC3's B-V of 0.92 (as observed, through the Milky Way, like the photograph): red and blue are
  scaled in linear light so the disc's mean colour matches the app's catalogue colour for that index. Measured red/green
  1.453 and blue/green 0.681 against 1.302 and 0.786; gains red 0.896, blue 1.154. The publisher's U-to-H-alpha mapping
  had run red.
- **Splits bulge from disc** by Dorman et al.'s fitted share of the light at each sky position. Where the photograph is
  saturated (26,239 pixels) it holds no split, so the fit's own bulge and disc light stand in, scaled to the photograph
  just below saturation, with the colour of that light. Within about 2 kpc the disc takes the fit's disc light rather than
  the photograph's share: the photograph's display stretch compresses bright light, so its share keeps the bulge's rounder
  sky shape and would deproject into a streak.

## Disc, bulge and depth

- **Disc:** inclination 74.0° (Dorman et al.'s disc ellipticity 0.725), line of nodes 37.7° (Chemin et al. 2009, the
  recipe's). It ends at 27.2 kpc, where the DSS2 view's frame stops on its tightest side, fading from 20.4 kpc
  (`supportRadiusKpc` 27.2, `supportTaperFraction` 0.75), so no frame edge shows.
- **Thickness:** the 32 diffuse slabs follow an exponential of 342 pc over ±3 scale heights (2.05 kpc). Each slab is the
  photograph reprojected along our sight lines, so a thicker stack smears it across the minor axis seen from above; the
  measured 770 pc of the old stars (Dalcanton et al.) did that visibly, and the gas layer's value was chosen from top-down
  renders of both.
- **Bulge:** an oblate spheroid with Dorman et al.'s Sérsic profile, deprojected (Prugniel & Simien 1997), and intrinsic
  axis ratio 0.695, the one that projects to their sky ellipticity 0.277 at 74°. Its share of the light is spread through
  it along each of our sight lines, in 40 slices parallel to the disc and 24 curtains in each side bank, normalised so the
  view from the Sun is the photograph. Seen from above it stays round.
- **Levels:** none. The photograph is shown as published apart from the steps above; darker midtones were tried and
  dropped because they cut the faint outer disc.

## Dots and stars

The catalogues give sky positions only. [`prepare-catalogue-points.mts`](../../../packages/bake/cli/prepare-catalogue-points.mts)
places each object on the image layers' disc (`frame.placement: image-layer-disc`,
[`disc.ts`](../../../packages/bake/src/image-layers/disc.ts)), and
[`merge-catalogue-points.mts`](../../../packages/bake/cli/merge-catalogue-points.mts) joins them into the
[dots](source/dots/merge.json) and the [stars](source/stars/merge.json) the app draws over the image layers:

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| HII regions (Azimlu et al. 2011) | 3,961 | none |
| Cepheids (Kodric et al. 2013) | 1,992 | 17 beyond the photograph |
| Supernova remnant candidates (Lee & Lee 2014) | 156 | none |
| Planetary nebulae (Merrett et al. 2006) | 2,463, 355 of them in the bulge | 111 beyond the photograph, 726 flagged by the authors |
| Stars (Massey et al. 2006) | 4,969 | 18,959 Gaia foreground stars; then one in 71 is kept |

- **Depth:** every dot keeps its place in the disc (the midplane point under its catalogue position) and moves along the
  disc's axis to a height drawn from its population's published layer: HII regions, Cepheids, remnants and stars from
  Braun's gas layer (young objects form from it; an upper value), planetary nebulae from Dalcanton et al.'s 770 pc. Moving
  along the sight line instead would keep the sky position but shift a dot z tan i (3.5 z) across the disc, scattering the
  arms seen from above; seen from the Sun a dot now sits up to z sin i from its catalogue position.
- **Bulge members:** a planetary nebula is a bulge member with the bulge's share of Dorman et al.'s light at its sky
  position, and sits along its sight line at a depth drawn from the bulge's density. Young objects stay in the disc.
- **Tone:** the dots take the Milky Way's colours for their kinds, mixed halfway to white and raised to the power 1.6.
  HII regions, Cepheids, remnants and disc planetary nebulae are toned to 60%, since at full tone they outshone the disc;
  bulge planetary nebulae keep full tone, since a darkened dot reads as a speck on the bright bulge. Stars are coloured by
  their measured B-V through the app's star colour, at M33's size and opacity. All presentation choices.
- **Where they stop:** only inside the 27.2 kpc support, so every dot sits on the photograph.
- **Stars:** the survey could not resolve the crowded bulge, so its stars thin out toward the centre.

The published [disc geometry](source/disc-geometry.json) records Corbelli et al. (2010, 77.7°, 38°) with Dalcanton et
al. (77° ± 0.5°), Chemin et al. (74.3°, 37.7°) and Dorman et al. (PA 44.4°) as cross-checks. The disc warps to 86° beyond
30 kpc; one flat plane ignores that.

## Evidence

- [Before and after](evidence/2026-09-29/before-after.jpg): the app close to Earth's angle and tilted, and a top-down
  composite of the z bank, before (DSS2, 77.5°, dots along sight lines) and after. Captured on this branch on 2026-09-29.
- [Composite report](evidence/2026-09-29/optical-composite.json): pixels from each input and the histogram-matching curve.
- The prepared bank's `approximation.limitations` records the foreground, companion, colour-tie and saturation counts
  quoted above.
- Bytes: 170 layer images, 3.09 MB (3.56 MB before). The midplane texture uses WebP alpha quality 60: re-encoded at 60, it
  shows no pixel differences under pixelmatch at threshold 0.1 against lossless alpha, at half the bytes.
- Tests: `tests/image-layers/disc.test.mts`, `foreground.test.mts` and `bulge.test.mts` pin the placement, the star and
  companion removal and the bulge model.

## Known problems

- **One flat disc and one bulge fit:** the warp, the bar and the boxy inner bulge are not modelled. The fit's position
  angle (44.4°) differs from the disc's line of nodes (37.7°); the share uses the fit's own, the disc the recipe's.
  Dorman et al.'s halo term is left out of the share.
- **Saturated core:** 26,239 pixels carry the fit's light, not the photograph's.
- **Fill:** the DSS2 fill is blurrier than the survey; a fading seam may show up close in the outer disc.
- **Depth is modelled:** the slabs and the bulge volume are copies of the photograph along our sight lines, so side views
  are approximations; the dots' heights are drawn, not measured.
- **Remaining stars:** Gaia foreground stars too faint to show, uncatalogued ones and M31's own compact sources stay in the
  photograph and, seen at a slant, still stretch a little.

<details>
<summary>Reproduction</summary>

Restore `source/lggs-panorama.jpg` from the NOIRLab Large JPEG, `source/gaia-dr3-foreground.csv` from the query in the
Gaia record and `source/lggs-stars/table4.dat.gz` from CDS, then run `node packages/bake/authoring/m31/compose-optical.mts`,
`node packages/bake/cli/prepare-image-layers.mts src/objects/m31`, the catalogue commands for each bank and the two
merges. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes the image-layer bank; the
[manifest](source/manifest.json), [provenance](source/provenance.json) and [investigation ledger](investigations.json)
record the inputs.

</details>
