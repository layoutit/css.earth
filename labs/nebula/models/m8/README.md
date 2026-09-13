# Lagoon · M8

The later [faint-signal and VISTA-footprint trial](faint-tuning.md) improves the prepared target, but central Spitzer resolution/material artifacts remain unresolved. Its separate recipe has not replaced the active cloud.

The current local presentation is `9542641c627154f767d8fe5f745d0fb3693397b25e4f7ea78e17cbb7f9bf98fd`: only the 650 star profiles change from solid disks to the main application's prepared soft core/halo. The cloud, star positions and every per-lens color, relative light and angular size input remain exactly those of `5b63a20679f9e62a9070850362c7542c2b87e35aff94e86c191cd1aa1b8985b8`. Sprite extent compensates the profile's decoded alpha integral. This is still a residual-derived overlay, not a new external stellar catalogue. [Presentation evidence](stellar-profile-evidence.json) records the output and browser checks.


The selected optical, near-infrared and mid-infrared images now have verified native star separation and a completed shared 3D cloud. The geometry uses a paper-guided local PDR interpretation with explicitly authored depth across the wider field. It is relative display emission, not recovered gas or dust density.

## Current processing · 2026-09-13

Current local result: `5b63a20679f9e62a9070850362c7542c2b87e35aff94e86c191cd1aa1b8985b8`.

