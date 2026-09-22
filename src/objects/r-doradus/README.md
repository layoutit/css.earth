# R Doradus

An asymptotic giant branch star in Dorado, 55 parsecs away, carrying one photograph of its photosphere.

## Sources

**Placement.** ICRS J2000 position, parallax and proper motion from the revised Hipparcos reduction (van Leeuwen 2007,
[A&A 474, 653](https://doi.org/10.1051/0004-6361:20078357)) through
[SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dor): 18.31 ± 0.99 mas, so 54.615 pc. Vlemmings et al. (2024)
adopt the same measurement as 55 ± 3 pc and state there is no useable Gaia parallax for this star. Radial velocity
26.1 ± 2.0 km/s from the General Catalogue of Stellar Radial Velocities (Wilson 1953) through SIMBAD. The ALMA image
confirms the proper motion independently: the star sits 1.63″ west and 1.78″ south of the J2000 position, which is 23.5 years
of it.

**Radius.** The 59.8 ± 0.4 mas disc Vlemmings et al. (2024,
[Nature 633, 323](https://doi.org/10.1038/s41586-024-07836-9)) fit to these visibilities, at 54.615 pc: 244,291,444 km, or 351
solar radii, against the 353 ± 19 they give at their rounded 55 pc. This is the 338 GHz size, 1.18 ± 0.11 times the infrared
photosphere of 51.18 ± 2.24 mas (Ohnaka et al. 2019, [ApJ 883, 89](https://doi.org/10.3847/1538-4357/ab3d2a)), because band 7
sees a layer above it. Mass 0.7–1.0 M☉ from the same paper's log g = −0.6 ± 0.1; the midpoint is adopted for the scene's
gravitational parameter.

**Rotation.** None is shown. ALMA molecular lines give a surface rotation velocity of about 1.0 ± 0.1 km/s (Vlemmings et al.
2018, [A&A 613, L4](https://doi.org/10.1051/0004-6361/201832723)), seen again over six years, though Mohnen et al. (2024,
[ApJ 962, L36](https://doi.org/10.3847/2041-8213/ad2853)) suggest it could be a chance alignment of convective cells. No pole
direction or period is published, and the star's 362 and 175 day cycles are pulsation, not spin. The display axis is celestial
north at the star, a convention recorded in [rotation.json](source/preparation/rotation.json).

**ALMA lens.** ALMA project 2022.1.01071.S (PI T. Khouri), band 7 continuum of member OUS `uid://A001/X35f5/Xaea`, observed
18 July 2023 and public since 23 August 2024. The pipeline's own continuum image is pinned in
[manifest.json](source/manifest.json) and restored from the archive by
[acquisition.json](source/preparation/acquisition.json); the 77 GB product tarball is never needed, because the archive's
nested datalink service serves that one file. [author.mts](../../../tools/objects/source-authoring/r-doradus/author.mts) cuts
the 25 × 25 pixel window around the star and resamples it eight times finer to 0.625 mas, which adds no detail — the restoring
beam is 20.7 × 16.8 mas, four native pixels wide. The lens palette is the heat scale used for Betelgeuse and π¹ Gruis; the
legend reads relative brightness at 338 GHz, not colour or temperature.

**Colour lens.** The colour of R Doradus's VLT/UVES spectrum. It was taken on 27 December 2002 through a narrow slit with the atmospheric dispersion corrector off, so the colour is uncertain; R Doradus also varies. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ff6725**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). No model limb darkening is added: the giant's gravity is below the Claret & Bloemen (2011) grid, and the ALMA lens shows its measured disc. The catalogue swatch and the minimap use the same colour; the navigation marker stays the image. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. No second, independent spectrum was found: the ESO UVES files are this same night, and the star is too bright for Gaia XP and absent from the spectral libraries.

## Evidence

**The disc agrees with the published fit.** Measured here on the archive image: half-power diameter 60 mas, against the
59.8 ± 0.4 mas Vlemmings et al. (2024) fit to the same visibilities. Peak 5.71 × 10⁻² Jy/beam at a signal-to-noise ratio of
199. The face covers 10.4 beam areas.

**The mottling is above the pipeline's own artefact floor.** A limb-darkened disc convolved with the image's restoring beam
is fitted to the image and to the session's check quasar, J0524-5658, which is a point source through the same beam and
therefore shows what the pipeline draws on a featureless object. R Doradus leaves a residual 7.0 times its image noise; the
quasar leaves 3.0 times its own. The ratio is 2.32, against the threshold of 2 that
[interferometric imaging](../../../docs/interferometric-imaging.md) sets for a reconstruction. The centre must be fitted
sub-pixel: rounding it to the 5 mas archive grid inflates the residual from 3.1% to 8.6% of the peak.

**Independent of ours,** the authors conclude the structures are intrinsic to the star from their correspondence across
epochs, including band 6 observations at 225 GHz fifteen days later, and measure a typical lifetime of at least three weeks.
- Run of 2026-09-21 (this version): [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ff6725 is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour from the pinned spectrum.

## Known problems

**Single cells are not resolved.** The authors measure a dominant structure size of 13.1 ± 0.6 mas, which is smaller than the
20.7 × 16.8 mas restoring beam. The lens therefore shows convection smoothed to the resolution, not individual granules.

**The spotless-disc test was not run.** The test this repository uses on a reconstruction re-images a spotless star through
the observation's own sampling, which needs the visibilities; ALMA serves them only inside a 77 GB tarball, and CASA is
deferred in the [ALMA facility ledger](../../facilities/alma/investigations.json). The quasar control above stands in for it
and is weaker: the quasar image has a signal-to-noise ratio of 23 against this image's 199, and its beam is 20.8 × 14.4 mas at
a different position angle.

**"Larger than every star except the Sun" is the authors' conclusion, not a catalogue fact.** Bedding et al. (1997) state it
for their 57 ± 5 mas measurement, and the reader card attributes it to them. Ranking the JMMC JMDC by uniform-disc diameter on
17 September 2026 puts VY CMa (420 mas at 8.3 µm), θ Apodis (85 mas at 10 µm), W Hydrae (79.5 mas at 710 nm), R Leonis
(67.9 mas) and α Herculis A (62 mas) above it. Those are measured where molecular and dust layers make a star look larger, so
they are not the same quantity, but the superlative is not ours to assert.

**One hemisphere, one epoch, one band.** The far hemisphere and the poles were not observed and carry the no-data grid. The
pattern changes over weeks, so the lens is one night of a changing surface.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
