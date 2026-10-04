# VHS 1256-1257 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

VHS 1256-1257 b is a young companion of about 12 Jupiter masses, 8 arcseconds (about 150 au) from the close pair [VHS 1256-1257 A and B](../vhs-1256-1257/README.md), 21 parsecs away. It is the main spectroscopy target of the JWST Early Release Science programme for exoplanets, whose 1 to 20 micrometre spectrum shows water, methane, carbon monoxide, carbon dioxide and silicate clouds (Miles et al. [2023](https://arxiv.org/abs/2209.00620)).

## Sources

**Orbit.** Poon et al. ([2024](https://arxiv.org/abs/2410.02672), AJ 168, 270), section 3.4, fit the four Keck/NIRC2 positions of Dupuy et al. (2023, Table 2) with orbitize! and publish only medians (a 383 +99/−150 au, e 0.70, i 23°). Dupuy et al. measure those positions from star A, which swings around the pair's centre of mass on the 7.3-year A–B orbit; as Dupuy et al. do, the positions are first moved to the centre of mass with the A–B orbit of their Table 3 and B's share of the pair's mass, 0.55 (their fitted A share is 0.45 ± 0.08). [`orbitize-fit.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/orbitize-fit.py) then runs orbitize!'s MCMC on those inputs with Poon et al.'s priors (total mass 0.152 ± 0.010 solar masses, parallax 47.27 ± 0.47 mas) and keeps the maximum of its posterior, refined from many starts ([fit.json](source/orbits/fit.json)). The recorded orbit: a = 442 au at the Gaia DR3 distance, e = 0.64, i = 46.3°, period about 23,650 years. The path drawn is this one orbit. It is loosely pinned down: the same four positions allow semi-major axes from 150 to 1,020 au (Dupuy et al. 2023, Table 4, 95% range), so the drawn path is one possibility, not a measured track. Every element and its derivation is in [`vhs-1256-1257-b.json`](../../../packages/astronomy/data/bodies/vhs-1256-1257-b.json).

**Radius, temperature and mass.** Radius 1.27 Jupiter radii and temperature 1100 K: the best-matching model of Miles et al. (2023, ApJL 946, L6; doi:10.3847/2041-8213/acb04a; arXiv:2209.00620) to the JWST NIRSpec and MIRI spectrum from 1 to 20 micrometres, two cloud decks at log g 4.5: 90,794.8 km at 71,492 km per Jupiter radius. A model radius, not a measured diameter: the planet is unresolved. Other fits to the same JWST data give 1.29 (Whiteford et al. 2026, arXiv:2608.06583) and 1.433 Jupiter radii (de Regt et al. 2026, arXiv:2607.00952); Dupuy et al. (2023) derive 1.30 or 1.22 from evolutionary models. GM from 0.011 +/- 0.006 solar masses (11.5 Jupiter masses), the mass Dupuy et al. (2023, section 4) estimate from evolutionary models and add to the pair's for the orbit fit, times the JPL solar GM; their evolutionary analysis is bimodal, 12.0 +/- 0.1 or 16 +/- 1 Jupiter masses. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red MKO K 2.184 µm (965.9 ± 110 µJy), green MKO H 1.614 µm (505.9 ± 7.5 µJy), blue MKO J 1.2417 µm (215.9 ± 4 µJy) (Best et al. (2021); McMahon et al. (2013), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (MKO K), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law fitted to the MKO H intensity PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70) computes from Sonora Diamondback cloudy (Morley et al. 2024, ApJ 975, 59; [M/H] +0.5, f_sed 1) model atmospheres at 1,116 K and log g 3.5, read between the models t1100g31f1_m+0.5_co1.0, t1100g100f1_m+0.5_co1.0, t1200g31f1_m+0.5_co1.0, t1200g100f1_m+0.5_co1.0 (u1 0.406, u2 0.000; the law fits each model's eight angles within 0.02% of the centre): a cloudy model, the one Petrus et al. (2024), ApJL 966, L11 fit to this planet, because no table reaches a planet this cold and nobody has resolved its disc ([nodes](source/photometry/picaso-diamondback-h-quadratic.tsv)). The temperature and gravity are that fit's (Table 4, Sonora, full spectrum: Teff 1116 +/- 1, log(g) < 3.50, [M/H] > 0.50, f_sed 1.01 +/- 0.01; the two limits are the grid's edges, and f_sed is read at the grid's 1; [record](source/photometry/atmosphere-fit.json)), not the 1,100 K of its measurements record.

**Rotation.** No spin axis on the sky is measured; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The planet moves across the sky at about 10 mas a year, close to the fastest a bound orbit this far out allows, so the orbits that fit crowd toward high eccentricity and the recorded one is eccentric (e 0.64). The orbit is about the pair's centre of mass but is drawn around A, which lies up to about 50 mas from that centre on the sky; on an 8-arcsecond separation neither offset is visible.
- The radius and mass are model values; the planet is a point in every image.
- No spin axis is measured.
- **Model limb.** The limb darkening is computed from the cloudy model a paper fitted to the planet, in the middle band of its color, not a measurement of this planet; another model grid would give another law.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