- Three full native lenses: ESO optical (4000 × 2679), VISTA (4000 × 2202), and [Spitzer IRAC/MIPS](https://www.spitzer.caltech.edu/image/sig11-012-into-the-depths-of-the-lagoon-nebula) (1757 × 1417). Their unchanged source footprints share a north-up 129′ frame.
- Held-out relative star RMS: VISTA 0.758″ and Spitzer approximately 1.00″, across all four common-footprint quadrants. Absolute sky calibration still relies on publisher astrometry.
- Native NOX completed for all three. The two exact ESO results were reused; Spitzer ran 20 native tiles. Every original RGB value equals diffuse plus residual, and residual masks and artifact hashes pass.
- The final bounded bake has 444 finite emission supports and 650 shared compact lights. Three lens banks preserve the exact geometry and all 51,852,357 compared decoded alpha values.
- Compact lights now join actual optical and VISTA residual detections in registered sky coordinates: 461 optical anchors and 189 VISTA anchors. Matches within the explicit 3″ tolerance keep the optical position. Each lens retains its measured aperture light; missing residual or coverage emits zero. A source-relative 99th-percentile energy scale affects selection only, preserving the 650-light budget without treating differently stretched RGB images as calibrated flux.
- Saved Detail/Faint emission/Depth settings are 90%/15%/1×. Optical/VISTA/Spitzer fit weights are 1/0.15/0.8. These authored reliability choices reduce the influence of VISTA's crowded residual texture; all three full source footprints and lenses remain intact.
- Relative projected RMSE is 0.02828 against a zero-emission baseline of 0.21470; missing signal is 7.84% and excess is 9.26%. These describe the normalized display target, not physical accuracy. Changing source weights changes the target, so earlier error scores are not matched comparisons.
- Real Chromium inspection of the current result passed direct load, all three lenses, retained orbit pose, both side axes, star/original toggles and refresh, with zero processing requests or JavaScript errors. The original three-bake geometry budget is complete; the later missing-star correction used two bounded rounds without changing the cloud fit.

[Processing evidence](processing-evidence.json) binds the result and native checks. [Physical sources](physical-sources.json) pin seven complete primary-paper PDFs and retain 37 published molecular velocity pointings, with missing errors and corrected telescope positions explicit. [Method and source assessment](physical-structure.md) explains why the local PDR interpretation was selected.

The earlier per-lens alpha integration result `4a4fb45ad70327ae842a07780ee3865b4548ddd136d7a36b0bbec60e2a0e4482` was byte-equivalent to inspected result `60cf5ab024377e2de9e4e36e1416d4fb1481011339a1a8b65739d8ee28150bf1`. The subsequent star corrections also preserve all 3,464 cloud bank resources (13,161,734 bytes), numerical field, geometry, alpha, source panels and metrics. The original front/oblique/side receipt and screenshots remain unchanged in `output/m8-reconstruction/browser-final/`; their cloud assessment still applies. Stellar selection and aperture ownership changed, so current star evidence comes from the fresh `output/nebula-processing/m8-stars-union-browser/` inspection, not those historical captures.

The missing-interior-star investigation found two preparation causes. A 6,000 sharp-peak cutoff discarded broad bright residual sources before aperture ranking; removing it raised central-region selection from 68 to 117 lights. An optical-only catalogue still omitted bright VISTA sources. The registered union raises that same region to 158 lights, with 131 positive optical and 145 positive VISTA appearances. Of the 100 brightest independently measured VISTA core residual maxima, 83 now have a selected point within 3″, versus 10 before the union. This is a coverage diagnostic, not a stellar identification or completeness estimate. Native optical/VISTA crops and exact detector positions verify the two highlighted infrared restorations. The 15 targeted tests pass; removing the early-cutoff fix, union, deduplication or exposure normalization causes its corresponding regression to fail.

## Known problems

The literature constrains only small local regions: 3 of 444 supports meet the recipe's local paper-guidance threshold; the other 441 are authored. One surface cannot reproduce the distinct absorbing foreground veil, overlapping molecular layers or scattering. Gas velocities are not converted to depth. HST detail fields remain unverified and excluded; the zero-filled central Herschel field remains excluded.

The VISTA source retains crowded-field texture and broad stellar halos after NOX. Compact nebular knots can enter the residual. Narrow HH features are below this wide-field bake's useful detail. Spitzer and VISTA cover less sky than the optical source; uncovered cloud texels retain neutral material, and missing coverage does not mean absent material. Compact lights have observed projected positions and conditional model depths, not measured membership or distance.

The 650-light budget selects from 76,178 merged residual candidates, so faint and some bright sources remain omitted; 17 of the diagnostic VISTA top 100 remain unmatched within 3″. Saturated or broad halos can produce several residual maxima outside that tolerance. One previously selected broad optical peak is replaced in the budget by nearby measured VISTA maxima 6.23″ and 8.10″ away; these are not qualified separate stellar identities or a repaired stellar centroid. No broad mask, invented infrared membership, astrometric shift or photometric boost conceals that limitation. Spitzer supplies per-lens light but is not a detection source.

Visual quality remains limited: peripheral residual blobs persist, the oblique/side views expose a thin curved layer with visible slice/grid banding, and the infrared color-to-neutral footprint boundaries are sharp. The broad fit smooths fine native filaments and knots. These are recorded failures of visual fidelity, despite passing preparation and interaction checks. A clean-cache NOX replay and quantitative axis-handoff continuity check were not run.

The earlier two-source recipes and native caches remain available unchanged. Current processing uses [processing-observations.json](processing-observations.json), [processing-structures.json](processing-structures.json), [depth-model.json](depth-model.json), and the updated [compiler.json](compiler.json). The complete six-candidate catalogue remains separate in [alignment-candidates.json](alignment-candidates.json).

Current Alignment selection: **ESO optical, ESO VISTA and Spitzer**. These retain the existing passing relative-star transforms (held-out RMS ≈0.76″ and 1.00″). Hubble close-ups remain documented but hidden until their small core fields can be independently matched. Herschel is hidden: its paired FITS array is zero-filled across a 6′ patch around both the Hubble and Spitzer central coordinates. This is missing support, not absence of nebular material.

Asymmetric H II region and star-forming nebula.

## Original two-source batch · 2026-09-12

This first comparison batch pins the official ESO **Publication TIFF 4K** variants, downloaded unchanged on 2026-09-12. These retain each master image’s full footprint; no local resizing or cropping was used. Native star removal runs on the selected TIFF’s actual pixel grid. Larger publisher masters remain available for a later quality comparison.

| Lens | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 2679 | 93.49′ × 62.61′ | [Source](https://www.eso.org/public/images/eso0936a/) |
| ESO VISTA · infrared | 4000 × 2202 | 71.81′ × 39.54′ | [Source](https://www.eso.org/public/images/eso1101d/) |

- **ESO · optical** — Optical · H-alpha / R / V / B. Credit: ESO.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0936a.tif); [publisher master](https://cdn.eso.org/images/original/eso0936a.tif) (23569 × 15784).
- **ESO VISTA · infrared** — Near-infrared · J / H / Ks (caption; publisher AVM incorrectly labels H as H-alpha). Credit: ESO/VVV. Acknowledgment: Cambridge Astronomical Survey Unit.
  [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1101d.tif); [publisher master](https://cdn.eso.org/images/original/eso1101d.tif) (12630 × 6954).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

## Registration and reproducibility

- `observations.json` pins each downloaded TIFF by SHA-256 and actual dimensions, exact embedded publisher AVM TAN WCS, original master dimensions/link, and a common north-up frame. AVM reference pixels use the declared reference dimensions; they are not necessarily centered or expressed on the TIFF grid.
- The common frame contains all native source corners with a six-percent angular margin. No frame was cropped to make the photographs agree.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix joint-fit recipe or planetary expansion prior is reused.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal/reconstruction.

## Historical source qualification

The optical mosaic is wider than the VISTA strip. Missing infrared support at the northern/southern optical margins is no-data, not absent gas. The VISTA caption gives J/H/Ks; its filter table and AVM incorrectly identify H as H-alpha. The recipe documents the discrepancy rather than treating this as infrared H-alpha.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).

## Separate alignment intake · 2026-09-13

[alignment-candidates.json](alignment-candidates.json) defines the isolated `m8-alignment` source set. It preserves the two ESO source pins above and adds four spectral views. At that intake, the original `observations.json`, `compiler.json` and accepted processing caches were unchanged. The current processing section above supersedes the intake-only status for the three selected sources.

| Candidate | Native downloaded grid | Complete source footprint | Role |
|---|---|---|---|
| ESO WFI optical | 4000 × 2679 TIFF | 93.49′ × 62.61′ | Wide optical context |
| ESO VISTA J/H/Ks | 4000 × 2202 TIFF | 71.81′ × 39.54′ | Near-infrared strip |
| [Hubble optical](https://esahubble.org/images/heic1808a/) | 4782 × 6028 TIFF | 3.189′ × 4.020′ | Central detail, [O III]/Hα/[N II]/y |
| [Hubble near-infrared](https://esahubble.org/images/heic1808b/) | 4782 × 6028 TIFF | 3.192′ × 4.024′ | Central detail, J/H |
| [Spitzer mid-infrared](https://www.spitzer.caltech.edu/image/sig11-012-into-the-depths-of-the-lagoon-nebula) | 1757 × 1417 TIFF | 35.726′ × 28.813′ | IRAC 3.6–8 µm and MIPS 24 µm |
| [Herschel PACS 160 µm](https://alasky.cds.unistra.fr/ESAC/ESAVO_P_HERSCHEL_PACS160norm/properties) | 2000 × 2000 JPEG + FITS | Complete 2° service query | Partial far-infrared survey context |

Every selected source file is below 100 MB. No local crop or resize changed its downloaded grid. The Hubble and Spitzer TIFFs are the publisher masters; the larger ESO masters remain linked. The Herschel source is a bounded HiPS2FITS sky request, not the full archive mosaic. A separate 129′ square alignment frame contains the native footprints; empty margins around the Hubble details remain unsupported.

[source-dossier.json](source-dossier.json) records native byte sizes, hashes, cache paths, credits, terms, epochs, bands and source quality. ESO and Hubble WCS come from embedded AVM. Spitzer's TIFF omits spatial AVM, so its exact TAN WCS and 2005 per-instrument start times come from the matching [IPAC AstroPix record](https://www.astropix.org/image/spitzer/sig11-012). Herschel uses the exact matching-query FITS header. Publisher astrometry is provisional, with no independent match acceptance claimed here.

The Herschel image is explicitly limited context: normalized tiles contain visible seams, clipping, no-data and finite zero fill. Its FITS contains 320,814 non-finite samples and 1,309,632 zero samples out of four million; those counts are not a science validity mask. It uses publisher-WCS registration because optical field stars do not qualify this band. Neither its JPEG nor normalized FITS supplies calibrated dust brightness. The provider's publishing-policy URL is retained, but its policy page returned HTTP 451 during intake; no Creative Commons licence is inferred.

Grid sampling ranges from about 0.040″ per Hubble output pixel to 3.6004″ per Herschel cutout pixel. These values are **pixel spacing, not measured angular resolution**. Source-specific PSFs, beams, observing epochs and stretches must be qualified before comparing intensities. The optical Hubble caption dates its observations to 12–18 February 2018; dates absent from other image records remain unknown rather than being copied from release dates.

### Literature for the next evidence step

The dossier links five primary papers and records whether the abstract, full text or underlying data was inspected:

- [Arias et al. (2006)](https://doi.org/10.1111/j.1365-2966.2005.09829.x): Hourglass infrared photometry, local HST morphology and longslit evidence; local coverage and a stellar distance estimate do not establish whole-cloud depth.
- [Barbá & Arias (2007)](https://doi.org/10.1051/0004-6361:20066081): Hα/[S II] Herbig–Haro structures and candidate driving sources; projected shock features need their original footprint and kinematic evidence.
- [Wright et al. (2019)](https://doi.org/10.1093/mnras/stz870): Gaia-ESO/Gaia stellar kinematics; anisotropic cluster expansion cannot supply a spherical gas-expansion prior.
- [Kahle et al. (2024)](https://doi.org/10.1051/0004-6361/202349009): molecular spectra at 37 clumps and infrared/submillimetre SEDs; incomplete Hi-GAL coverage, differing beams and foreground emission matter.
- [Singh et al. (2026)](https://doi.org/10.3847/1538-4357/ae563a): whole-nebula LVM line diagnostics and a [27-map figure set](https://doi.org/10.5281/zenodo.19165622). Preserve fibre positions, masks, inverse variances and line thresholds before qualifying numerical data; plotted figures are not native line-map inputs.

The intake's six byte pins and decoded dimensions were checked with the strict observation reader. This is source qualification only: no star removal, NOX, compiler, reconstruction or bake was run for these additions.

## Central optical detail follow-up

The [Hubble 2018 optical view](https://esahubble.org/images/heic1808a/) is the
best existing local-detail candidate: [O III], y, Hα and [N II], observed
12–18 February 2018. Its 3.19′ × 4.02′ footprint covers the Hourglass/Herschel 36
region, not the complete Lagoon. Its line-color assignment differs from the
ESO B/V/R/Hα widefield; a later composite must retain that distinction.

Two bounded registration attempts remain below the unchanged 45-match gate:
zero against the 4K ESO image, and nine against a localized, scale-matched crop
of the full 23,569 × 15,784 ESO JPEG. The full official JPEG was downloaded and
inspected, but its bright center remains washed out. More pixels alone cannot
recover Hubble's central contrast. [Exact evidence](source-dossier.json) records
both failures, the downloaded master, inspected crop and unchanged recipe hashes.

Hubble remains excluded from the selected processing set. The next useful step
is a qualified optical catalogue or intermediate astrometric image, followed by
a local multi-resolution material contribution attached to supported 3D
structures. Neither a whole-cloud Hubble texture nor repeating its patch through
the full depth is an acceptable composite. No new NOX processing or bake ran.
