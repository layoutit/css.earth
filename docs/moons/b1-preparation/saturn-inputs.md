# B1 Saturn implementation inputs

All **18 Saturn candidates** have concrete numerical source definitions for the explicitly assumed-depth approximation accepted by Kiviuq/Albiorix at `7b289887ee03e040b981f6aaff25390d1e17ca9c`. **No true source blocker** remains for that limited representation. No package, runtime orbit or browser result is qualified by this document. The full cohort is retained.

## Chosen representation

Each body adopts its author-page nominal reference radius **R**, the published minimum equatorial ratio **q**, and the explicit display choice **b = c = R / ∛q; a = q b**. Every listed axis is a **derived display semi-axis**, never a measured dimension. Treating R as an equal-volume scale is a convention. The full surface remains the standard missing-data grid. The model does not reconstruct terrain, albedo patterns, contact binaries or the measured lightcurve.

All 18 author Table 1C notes were individually checked: sizes use assumed geometric albedo **0.06**, with approximate sensitivity **−15/+30%** for albedo ±0.02 and H ±0.1 mag. The rounded published diameter ranges below are not measured 1σ errors. The nominal radii retain additional source rounding and should not be silently recomputed from the rounded diameter or the older overview table.

| Body / ID | JPL / solution | Published diameter, km | Adopted R, km | Minimum a/b | Period, hours |
|---|---|---:|---:|---:|---|
| Paaliaq / `paaliaq` | 620 / SAT456 | 25 (+7/−4) | 12.7 | 1.05 | 18.79 ± 0.09 h |
| Tarvos / `tarvos` | 621 / SAT456 | 15 (+4/−3) | 7.3 | 1.08 | 10.691 ± 0.001 h |
| Ijiraq / `ijiraq` | 622 / SAT456 | 13 (+4/−2) | 6.4 | 1.08 | 13.03 ± 0.14 h |
| Suttungr / `suttungr` | 623 / SAT456 | 7 (+2/−1.25) | 3.5 | 1.18 | 7.67 ± 0.02 h |
| Mundilfari / `mundilfari` | 625 / SAT456 | 7 (+2/−1.25) | 3.5 | 1.43 | 6.74 ± 0.08 h |
| Skathi / `skathi` | 627 / SAT456 | 8 (+2.25/−1.25) | 3.8 | 1.27 | 11.1 ± 0.02 h |
| Erriapus / `erriapus` | 628 / SAT456 | 10 (+3/−2) | 5.1 | 1.51 | 28.15 ± 0.25 h |
| Thrymr / `thrymr` | 630 / SAT456 | 8 (+2.25/−1.25) | 3.8 | 1.21 | 38.79 ± 0.25 h · tentative |
| Bebhionn / `bebhionn` | 637 / SAT456 | 6 (+1.5/−1) | 2.8 | 1.41 | 16.33 ± 0.03 h |
| Bergelmir / `bergelmir` | 638 / SAT456 | 5 (+1.5/−1) | 2.5 | 1.13 | 8.13 ± 0.09 h |
| Bestla / `bestla` | 639 / SAT456 | 7 (+2/−1.25) | 3.3 | 1.47 | 14.6238 ± 0.0001 h |
| Fornjot / `fornjot` | 642 / SAT456 | 6 (+1.5/−1) | 2.9 | 1.11 | 7 or 9.5 h · tentative |
| Hati / `hati` | 643 / SAT456 | 5 (+1.5/−0.75) | 2.4 | 1.42 | 5.45 ± 0.04 h |
| Hyrrokkin / `hyrrokkin` | 644 / SAT456 | 8 (+2.25/−1.25) | 3.8 | 1.27 | 12.76 ± 0.03 h |
| Loge / `loge` | 646 / SAT456 | 5 (+1.5/−0.75) | 2.4 | 1.04 | 6.9 ± 0.1 h · tentative |
| Skoll / `skoll` | 647 / SAT456 | 5 (+1.25/−0.75) | 2.3 | 1.14 | 7.26 ± 0.09 h · tentative |
| Greip / `greip` | 651 / SAT456 | 5 (+1.25/−0.75) | 2.3 | 1.18 | 12.75 ± 0.35 h · tentative |
| Tarqeq / `tarqeq` | 652 / SAT456 | 6 (+1.75/−1) | 3 | 1.32 | 76.13 ± 0.04 h |

All parents are Saturn / NAIF 699. Exact provisional designations, IAU numerals and JPL mean-element records are stored per body in the JSON. Skathi is the legacy JPL **Skadi**, code 627.

## Display geometry and attitude

