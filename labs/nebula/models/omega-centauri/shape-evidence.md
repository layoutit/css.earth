# Omega Centauri: measured three-dimensional shape

This note collects what the primary literature actually measured about the shape of
Omega Centauri (NGC 5139), separate from `king-abel-profile.json`'s spherical
approximation. It exists so a future density model can be built from physics, not from
the reference image. The image stays a scale/position check only. See
`physical-evidence.json` for the underlying, individually cited entries; this file is
the plain-language summary and says what is contested and what is missing.

## The six questions

### 1. Flattening (ellipticity) and its position angle

Measured, but two different things have two different confidence levels.

- **Ellipticity is measured and varies with radius.** White & Shawl (1987) found the
  cluster's flattening (1 - b/a) grows from about 0.08 near the core to about 0.17-0.19
  in the outskirts. This is already in the ledger (`ellipticity`).
- **Position angle is a gap.** Search summaries in this session named three different
  numbers (about 100, 103, 108 degrees) attached inconsistently to different studies,
  and separately noted that White & Shawl (1987) and Chen & Chen (2010) disagree on
  position angle. None of these numbers came from a primary paper this session actually
  fetched and read. Rather than pick one, this is recorded as **not sourced**
  (`position-angle-not-sourced`). Fetching White & Shawl (1987) and one modern
  isophotal or isodispersion fit directly is the next step.

### 2. Inclination of the symmetry axis

Measured twice, by two independent methods, with a disagreement.

- van de Ven, van den Bosch, Verolme & de Zeeuw (2006), *A&A* 445, 513
  (doi:10.1051/0004-6361:20053061) built an axisymmetric Schwarzschild
  orbit-superposition model from line-of-sight velocities plus internal proper
  motions. Result: **i = 50 +/- 4 degrees**, mean intrinsic axial ratio 0.78 +/- 0.03.
- Haberle, Neumayer, Bellini, Libralato et al. (2024), *ApJ* 970, 192
  (oMEGACat II, arXiv:2404.03722), using much deeper combined HST+MUSE proper motions
  in the inner few arcminutes, found **i = 43.9 +/- 1.3 degrees**.

These disagree by roughly 1.5-2 sigma. Both are dynamical-model results (they assume
axisymmetry and fit inclination to reproduce the kinematics), not a direct geometric
reading, and both cannot be exactly right at once. Treat the inclination as bracketed
to roughly 40-55 degrees, not pinned to one number.

### 3. Surface-brightness profile and profile family

Measured, and it changes the recommendation already baked into `king-abel-profile.json`.

- Trager, King & Djorgovski (1995), *AJ* 109, 218 compiled surface-brightness profiles
  and King-model concentrations for 125 clusters, including NGC 5139. This session
  confirmed the paper and its coverage but did not retrieve the specific NGC 5139 table
  row (concentration, core radius) from the primary table.
- McLaughlin & van der Marel (2005), *ApJS* 161, 304 (arXiv:astro-ph/0605132) fit King,
  Wilson and power-law models to many clusters' photometry, including NGC 5139, and
  found **a Wilson (1975) model fits Omega Centauri better than a King (1962) model**.
- Noyola, Gebhardt & Bergmann (2008), *ApJ* 676, 1008 (arXiv:0801.2782) used HST ACS
  integrated light to show the innermost several arcseconds have a shallow rising cusp
  (logarithmic slope about -0.08), not a flat core -- part of the still-open
  intermediate-mass-black-hole question, and irrelevant at the parsec scale the
  King-Abel profile targets, but evidence the very center is not flat either.

Consequence: this ledger's existing approximation A (treating the 3D King core radius
as the projected King core radius) rests on the *wrong profile family* for this
cluster, independent of which core radius is plugged in. The right fix is a Wilson-model
fit, not a King fit -- but this session could not retrieve McLaughlin & van der Marel's
actual fitted Wilson parameters for NGC 5139, so that fix is not yet made
(`king-wilson-fit-comparison`).

### 4. Rotation

Measured, and it only partly explains the flattening.

- Reijns et al. (2006), *A&A* 445, 503 (arXiv:astro-ph/0509227): line-of-sight rotation
  amplitude **about 6 km/s, peaking in the 6-10 arcmin radial zone**, from 2756 radial
  velocities. Velocity dispersion itself drops from ~15 km/s in the inner few arcmin to
  ~6 km/s at 25 arcmin, so rotation is a large fraction of the local dispersion in the
  outskirts.
