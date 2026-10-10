# Lagoon · M8

This lab holds the processing studies for the Lagoon Nebula, an asymmetric H II region and star-forming nebula. The [current shipped object record](../README.md) owns the active sources, delivery evidence and known problems. Results below do not qualify later deliveries.

The selected optical, near-infrared and mid-infrared images have verified native star separation and a shared 3D cloud. The geometry uses a paper-guided local PDR interpretation with explicitly authored depth across the wider field. It is relative display emission, not recovered gas or dust density.

## Sources

| Dataset | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 2679 | 93.49′ × 62.61′ | [Source](https://www.eso.org/public/images/eso0936a/) |
| ESO VISTA · infrared | 4000 × 2202 | 71.81′ × 39.54′ | [Source](https://www.eso.org/public/images/eso1101d/) |
| [Spitzer IRAC/MIPS](https://www.spitzer.caltech.edu/image/sig11-012-into-the-depths-of-the-lagoon-nebula) | 1757 × 1417 | 35.726′ × 28.813′ | IRAC 3.6–8 µm and MIPS 24 µm |

- **ESO · optical**: Optical · H-alpha / R / V / B. Credit: ESO. [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso0936a.tif); [publisher master](https://cdn.eso.org/images/original/eso0936a.tif) (23569 × 15784).
- **ESO VISTA · infrared**: Near-infrared · J / H / Ks (caption; publisher AVM incorrectly labels H as H-alpha). Credit: ESO/VVV. Acknowledgment: Cambridge Astronomical Survey Unit. [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1101d.tif); [publisher master](https://cdn.eso.org/images/original/eso1101d.tif) (12630 × 6954).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. These are independently stretched outreach RGB composites, not calibrated common-band luminosity measurements.

[alignment-candidates.json](alignment-candidates.json) also documents [Hubble optical](https://esahubble.org/images/heic1808a/), [Hubble near-infrared](https://esahubble.org/images/heic1808b/) and [Herschel PACS 160 µm](https://alasky.cds.unistra.fr/ESAC/ESAVO_P_HERSCHEL_PACS160norm/properties) views. [source-dossier.json](source-dossier.json) records their credits, terms, epochs, bands and source quality. Spitzer's TIFF omits spatial AVM, so its TAN WCS comes from the matching [IPAC AstroPix record](https://www.astropix.org/image/spitzer/sig11-012). The Herschel provider's policy page returned HTTP 451 during intake; no Creative Commons licence is inferred.

[Physical sources](physical-sources.json) retain seven primary papers and 37 published molecular velocity pointings. [Method and source assessment](physical-structure.md) explains why the local PDR interpretation was selected. The dossier's five primary papers are [Arias et al. (2006)](https://doi.org/10.1111/j.1365-2966.2005.09829.x), [Barbá & Arias (2007)](https://doi.org/10.1051/0004-6361:20066081), [Wright et al. (2019)](https://doi.org/10.1093/mnras/stz870), [Kahle et al. (2024)](https://doi.org/10.1051/0004-6361/202349009) and [Singh et al. (2026)](https://doi.org/10.3847/1538-4357/ae563a), with its [27-map figure set](https://doi.org/10.5281/zenodo.19165622).

## Recipes and registration

Current processing uses [processing-observations.json](processing-observations.json), [processing-structures.json](processing-structures.json), [depth-model.json](depth-model.json), and [compiler.json](compiler.json). The earlier two-source recipes remain available unchanged.

- `observations.json` names each downloaded TIFF by URL with its dimensions, embedded publisher AVM TAN WCS and a common north-up frame. The common frame contains all native source corners with a six-percent angular margin; no frame was cropped to make the photographs agree.
- Images and all derived outputs live in the ignored local cache. The checked-in recipes restore the pinned sources. Alignment must pass held-out field-star checks before native removal and reconstruction.
- Held-out relative star RMS is 0.758″ for VISTA and approximately 1.00″ for Spitzer. Absolute sky calibration still relies on publisher astrometry.
- Compact lights join optical and VISTA residual detections in registered sky coordinates: 461 optical anchors and 189 VISTA anchors, with a 3″ match tolerance and a 650-light budget.
- Saved Detail/Faint emission/Depth settings are 90%/15%/1×. Optical/VISTA/Spitzer fit weights are 1/0.15/0.8. These are authored reliability choices.

See [the compiler method](../../../../labs/nebula/docs/emission-compiler.md) and [workflow](../../../../labs/nebula/docs/workflows.md).

## Image-edge taper · 2026-09-14

The current recipe softens faint image-footprint boundaries before fitting. ESO optical has a 450″ inward source taper and a 450″ common display-window feather; VISTA and Spitzer each have a 240″ source taper. These are authored display choices, not measured nebular boundaries. The target retains **99.917%** of the summed signal in its bright core, and total target signal decreases **2.127%**. [Target evidence](edge-taper-evidence.json) records the check. The app bake is `m8-edge-taper`.

## Previous optical extent · 2026-09-13

The preceding recipe limited cloud emission to the registered **ESO optical footprint**, with a 90″ inward feather. This was an authored display extent, not a measured boundary of the Lagoon. Against 128 × 128 × 32 XYZ field samples it left **zero emitting samples outside** the optical image; removing only the window restores 45,683. See [the numerical and browser evidence](optical-window-evidence.json).

A separate [faint-signal and VISTA-footprint trial](faint-tuning.md) improves the prepared target, but central Spitzer artifacts remain. [Processing evidence](processing-evidence.json) and [presentation evidence](stellar-profile-evidence.json) record earlier results.

## Excluded sources

- **Hubble** covers 3.19′ × 4.02′ around the Hourglass/Herschel 36 region, not the complete Lagoon. Two registration attempts stayed below the 45-match gate: zero against the 4K ESO image and nine against a scale-matched crop of the full ESO JPEG. The next step is a qualified optical catalogue or intermediate astrometric image. A whole-cloud Hubble texture is not an acceptable composite.
- **Herschel** is hidden: its paired FITS array is zero-filled across a 6′ patch around the central coordinates. This is missing support, not absence of nebular material. It is a bounded HiPS2FITS request, not the full archive mosaic, and supplies no calibrated dust brightness.

## Known problems

The literature constrains only small local regions: 3 of 444 supports meet the recipe's local paper-guidance threshold; the other 441 are authored. One surface cannot reproduce the distinct absorbing foreground veil, overlapping molecular layers or scattering. Gas velocities are not converted to depth.

The VISTA source retains crowded-field texture and broad stellar halos after NOX. Narrow HH features are below this wide-field bake's useful detail. Spitzer and VISTA cover less sky than the optical source; missing coverage does not mean absent material. Compact lights have observed projected positions and conditional model depths, not measured membership or distance.

The 650-light budget selects from 76,178 merged residual candidates, so faint and some bright sources remain omitted; 17 of the diagnostic VISTA top 100 remain unmatched within 3″. Spitzer supplies per-dataset light but is not a detection source.

Visual quality remains limited: peripheral residual blobs persist, the oblique and side views expose a thin curved layer with visible slice/grid banding, and the infrared color-to-neutral footprint boundaries are sharp. The broad fit smooths fine native filaments and knots. A clean-cache NOX replay and quantitative axis-handoff continuity check were not run.
