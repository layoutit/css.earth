# Beta Pictoris d

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

Beta Pictoris d is a cool giant planet about 26 au from [Beta Pictoris](../beta-pictoris/README.md), announced in 2026 after it had hidden in a decade of images.

## Sources

**Orbit.** Sutlieff, Bonse et al. (2026, [arXiv:2606.23801](https://arxiv.org/abs/2606.23801)), Table 2: a 26.0 +2.2/−6.1 au, inclination 89.0 +0.7/−0.6°, node 210.8 +0.6/−0.4° (prior-independent), eccentricity below 0.44 at 2σ, period 91 +18/−27 years. Their orbit is still poorly constrained, so this record is a circular orbit at the published semi-major axis, inclination and node, with a Kepler period of 99.6 years for the system's mass. Its phase is fitted to the six measured positions in their Table 1 (VLT/SPHERE 2014, 2019, 2020; JWST/NIRCam 2023, 2025; VLT/ERIS 2025): χ² 12.5 for 11 degrees of freedom, every residual within 35 mas ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)). A free circular fit would prefer 94.5 years.

**Radius and mass.** 1.26 ± 0.03 Jupiter radii and 2.4 ± 0.6 Jupiter masses, evolutionary-model estimates from the planet's photometry (Sutlieff et al. 2026, Table 2), at 600 K. Neither is measured directly.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red F444W 4.35 µm (242.7 ± 45 µJy), green F410M 4.072 µm (173.6 ± 32 µJy), blue ERIS L′ 3.78 µm (141.5 ± 21 µJy) (Sutlieff, Bonse et al. (2026), arXiv:2606.23801; zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (F444W), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law fitted to the JWST/NIRCam F410M intensity PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70) computes from Exo-REM cloudy (Charnay et al. 2018, ApJ 854, 172; 3.16 times solar metallicity, C/O 0.65) model atmospheres at 600 K and log g 4, read between the models YGP_550K_logg3.5, YGP_550K_logg4.0, YGP_600K_logg3.5, YGP_600K_logg4.0 (u1 0.781, u2 0.156; the law fits each model's eight angles within 0.13% of the centre): a cloudy model, the one Sutlieff, Bonse et al. (2026), arXiv:2606.23801 fit to this planet, because no table reaches a planet this cold and nobody has resolved its disc ([nodes](source/photometry/picaso-exo-rem-f410m-quadratic.tsv)). The temperature and gravity are that fit's (Section III.5 and Figure 5: the Exo-REM models of log g 4.0, [Fe/H] 0.5 and C/O 0.65 (the composition of the best-fit model of 51 Eridani b) fit all of the planet's photometry; the temperature is the paper's 600 +45/-60 K (Table 2), from evolutionary models; [record](source/photometry/atmosphere-fit.json)), not the 600 K of its measurements record. The paper shows this model as the match to the photometry; it reports no fitted temperature, so the law is read at its evolutionary-model temperature.

**Rotation.** Not measured; the display axis is the orbit normal and nothing turns.

## Evidence

Run of 2026-09-22 (this version): [`node packages/bake/src/prepare-object/index.ts beta-pictoris-d`](../../../packages/bake/cli/prepare-object.mts) prepared the package through its world step; the orbit test above passes. The planet's orbit lies inside the disc's visible-light dataset, 16 to 82 au ([disc README](../beta-pictoris-disc/README.md)).

## Known problems

- The orbit is circular by convention; the paper bounds the eccentricity but gives no median.
- Radius and mass are model values.
- No rotation is measured.
- **Model limb.** The limb darkening is computed from the cloudy model a paper fitted to the planet, in the middle band of its color, not a measurement of this planet; another model grid would give another law. Among the 4 models it is read between, the disc near its edge (the lowest of the eight angles) is 25% to 31% as bright as the centre. PICASO finds 99% to 129% of the band flux the release states for those models.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
