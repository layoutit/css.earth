# WASP-121b

## Sources

WASP-121b (IAU name Tylos) is an ultra-hot gas giant 1.7 times Jupiter's size that circles the F star [WASP-121](../wasp-121/README.md) every 30.6 hours. JWST's NIRSpec G395H watched it for 37.8 hours in October 2022 (GO program 1729): two eclipses and a transit, a whole orbit of its heat from 2.7 to 5.2 µm. Evans-Soma et al. (2025, Nature Astronomy 9, 845, [doi:10.1038/s41550-025-02513-x](https://doi.org/10.1038/s41550-025-02513-x); [arXiv:2506.01771](https://arxiv.org/abs/2506.01771)) fit the white light curve of each detector with a starry map of the planet. Their deposit, [Zenodo 10.5281/zenodo.20651891](https://zenodo.org/records/20651891) (CC BY 4.0), holds the light curves, the models and the spectra this package uses.

**The lens.** One Temperature dataset in two steps, one per detector: NRS1 (2.7–3.7 µm) and NRS2 (3.8–5.2 µm), stepped with ‹ and › in the dataset panel. Both share one scale: inferno from 0 K to the hottest point of either map, 3,136 K (NRS2).

**The map.** The paper's map is a starry dipole: a uniform term plus Y(1,0), turned east by a phase offset. The Bayesian information criterion preferred it to maps adding Y(1,1) and Y(2,0) (Methods, "White phase-curve fitting"). The [records](source/science/evans-soma-2025) carry the best-fit values of Supplementary Table 1, each with its cell: amplitude 2,031 and 2,784 ppm, Y(1,0) 0.805 and 0.669, offset 2.96° and 2.39° east (NRS1, NRS2). [starry 1.2.0](../../../packages/telescope/src/node/starry.ts), the paper's own tool, evaluates the intensity on a 1° grid, and [published-phase-curve-map.mts](../../../tools/objects/terrestrial-layers/published-phase-curve-map.mts) reads it.

**Temperature.** A white light curve mixes every wavelength on the detector, so no single Planck curve converts it. The deposit supplies what the authors' own conversion used. At each of the 349 spectroscopic channels, their planet-to-star ratio and brightness temperature give the term (Fp/Fs)/B(T_b) = rp²/I_star. It is the same at all 36 phase bins to within their whole-kelvin rounding. The star's mean detected counts per channel, from the deposited 1D spectra, weight the channels as the white light curve sums them (146 channels on NRS1, 203 on NRS2). A map cell of intensity I shines like a uniform planet of flux πI, so its brightness temperature T solves πI = Σ counts × term × B(T) / Σ counts.

**What it shows.** The hottest point is 3,096 K (NRS1) and 3,136 K (NRS2), 3° and 2° east of the point under the star. The east terminator is about 100 to 120 K warmer than the west. A dipole cannot bend: on the far night side it falls through zero, and there it gives no temperature. Those cells are grey: 14 % of the planet in NRS1, 7 % in NRS2. The paper's own phase-binned brightness temperatures show a night side near 1,100 K (Mikal-Evans et al. 2023: 926 and 1,122 K), so the grey is a limit of the simple map, not of the planet.

**Orbit and rotation.** The orbit is the one the maps were fitted with (Supplementary Table 1): period 1.27492503 days, inclination 87.96°, transit at 2459867.64265 BJD_TDB, circular. a/R* 3.796 follows from the fit's stellar mass and radius and planet mass. The rotation record assumes the planet is tidally locked. The planet is drawn emissive, a sphere of radius ratio 0.122657 (NRS1).

**Catalogue colour.** #fbc95a, the temperature palette at the 2,762 K NRS1 day side of Mikal-Evans et al. (2023).

## Evidence

Run of 2026-09-23 (this version):

- [`published-phase-curve-map.test.mts`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.test.mts) runs starry on the table values in the fitted system and compares the result with the authors' deposited starry models of both white light curves (`whitelc_model_nrs*.txt`, 3,500 samples each). They agree to 1.13 ppm rms (NRS1) and 1.40 ppm (NRS2); with the map turned west instead of east, 129 and 119 ppm. So the values are read correctly and the offset is eastward.
- The same test draws the map as this package does (longitude east of the substellar point) and integrates it through the package's own orbit and synchronous rotation ([phase-curve.mts](../../../tools/objects/eclipse-map/phase-curve.mts)), away from transit. It matches the deposited planet signal, which peaks at 3,861 ppm (NRS1) and 4,863 ppm (NRS2), to 0.75 and 1.52 ppm rms; mirrored east-west, 135 and 124 ppm.
- A second test checks the conversion: every channel's term agrees across the 36 phase bins to 0.66 % or better, and each map peaks on the equator at the grid longitude nearest its fitted offset. It also checks the hottest temperatures and the grey fractions above.
- [`wasp-121-default-views.png`](evidence/wasp-121-default-views.png): WASP-121, WASP-121b in NRS1 (its default) and WASP-121b in NRS2 on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready. The planet opens on its substellar point; the panel's small map shows the grey night-side cap.
- [`lens-steps.test.mts`](../../../tools/objects/content/lens-steps.test.mts) checks that stepped datasets form groups of consecutive steps with distinct labels.

## Known problems

- **The map is a dipole.** Only the brightness at noon, its east-west shift and a smooth fall to the night side are measured. The night side's shape, and the grey cap where the dipole goes below zero, come from that simplicity.
- **The temperature is a band average.** Each cell's temperature is the one blackbody that gives its band-summed brightness, weighted by the star's counts. Real spectra differ between channels (the paper finds H2O, CO and SiO emission on the day side).
- **North and south are not measured.** A Y(1,0) dipole is symmetric about the equator by construction.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The orbit's position angle on the sky is set at 0 as a display convention. The planet is a sphere; it is expected to be stretched toward its star.
- **Not shown.** The 349-channel phase-resolved spectra, the retrieved dayside and nightside profiles, and the wind layers ESPRESSO measured (Seidel et al. 2025) ([ledger](investigations.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
