# Lagoon · M8

Current Alignment selection: **ESO optical, ESO VISTA and Spitzer**. These retain the existing passing relative-star transforms (held-out RMS ≈0.76″ and 1.00″). Hubble close-ups remain documented but hidden until their small core fields can be independently matched. Herschel is hidden: its paired FITS array is zero-filled across a 6′ patch around both the Hubble and Spitzer central coordinates. This is missing support, not absence of nebular material.

Asymmetric H II region and star-forming nebula.

## Sources

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

## Interpretation and current evidence

The optical mosaic is wider than the VISTA strip. Missing infrared support at the northern/southern optical margins is no-data, not absent gas. The VISTA caption gives J/H/Ks; its filter table and AVM incorrectly identify H as H-alpha. The recipe documents the discrepancy rather than treating this as infrared H-alpha.

The source packet was verified against both image SHA-256 values and decoded TIFF dimensions using the strict TypeScript observation, structure and compiler readers. This source qualification does **not** assert passed stellar registration, completed star removal, a completed bake or a validated 3D shape. Those processing receipts remain tied to their specific output identities.

Without spectroscopy or an independent volume, the compiler’s depth is a conditional diffuse prior. Compact lights are detected image features with illustrative depths; they are not a catalog of confirmed members with measured distances.

See [the completed batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12), [the compiler method](../../docs/emission-compiler.md) and [workflow](../../docs/workflows.md).

## Separate alignment intake · 2026-09-13

[alignment-candidates.json](alignment-candidates.json) defines the isolated `m8-alignment` source set. It preserves the two ESO source pins above and adds four spectral views. The original `observations.json`, `compiler.json` and accepted processing caches remain unchanged. This intake authorizes source inspection and alignment only.

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
