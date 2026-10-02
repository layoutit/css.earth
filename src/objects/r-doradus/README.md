# R Doradus

An asymptotic giant branch star in Dorado, 55 parsecs away, carrying one
photograph of its photosphere from ALMA and a color dataset from its spectrum.

## Sources

- **Placement:** ICRS J2000 position, parallax and proper motion from the revised Hipparcos reduction (van Leeuwen 2007, [A&A 474, 653](https://doi.org/10.1051/0004-6361:20078357)) through [SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dor): 18.31 ± 0.99 mas, so 54.615 pc. There is no useable Gaia parallax for this star. Radial velocity 26.1 ± 2.0 km/s from the General Catalogue of Stellar Radial Velocities (Wilson 1953) through SIMBAD.
- **Radius:** the 59.8 ± 0.4 mas disc Vlemmings et al. (2024, [Nature 633, 323](https://doi.org/10.1038/s41586-024-07836-9)) fit to these visibilities: 244,291,444 km, or 351 solar radii, at 54.615 pc. Mass 0.7–1.0 M☉ from the same paper's log g; the midpoint is adopted.
- **ALMA dataset:** ALMA project 2022.1.01071.S (PI T. Khouri), band 7 continuum of member OUS `uid://A001/X35f5/Xaea`, observed 18 July 2023. The pipeline's own continuum image is pinned in [manifest.json](source/manifest.json) and restored by [acquisition.json](source/preparation/acquisition.json).
- **Color dataset:** R Doradus's VLT/UVES spectrum of 27 December 2002; the file and the full citation are in [stellar-color.json](source/photometry/stellar-color.json).
- **Limb:** the power law I(mu) = mu^0.61 that Ohnaka et al. (2019, [ApJ 883, 89](https://doi.org/10.3847/1538-4357/ab3d2a)) fit to the star's resolved disc in the VLT/AMBER K-band continuum.
- **Rotation:** ALMA molecular lines give a surface rotation velocity of about 1.0 ± 0.1 km/s (Vlemmings et al. 2018, [A&A 613, L4](https://doi.org/10.1051/0004-6361/201832723)), though Mohnen et al. (2024, [ApJ 962, L36](https://doi.org/10.3847/2041-8213/ad2853)) suggest it could be a chance alignment of convective cells.

## Processing

[author.mts](../../../packages/bake/authoring/r-doradus/author.mts) cuts the
25 × 25 pixel window around the star and resamples it eight times finer to
0.625 mas, which adds no detail: the restoring beam is 20.7 × 16.8 mas. The
palette is the heat scale used for Betelgeuse and π¹ Gruis; the legend reads
relative brightness at 338 GHz, not color or temperature.

No rotation is shown: no pole direction or period is published. The display
axis is celestial north at the star, a convention recorded in
[rotation.json](source/preparation/rotation.json).

The spectrum's samples from 380 to 780 nm are weighted by the CIE 1931 2°
observer and converted to sRGB with the D65 white
([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)):
**#ff6725**. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts)
writes it, and `--check` recomputes it.

## Evidence

- **The disc agrees with the published fit:** half-power diameter 60 mas on the archive image, against the 59.8 ± 0.4 mas fit. Peak signal-to-noise ratio 199; the face covers 10.4 beam areas.
- **The mottling is above the pipeline's own artefact floor.** A beam-convolved limb-darkened disc fitted to R Doradus leaves a residual 7.0 times its image noise; fitted to the session's check quasar, J0524-5658, it leaves 3.0 times. The ratio is 2.32, against the threshold of 2 that [interferometric imaging](../../../docs/interferometric-imaging.md) sets for a reconstruction.
- The ALMA image confirms the proper motion independently: the star sits 1.63″ west and 1.78″ south of the J2000 position, which is 23.5 years of it.
- Independently, the authors conclude the structures are intrinsic to the star from their correspondence across epochs, and measure a typical lifetime of at least three weeks.

## Known problems

- **Single cells are not resolved.** The authors measure a dominant structure size of 13.1 ± 0.6 mas, smaller than the restoring beam, so the dataset shows convection smoothed to the resolution.
- **The spotless-disc test was not run.** It needs the visibilities, which ALMA serves only inside a 77 GB tarball, and CASA is deferred in the [ALMA facility ledger](../../facilities/alma/investigations.json). The quasar control stands in for it and is weaker.
- **The radius is the 338 GHz size,** 1.18 ± 0.11 times the infrared photosphere of 51.18 ± 2.24 mas, because band 7 sees a layer above it.
- **"Larger than every star except the Sun" is the authors' conclusion, not a catalogue fact.** Bedding et al. (1997) state it, and the reader card attributes it to them. Several stars have larger measured diameters at wavelengths where molecular and dust layers make a star look larger.
- **The color is uncertain.** The spectrum was taken through a narrow slit with the atmospheric dispersion corrector off, and R Doradus varies. No second, independent spectrum was found.
- **One hemisphere, one epoch, one band.** The far hemisphere and the poles carry the no-data grid, and the pattern changes over weeks.
- **Measured limb, other band.** The limb law was measured in the K band; the visible limb is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
