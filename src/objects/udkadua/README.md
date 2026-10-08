# Udkadua

## Sources

Its brightness, measured band by band, gives 24 times the Sun's luminosity at 4,667 K, so 7.552 solar radii. It is also HD 222107, HR 8961, HIP 116584. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1939115478598580352, distance 26 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: distance 26.406 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.006), at which the luminosity and radius hold; Gaia DR3's parallax, 38.574 ± 0.118 mas (327.1 standard errors), is not used. Radius 7.552 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: radius 7.552 solar radii, implied by the fitted luminosity 24.306 solar luminosities (fractional uncertainty 0.054) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,667 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: effective temperature 4667 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.037). log g 2.76 from 2025A&A...703A.128B ("Chromospherically active stars: Lithium and CNO abundances in northern RS CVn stars.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1125: HR 8961; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 520 (BS 8961) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: HD 222107 is not in the library; pulkovo: HR 8961 is not in the catalogue; kiehling: HR 8961 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the power law I(mu) = mu^0.231 that Martinez et al. (2021), ApJ 916, 60 fit to the star's resolved disc (CHARA/MIRC H band, 1.5-1.7 um; not a visible band).

**Surface from interferometry.** The datasets Color + brightness and Surface map are one fit of the star's surface to the 2,984 squared visibilities and 3,704 closure phases mirc measured on 6 nights, 2 to 24 September 2011 (CHARA/MIRC H band (1.49-1.73 um), eight channels). The calibrated files are the authors', shipped with their code (https://github.com/fabienbaron/ROTIR.jl/tree/ad308759b741b861b6c19fedd001c323a3a64479/demos/data); the fit is ROTIR at the pinned commit (HEALPix level 3, sobel2 at weight 10, 1000 iterations, the settings of the authors' own script for these files), on a sphere of 2.742 mas with a power-law limb of 0.231, tilted 85.63° with its pole 26.09° east of north and turning in 54.2 d (Martinez et al. (2021), ApJ 916, 60, Table 4 (https). The fit leaves a reduced chi-squared of 1.72 on the squared visibilities and 2.30 on the closure phases, where a spotless star leaves 3.13 and 28.29 (limit 3); its spots are 2.14 times those the same fit draws on a spotless star of 2.77 mas (limit 2); and two independent halves of the data give the same spots (correlation 0.83, limit 0.5). Spotless twins 2% smaller and 2% larger do not fit on the sphere at all (closure phases 7.42 and 9.40), so they do not decide the spots: a reading of this repository, stated in surface-star.mts. The page's axis is that measured one, and longitude 0 is the meridian that faced the Earth on 14 September 2011. Run again with `node packages/telescope-cli/src/archives/interferometry/surface-star.mts packages/telescope-cli/src/archives/interferometry/seasons/udkadua-mirc-2011-09 output/interferometry/udkadua-mirc-2011-09`. Martinez et al. (2021), ApJ 916, 60; Parks et al. (2021), ApJ 913, 54 imaged the same nights; their maps are not redistributed here.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Surface map.** It is infrared brightness, drawn over the star's visible color as a darker tone: how dark the spots are in visible light is not measured. Nothing smaller than about 21° of the surface is resolved, and 34° of longitude never faced the Earth on these nights. The map is of 2 to 24 September 2011; spots change within months.
- **Assumptions of the frame.** The rotation phase is a convention: the star is drawn as it faced the Earth on one night and does not turn.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Andromedae" (revision 1374783321) verbatim, CC BY-SA 4.0.
- **Measured limb, other band.** The law was measured or fixed outside the visible band the color is drawn in; the visible limb is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