- Merritt, Meylan & Mayor (1997), *AJ* 114, 1074: an earlier, independent estimate of
  about 7.9 km/s at ~11 pc, in the same 6-8 km/s range (taken from a search summary,
  not refetched -- treat as corroborating, not precise).
- Bianchini, Varri, Bertin & Zocchi (2013) (arXiv:1302.0717) modeled the flattening
  with rotating, anisotropic axisymmetric models and found rotation alone does not
  reproduce the observed ellipticity profile at all radii; matching it needs added
  radial velocity anisotropy.
- Pechetti et al. (2024), *MNRAS* 528, 4941 (MUSE) found the innermost ~20 arcsec
  (~0.5 pc) **counter-rotates** relative to the bulk cluster rotation.

So: rotation is real and measured, and it is the dominant known driver of the
flattening, but not the whole story -- velocity anisotropy contributes too, and the
very center runs a different, opposite pattern from the bulk. An oblate model built
from bulk rotation and ellipticity alone will not capture the innermost counter-rotating
core (a negligible volume fraction) or the anisotropy-driven part of the ellipticity
profile at intermediate radii.

### 5. Distance

Confirmed. Baumgardt & Vasiliev (2021), *MNRAS* 505, 5957 (a peer-reviewed paper,
separate from the Baumgardt group's public parameter website already cited in the
ledger) give **5426 +/- 47 pc**, in agreement with this ledger's existing
5430 +/- 50 pc to well within its stated uncertainty. Nothing here changes that number;
this is corroboration from a second, independently-titled source, not a correction. (Note:
van de Ven et al. 2006's *dynamical* distance, 4.8 +/- 0.3 kpc, is noticeably lower and
does not agree with either of these within its own error bars -- a reminder that the
axisymmetric dynamical model is an approximation, not ground truth.)

### 6. Triaxiality

Not directly measured. No dedicated triaxial (three-axis) shape fit -- an isophote-twist
analysis or a full triaxial Schwarzschild model -- was located for Omega Centauri in
this session. What exists is indirect and suggestive, not conclusive:

- the counter-rotating core (item 4),
- a separate disk-like kinematic component contributing about 4% of total mass at
  1-3 arcmin, reported in the same van de Ven et al. (2006) dynamical fit,
- the roughly 1.5-2 sigma disagreement between two independent axisymmetric inclination
  fits (item 2),
- the reported position-angle disagreement between studies (item 1).

Together these say the cluster is not a perfectly simple single-axis oblate rotator.
None of them is itself a triaxial shape measurement. This is recorded as a genuine gap
(`triaxiality-not-sourced`), not filled with a plausible triaxial axis-ratio value.

## What a density model built from this can and cannot claim

**Can claim:** a spherical model is known-wrong at the 10-20% flattening level (measured);
an oblate model, oriented by a measured ellipticity profile and an inclination bracketed
to roughly 40-55 degrees, is a materially better approximation than the current spherical
King-Abel profile, and the physical driver of most of the flattening (rotation) is
independently measured, not assumed.

**Cannot yet claim:** an oblate model has one settled inclination or position angle to
adopt without picking between disagreeing papers; a Wilson-family fit specific to this
cluster's actual measured concentration and core radius (only the *conclusion* that
Wilson beats King is sourced, not the fitted numbers); that oblate is the whole story --
the counter-rotating core and the anisotropy-driven part of the ellipticity profile mean
even a well-oriented single-axis oblate King/Wilson model is a good bulk approximation,
not an exact reproduction, and triaxiality has not been ruled in or out by a direct
measurement.

## Judgement: is oblate well enough constrained to build?

Yes, as a **bulk approximation**, with an inclination range rather than a single value.
An oblate King- or (better) Wilson-family model, flattened by the measured
radius-dependent ellipticity and inclined somewhere in 40-55 degrees, is a materially
truer model than the existing spherical one and is defensible from the sources above.
It should not claim to be more than that: position angle needs a primary-source fetch
before orientation on the sky can be trusted, the profile family should be Wilson (not
King) once fitted parameters are found, and the model should say explicitly that it
does not reproduce the innermost counter-rotating core or fully explain the ellipticity
profile via rotation alone. The literature does not yet demand a full triaxial model --
no measurement forces it -- but it also does not let an oblate model claim to be exact.