| Body | Derived display semi-axes a × b × c, km | Specific scientific limit |
|---|---|---|
| Paaliaq | 13.119882 × 12.495125 × 12.495125 | Four maxima/minima make a simple ellipsoid a poor explanation of the measured lightcurve; contact-binary interpretation is unestablished. |
| Tarvos | 7.684319 × 7.115110 × 7.115110 | Low elongation floor; multiple extrema mean it is not an actual recovered surface. |
| Ijiraq | 6.736937 × 6.237905 × 6.237905 | Shallow lightcurve supports a modest equatorial constraint; polar dimension remains unknown. |
| Suttungr | 3.908313 × 3.312130 × 3.312130 | Two/three extrema; ellipsoid demonstrates only the minimum elongation. |
| Mundilfari | 4.442479 × 3.106629 × 3.106629 | Single roughly nine-hour Cassini sequence at 36-degree phase; model confidence must remain bounded. |
| Skathi | 4.456420 × 3.508992 × 3.508992 | Use exact Skathi = legacy JPL Skadi identity, code 627; no body-fixed pole follows from this ratio. |
| Erriapus | 6.712559 × 4.445404 × 4.445404 | Strong useful elongation floor; a contact neck or binary would be speculative. |
| Thrymr | 4.314931 × 3.566059 × 3.566059 | Published period is tentative; do not show it as a secure current rotation prediction. |
| Bebhionn | 3.520768 × 2.496999 × 2.496999 | Useful minimum elongation from the lightcurve; absolute scale remains albedo-dependent. |
| Bergelmir | 2.712225 × 2.400199 × 2.400199 | Modest elongation floor; lightcurve does not establish a polar axis. |
| Bestla | 4.266373 × 2.902295 × 2.902295 | Published south-ecliptic pole latitude approximately -85 ± 15 degrees and sidereal period are useful; do not invent a pole longitude or native convex mesh. |
| Fornjot | 3.108947 × 2.800853 × 2.800853 | Very weak period determination; author table allows 7 or 9.5 hours. Do not animate a unique measured period. |
| Hati | 3.032053 × 2.135249 × 2.135249 | 5.45 ± 0.04 hours used from Table 3 and body page; overview wording 5.42 is inconsistent. Useful elongation floor. |
| Hyrrokkin | 4.456420 × 3.508992 × 3.508992 | Three maxima prevent treating an ellipsoid as a recovered physical outline. |
| Loge | 2.463581 × 2.368828 × 2.368828 | Shallow low-SNR photometry and tentative period; low visual return from q=1.04. |
| Skoll | 2.509946 × 2.201707 × 2.201707 | 7.26-hour solution is tentative and some data do not fit; no established wobble or binary interpretation. |
| Greip | 2.568320 × 2.176543 × 2.176543 | Period tentative; an approximately 19-hour alternative remains possible. |
| Tarqeq | 3.609972 × 2.734828 × 2.734828 | Long 76.13-hour period and q=1.32 give a distinct bounded model opportunity. |

For 17 bodies the chosen display pole is ICRF north (RA 0°, Dec +90°), with a fixed arbitrary meridian. All 18 packages retain a fixed display attitude: reported periods are informational facts, and generic camera motion does not reproduce physical spin. Thrymr, Fornjot, Loge, Skoll and Greip retain tentative labels. Fornjot keeps both **7 or 9.5 hours**, with neither selected for spin propagation. Greip retains the approximately 19-hour alternative.

**Bestla** has a stronger partial constraint: the primary paper gives ecliptic pole latitude −85° ±15° and retrograde spin, although its author page leaves pole cells blank. Choose ecliptic south as an explicit representative display pole within that interval: ICRF RA 90°, Dec −66.560708889° using J2000 obliquity 23.439291111°. Ecliptic longitude is undefined at that selected pole; it is not a measured zero. Exact pole and phase remain unestablished.

**Paaliaq** is deliberately a minimum-elongation illustration, not a recovered four-maxima shape. Suttungr, Tarvos, Hyrrokkin and Skoll likewise have extrema patterns an ellipsoid does not reproduce. Hati uses the primary Table 3/body-page **5.45 ±0.04 h**, preserving the noted 5.42-hour overview discrepancy.

## Reusable inputs and accepted contract

- Each JSON body includes an implementation-ready `measurementDefinition` with the accepted approximate-ellipsoid schema, exact target identity, source labels, q/R, derived semi-axes, assumptions and sampling formula.
- Paper/page receipts are already available under `/tmp/moon-saturn-review`; JSON source pins record every URL, SHA-256 and byte count. The original 2018 PDF and all 18 individual HTML pages can be read without another download. They are research evidence; do not relabel the full copyrighted papers as MIT package assets.
- Both Kiviuq and Albiorix SOURCE, measurements, content, rotation, recipe and manifest blobs were reread at the merged commit; exact Git blob/SHA-256 pins are included. These are contract references. Body-specific fit coefficients, hashes, context images and validation reports cannot be copied.
- Reuse the verified neutral missing-data image and common ESO/font assets through the existing acquisition contract. Their existing pins and terms are recorded; actual checkout/cache availability remains for the owner to verify.
- Start from the accepted 512×256 model raster, 16 bands, 128-pixel poles, 5° radius table (2,522 vertices / 5,040 source faces), and 480-face simplification. The initial 25×R metres simplification tolerance is a rendering parameter, not measurement uncertainty. Derive framing from each resulting model, and prepare thumbnails, context and minimaps from that same shape.

## Orbit and qualification gates

All 18 targets resolve to **SAT456**, but this document contains no fitted positions. The JSON provides a proposed daily-vector request over 2020–2032 in Saturn-centered ICRF, with exact target IDs. Confirm the existing fitter/API parameters, fetch vectors, choose fit complexity per target, and record actual sample endpoints. Independent fractional-date/vector holdouts must prove each body’s selected preview interval. Do not inherit Kiviuq/Albiorix fit errors, harmonics or validity from their example packages.

Before calling a body ready, complete normal source restoration, preparation closure, object/runtime/navigation checks and required real Chrome DPR 1/2 qualification. Pending fitting and qualification are implementation gates; they are not evidence that the physical source definitions are blocked.

[Canonical 18-body definitions and source pins](saturn-inputs.json). Primary constraints: [Denk et al. 2018](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf), [author portal](https://tilmanndenk.de/outersaturnianmoons/), [JPL elements](https://ssd.jpl.nasa.gov/sats/elem/).
