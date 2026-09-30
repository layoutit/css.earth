# ε Eridani

## Sources

ε Eridani is a star of 5,039 K 3.2 parsecs away. Its planet is b, placed on the orbit its paper measured. It is also HD 22049, HR 1084, HIP 16537. The introduction is generated from Baines & Armstrong (2012), ApJ 744, 138's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5164707970261890560, parallax 310.577 ± 0.135 mas (3.22 pc); its RUWE is 2.7, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.74 +/- 0.01 solar radii from Baines & Armstrong (2012), ApJ 744, 138, section 3: the Navy Optical Interferometer limb-darkened angular diameter 2.153 ± 0.028 mas at the parallax of Benedict et al. (2006) (https://arxiv.org/abs/1112.0447). Mass 0.82 +/- 0.02 solar masses from Thompson et al. (2025), AJ 170, 301, the stellar mass their orbit fit of ε Eridani b adopts, via the NASA Exoplanet Archive default parameter set (https://ui.adsabs.harvard.edu/abs/2025AJ....170..301T/abstract). Temperature 5,039 K from Baines & Armstrong (2012), ApJ 744, 138, section 3: from the interferometric angular diameter and the bolometric flux. log g 4.61 from the mass and radius.

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 22049: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 191: HR 1084; VizieR III/202 (0 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 1084 is not in the catalogue; kiehling: HR 1084 is not among its 60 stars; burnashev: found, not needed after the colour and its cross-check; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,039 K and log g 4.61 (u1 0.646, u2 0.128): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-26 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The colour's cross-check differs by 0 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.
- `eps-eridani-default-views.png`: ε Eridani, ε Eridani b and the system view on this branch's dev server, headless Chromium at 1440 × 900 after each page reported ready; no browser errors.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star's magnetic maps (Jeffers et al. 2014, 2017, 2022) are published only as figures, so none is drawn.
- **Not shown.** The planet has not been imaged: JWST/NIRCam coronagraphy found no point source (Llop-Sayson et al. 2025, arXiv:2508.08463). Earlier orbit fits put its tilt between 30 and 89 degrees; Thompson et al. (2025) measure 40 +6/-5 degrees.
- **Not shown.** The spin axis is a display convention: no source used here measures its orientation.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Epsilon Eridani" (revision 1376485045) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
