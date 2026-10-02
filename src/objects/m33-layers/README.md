# Triangulum Galaxy (M33)

A publisher optical image supplies the color of a disc whose depth follows a published scale height, with M33's catalogued objects and stars drawn as dots on it. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [VST snaps a very detailed view of the Triangulum Galaxy](https://www.eso.org/public/images/eso1424a/) | `eso1424a`; 4000 × 3355 pixels; publisher JPEG. |
| Geometry reference | Corbelli et al. 2014, arXiv:1409.2665. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |
| [McConnachie et al. (2010)](https://arxiv.org/abs/1009.2804) | [Stellar extent](source/stellar-extent.json): M33's red-giant substructure reaches projected radii of about 40 kpc. Inside 40 kpc M33's caption hides. It marks where stars are still measured, not a boundary. |
| [Hodge et al. (1999)](https://doi.org/10.1086/316374) | [HII regions](source/hodge-hii/points.json): 1,272 regions new in 1999, from H-alpha images (CDS J/PASP/111/685). The 1,066 regions of earlier catalogues, the brightest among them, are not in this table. |
| [Pellerin & Macri (2011)](https://doi.org/10.1088/0067-0049/193/2/26) | [Cepheids](source/pellerin-cepheids/points.json): 563 Cepheids of the M33 Synoptic Stellar Survey main sample (CDS J/ApJS/193/26). |
| [Long et al. (2010)](https://doi.org/10.1088/0067-0049/187/2/495) | [Supernova remnants](source/long-snr/points.json): 137 remnants and candidates (CDS J/ApJS/187/495). |
| [Ciardullo et al. (2004)](https://doi.org/10.1086/423414) | [Planetary nebulae](source/ciardullo-pne/points.json): 152 candidates from [O III] imaging (CDS J/ApJ/614/167). Its adopted disc scale height gives the dots and the photograph their depth. |
| [Sarajedini & Mancone (2007)](https://doi.org/10.1086/518835) | [Star clusters](source/sarajedini-clusters/points.json): the 255 of 451 candidates the authors class as clusters (CDS J/AJ/134/447). |
| [Massey et al. (2006)](https://doi.org/10.1086/503256) | [Stars](source/lggs-stars/points.json): 146,622 stars of the Local Group Galaxies Survey with UBVRI photometry (CDS J/AJ/131/2478, `table5.dat.gz`). |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) with [Ren et al. (2021)](https://doi.org/10.3847/1538-4357/abcda5) | Foreground stars: the 8,330 Gaia DR3 sources within 0.75° of M33's centre that Ren et al.'s criterion marks as Milky Way stars (query in the [Gaia DR3 record](../../sources/gaia-2023-dr3.json)). |
| [Koch et al. (2018)](https://doi.org/10.1093/mnras/sty1674) | [Disc geometry](source/disc-geometry.json): inclination 55.08° ± 1.56° and position angle 201.12° ± 0.47° from a fit to the whole H I velocity field (Table 2). |

The catalogues give sky positions only, so each object is placed where its sight line crosses the midplane of the disc the image layers are baked on (`frame.placement: image-layer-disc`, [`disc.ts`](../../../packages/bake/src/image-layers/disc.ts)), as M31's are. [`merge-catalogue-points.mts`](../../../packages/bake/cli/merge-catalogue-points.mts) joins them into two banks the app draws over the image layers, the [stars](source/stars/merge.json) under the [dots](source/dots/merge.json):

| Catalogue | Drawn | Left out |
| --- | --- | --- |
| HII regions (Hodge et al. 1999) | 1,272 | none |
| Cepheids (Pellerin & Macri 2011) | 562 | 1 beyond the photograph |
| Supernova remnants (Long et al. 2010) | 137 | none |
| Planetary nebulae (Ciardullo et al. 2004) | 150 | 2 beyond the photograph |
| Star clusters (Sarajedini & Mancone 2007) | 255 | 196 the authors class as stellar, galaxy, unknown or on a chip gap |
| LGGS stars (Massey et al. 2006) | 4,890 | 4,130 Gaia foreground stars; 706 beyond the photograph; then one in 29 is kept |

Every dot keeps its place in the disc and moves along the disc's axis to a height drawn from an isothermal sheet, sech²(z/z0) with z0 = 175 pc: the scale height Ciardullo et al. (2004, Sect. 6) adopt for M33's planetary nebulae, the only one these sources state (at least ±25%). Young tracers are thinner in disc galaxies, so for HII regions, Cepheids and clusters it is an upper value. Half the dots lie within 100 pc of the midplane, 90% within 253 pc. The spread is published; no dot's own height is measured, and the draw is seeded so a bake repeats it.

Ren et al. (2021, Sect. 3.2) call a star foreground when its Gaia parallax, measured to better than 20%, puts it within 50 kpc, or its proper motion in either coordinate exceeds 0.2 mas/yr (500 km/s at M33) plus 2σ, measured to better than 20%. The same criterion is applied to Gaia DR3 (they used DR2), and an LGGS star within 1 arcsec of a foreground source is left out.

One LGGS star in 29, in catalogue order, keeps 4,890 of 141,786 inside the renderer's 5,000-dot bank and thins every region alike, so the density contrast stays the survey's. The survey is limited by crowding in the centre, so there its density is a floor.

Each star takes its measured B−V (observed, not dereddened) through the app's catalogue star color; the other catalogues take the Milky Way color for their kind of object, as M31's do. Each catalogue dot (not the stars) takes its tone from the photograph's brightness under it (never below 15%) and moves halfway from its kind's color to the photograph's color there. All are mixed halfway to white and raised to the power 1.6. These are presentation choices. Dots are drawn only inside the image layers' 8.7 kpc support radius, so every dot sits on the photograph.

The dots use the image layers' inclination (54°) and line of nodes (22.5°), so that they sit on the photograph. The published [disc geometry](source/disc-geometry.json) of Koch et al. (2018), from arXiv:1806.11218v2, is 1.1° and 1.4° from the recipe's. One flat plane ignores the warp that Corbelli et al. (2014) find beyond the optical disc.

### The photograph's disc

The photograph's frame reaches only 8.7 kpc into the disc on its tightest side, so the disc ends there and fades from 6.5 kpc (`supportRadiusKpc` 8.7, `supportTaperFraction` 0.75). The 32 diffuse slabs follow the same sech²(z/175 pc) profile as the dots, over ±3 z0 (1.05 kpc). They are baked 80 pixels across, so they hold the photograph's low-frequency light and no knots; the midplane layer keeps the full detail.

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records.

The [manifest](source/manifest.json) records complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification.

## Evidence

Measured in the app with dots hidden: tilting from face-on to just before edge-on dims the photograph's total light from 3.4 to about 0.5 (screen luminance above the sky), and the edge-on layers that take over show 0.16. A brighter edge-on bake (up to 5×, still thin) was tried and not adopted.

## Known problems

- The 68 by 57 arcminute VST field contains the full bright optical disk. The larger warped neutral-hydrogen outskirts are not represented.
- Foreground stars and background objects remain in the image. Compact features are not classified or individually placed in three dimensions; no point-source removal is applied.
- The photograph fades as it tilts toward edge-on: its layers cannot brighten with the longer path through the disc, and edge-on it is a faint strip.
- Exact source fields, uncertainties and coordinate epoch for the image layers' adopted orientation and placement remain incompletely recorded. No independent sky-registration or measured-depth acceptance is available here.

<details>
<summary>Image-layer preparation and reproduction</summary>

The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 slabs following the published sech² profile above; cross-axis textures sample the same separable field. This is not measured per-pixel depth.

Lossy WebP encoding can differ across platforms, so a new replay must compare its output against the published bank and report differences. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes reproduction.

</details>
