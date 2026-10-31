# Pleiades dust

A regional Milky Way dust model selected by the [Pleiades dataset](../m45/README.md). Infrared-constrained foreground structure scatters the cluster's light, while the surrounding cloud is faintly lit by Galactic starlight. The full density field dims and reddens stars behind it. One prepared dataset serves every device.


## Sources

| Input | Source and meaning |
| --- | --- |
| Cluster distance and members | [Hunt & Reffert (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114), Gaia DR3 cluster catalogue. |
| Foreground placement | [Breger (1986)](https://adsabs.harvard.edu/pdf/1986ApJ...309..311B) member reddenings and [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) astrometry; the [placement constraint](source/placement-constraint.json) records sample cuts and uncertainty. |
| Broad density and depth | [Edenhofer et al. (2024), dataset v1.0.2](https://zenodo.org/records/10658339), native HEALPix density resampled at 1 pc over a 190 × 200 × 200 pc region; [Leike et al. (2020)](https://doi.org/10.1051/0004-6361/202038169) supplies an independent depth comparison. |
| Fine infrared structure | [AllWISE Atlas](https://irsa.ipac.caltech.edu/data/WISE/docs/release/AllWISE/) 12/22 µm intensity, uncertainty and coverage; [Spitzer MIPS](https://irsa.ipac.caltech.edu/data/SPITZER/docs/mips/) program 58, AORs 8798976 and 8798720, at 24/70 µm. Fine inputs share an approximately 18 arcsec beam; striped 70 µm data supply only a 180 arcsec check. |
| Wide infrared structure | [IRIS 100 µm](https://doi.org/10.1086/427938), through [IRAP/CADE](https://cade.irap.omp.eu/documents/Ancillary/4Aladin/IRIS_04/properties): a 10° field with a 4.3 arcmin beam, without companion pixel uncertainties. |
| Stellar light and grains | [White et al. (2017), Table 1](https://doi.org/10.1093/mnras/stx1050) temperatures, radii and masses; [Draine grain data](https://www.astro.princeton.edu/~draine/dust/dustmix.html) for wavelength-dependent extinction, albedo and Henyey–Greenstein asymmetry. These are diffuse-ISM model properties, not local optical grain measurements. |
| Galactic light | [Draine et al. (2021)](https://doi.org/10.3847/1538-4357/abff51), published modified-MMP radiation field at U = 1, from the [author's table](https://www.astro.princeton.edu/~draine/PAHspec/mMMP/isrf_mmpisrf_0.00.gz). Its amplitude is fixed. |
| Cavity physics | [Artymowicz & Clampin (1997)](https://doi.org/10.1086/304889), [Katushkina & Izmodenov (2019)](https://arxiv.org/abs/1904.07760): radiation-pressure avoidance in an incoming dust flow. Per-star cavity sizes are modeled. |
| Optical checks | [Gibson & Nordsieck (2003), Paper I, §3.4](https://doi.org/10.1086/374589), regional B-band brightness; [NOIRLab/NSF/AURA, Rector, Cool and WIYN](https://www.astropix.org/image/noirlab/noao-m45), registered B/V/I image, CC BY 4.0. Optical images check the result; they do not supply density or texture. |

The [manifest](source/manifest.json) binds the inputs; [parameters](source/parameters.json) define the display and reference camera, and [depth profiles](source/depth-profiles.json) preserve the registered numerical samples. The astronomy and infrared measurements constrain the model; they do not uniquely reconstruct its three-dimensional dust distribution.

## Evidence

- A 181-pose renderer path retains all 94 dust elements (88 foreground elements and six panorama faces), fixed images and lighting, with projection error below 0.071 px.
- Atlas checks preserve alpha and active RGB, and reject removal of gutters, edge dilation or exact encoding. The 1680 × 1512 atlas is 303,784 bytes; those are storage measurements, not GPU residency.
- Independent sampling of 530,964 panorama edge/corner rays finds no lost coverage, with luma RMS residual 0.136/255 and maximum 1.635/255 after texture interpolation.
- [Rendered views and device timing](https://github.com/layoutit/css.earth/pull/1599) cover the Earth, side, rear and inside views. Physical Galaxy S23 drag is about 10–14 fps below dust off; coast is approximately at parity. iPad drag is about 4 fps below dust off, with variable coast slowdown. Tile-memory and layer-area counts are separate from frame delivery.

## Known problems

- Both dust-on and dust-off S23 traces contain dropped or partial reporter records. These overlapping records are not unique missed frames. Safari exposes RAF pacing here, not displayed-frame drops; no zero-drop claim is supported.
- Native iPad screens show faint straight-edged dark boundaries in the Earth view.
- The GPU-side drag slowdown is unresolved. Command-buffer flushes take 22–50 ms during input, including a recorded 131 ms flush in a 150 ms presentation gap.
- A large near element can clip visible support at its center plane on the opposite phone orbit. Inside views, billboard ordering and representative positions are approximate.
- Earth-reference lighting stays fixed as the observer moves; side and rear views do not recalculate the physical scattering phase or outgoing extinction. A single alpha also cannot reproduce three spectral transmittances exactly.
- Infrared heating and column are degenerate near hot stars. Absolute dust mass, physical thickness, tilt and individual filament depths remain uncertain; the adopted foreground boundary is not a measured sharp cloud edge.
- The finite region is a data boundary, not the end of Galactic dust. The panorama approximates nearby ambient dust as distant sky.
- Asset setup restores the display. The source restore separately downloads preserved registered infrared columns, extinction grids and numerical inputs; re-extracting the native survey products additionally requires their acquisition tools.

## Processing

1. Normalize infrared structure to the broad extinction column. The surrounding IRIS structure is divided by an adopted equilibrium-grain heating model and normalized over roughly 1 pc. Near hot stars, infrared intensity reflects heating as well as column; the absolute conversion to dust mass remains uncertain. Missing 36 arcsec stellar cores are conditionally interpolated.
2. Distribute the fine column along native Edenhofer profiles with one global −0.766 pc registration to the 136 pc placement constraint. Apply luminosity-scaled radiation-pressure cavities. Per-sight-line normalization preserves the redistributed column; the finer density replaces the same partition of the coarse field.
3. Select existing foreground material between Earth and the adopted illuminating-star plane. Local coordinates are parsecs east, north and away from Earth, with z = normal depth − 136 pc. Earth is [0, 0, −136] pc; illuminating stars have adopted z = 0.7. Cluster reflection uses −136 < z < 0.7, without moving other material forward or renormalizing the selected column.
4. Calculate single scattering once from Earth's reference direction: inverse-square B-star light, wavelength-dependent albedo and phase function, incident and outgoing extinction, and the shielded Galactic field. Default B/V/I albedos are approximately 0.665/0.677/0.654, with g approximately 0.566/0.542/0.437. Six incoming directions approximate shielding of the isotropic Galactic field. Multiple scattering is omitted.
5. Prepare 88 fixed foreground elements through the shared cloud-points system. Each keeps the same position, image and lighting from every camera direction. The remaining density contributes only Galactic illumination, integrated into six fixed panorama faces. Full-field stellar transmission retains its spatial coordinates.
6. Pack the near images with four-pixel gutters, transparent-edge RGB dilation and exact lossless WebP. Extend panorama faces by four native texels, with normalized optical-depth feathering at overlaps and transparent outer edges. Source-over composition never adds light; camera motion only projects the prepared elements.

The panorama's 100,000 pc display radius is a background approximation, not a measured dust distance. The regional visibility radius, 307.762 pc, encloses the physical map bounds independently of the Pleiades camera frame.

## Measured and assumed

- The placement fit uses 91 published reddenings and 39 quality-selected members. Its conditional center is 136.0 pc, with a 68% interval of 135.25–136.50 pc and a 95% interval of 132.25–137.75 pc. The selected members' median formal distance error is 0.37 pc; that precision does not apply to the bright illuminators.
- Edenhofer profile widths of about 5.3–6.9 pc and Leike widths of 2.2–3.8 pc include smoothing and posterior uncertainty. Their peaks differ by roughly 5 pc. Neither resolves two closely spaced scattering layers or measures true cloud thickness.
- Bright-star normal depths of 136.7 pc, blackbody spectra, grain sizes and weights, momentum efficiency Qpr = 1, incoming flow and ±1 km/s dispersion are adopted assumptions. Separate-star cavities approximate a multi-star flow; gas drag and magnetic coupling are omitted.
- The optical g ≈ 0.542 value is the Draine model. [Gibson & Nordsieck (2003), Paper II](http://physics.wku.edu/~gibson/offprints/gibson_2003_pleiades_scat_color.pdf)'s g ≈ 0.74 result applies to ultraviolet wavelengths below 260 nm, not a measured optical value.
