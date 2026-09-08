# Romulus orbit preparation

The package retains a fixed scene from the published circular Kepler model. Its current phase is approximate. The printed elements do not reproduce the precision of the authors’ full fit, and no fitted phase correction has been invented.

## Selected source and identity

Carry et al. (2021), A&A 650 A129, [Table 3, page 5](https://www.aanda.org/articles/aa/pdf/2021/06/aa40342-21.pdf), supplies Romulus relative to (87) Sylvia in EQJ2000: a=1340.6km, e=0, i=7.4°, Ω=97.1°, ω=171°, tp=2455597.08689JD and P=3.64126days. Uncertainties in the parameter file are all **3σ**, with no covariance. The nominal circular orbit uses the published ω/tp combination; neither is separately meaningful when e=0.

The published 15-page PDF was retrieved from the [Tampere University author repository](https://trepo.tuni.fi/bitstream/handle/10024/219664/aa40342_21.pdf?isAllowed=y&sequence=1) and page5 inspected visually. The mirror includes a multipart wrapper; extracting the PDF yields 8,248,991bytes, SHA256`f886c0b238fa136d1d101316e079884dd0dfe85272eed08859f8e1c3a9231651`, MD5`5a2c92a0a091e4fda304148226eb772c`. That MD5 exactly matches the published file in the [Caltech author record](https://authors.library.caltech.edu/records/q80wm-zzs37). All Romulus Table3 values match arXiv2103.06349v1. Table1 says143observations, while Table3 and the released [CDS TableC1](https://cdsarc.cds.unistra.fr/ftp/J/A+A/650/A129/tablec1.dat) contain130; this discrepancy is retained, not merged into a fictitious dataset.

## Epoch, frame, gravity

The output is geometric ICRF, kilometres and kilometres/day, at **JD2461286.5 TT (2026-09-03)**. The printed tp lacks an explicit time scale, so TT is an adopted preparation convention. CDS observation times are explicitly UTC and are converted with the applicable TT−UTC offsets for comparisons. EQJ2000 is treated as ICRF at the limited precision supported here.

The effective combined GM is **0.961006922898885km³/s²**, derived from `4π²a³/(P·86400)²`. Individual masses are not used as precise values: the paper calls Romulus's mass effectively an upper limit. `body:0` means unmodeled satellite mass and `parent:combined` is an implementation convention; it is not a measured zero or measured mass allocation. Published masses remain in the parameter receipt.

## Independent checks and limits

- The element-derived orbital pole is RA7.1°, Dec82.6°, consistent with the independently tabulated pole RA7±6°, Dec83±2° (3σ).
- Six [Miriade](https://ssp.imcce.fr/webservices/miriade/api/ephemsys/) projections cover three2018 epochs and the scene date plus twofollowing days. The returned service solution is dated2024-01-16. Differences from the published model are **23.46–62.89mas**, with **42.25mas / 140.5km on the sky plane** at the scene epoch. These are measured differences, not an uncertainty guarantee. Source URLs, raw responses, selected numbers and transformations are pinned.
- The Miriade request and response metadata sayTT, but the table JD is numerically UTC; both are recorded. No time offset is applied to improve agreement. Empty uncertainty fields at the scene date mean unavailable: the declared covariance interval ends2026-Jan-01, although orbit-computation availability extends to2030.
- Six independently projected 2002–2018 observations from CDS TableC1 differ from its reported computed positions by **7.14–61.01mas**. A geocentric, light-time-corrected projection does not exactly recover the author fit from printed elements. Telescope parallax and differential aberration are omitted. The paper's9.85mas RMS and Miriade's9.42mas FOM do not qualify this model.
- The published period error alone yields a7.72° phase sensitivity by the scene date; tp uncertainty alone yields9.97°. These are separate one-parameter sensitivities with unknown correlations, not a joint3σ region.
- No future runtime propagation is allowed. The fixed snapshot supports an approximate source-informed orbital context, not exact current phase, observational pointing, or occultation prediction.

`source/validation/epoch-state.json` is ready for the generic published-model reader. `source/validation/projection-checks.json` preserves the independent evidence. Parent heliocentric geometry comes from pinned JPL#130 Sylvia against the Sun, queried at the UTC instant corresponding to the scene TT epoch.

The reproducible extraction/check writer is `docs/moons/b1-preparation/write-romulus-orbit.py`; it expects the small retained receipts and the privately cached published PDF in `/tmp/moons-b1-romulus-orbit`. Full scientific articles are not redistributed in the package.
