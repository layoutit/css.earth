# Preserve quantitative map precision and source support

Proposal 26 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Bennu and Eros bands are shipped; several SPC moon packages already use albedo and radius products. Their auxiliary rasters are not all selected.

Improve numeric decoding, masks and source-support evidence where the native products expose more precision, counts, uncertainty, XYZ or observing angles.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md), [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md), [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md), [dione](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/rhea/README.md), [tethys](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/tethys/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md)

## Evidence

The USGS audit identified Bennu ancillary products and a catalogue-versus-file dimension discrepancy; PDS4 supplies related SPC support products.

## Work

Compare exact current inputs to the native release, retain quantitative data through preparation, and use counts/angles to qualify measurements. Add a displayed quality view only if it answers a clear question within existing controls.

## Limits and prior decisions

Quality counts and uncertainty are not new physical quantities. Do not re-add existing bands, replace geometry, or create a Dataset details panel.

## Acceptance

Source samples, validity masks, precision loss, orientation and declared dimensions; an evidence-only result is valid if existing output is already adequate.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-dione.cassini.shape-models-maps/bundle_satellite-dione.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/bundle_satellite-mimas.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-phoebe.cassini.shape-models-maps_V1_0/bundle_satellite-phoebe.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-rhea.cassini.shape-models-maps/bundle_satellite-rhea.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-tethys.cassini.shape-models-maps/bundle_satellite-tethys.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.color_geom_cubes/bundle_galileo.ast-gaspra.color_geom_cubes.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.lidar/bundle_hay.lidar.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_lidar/bundle_hyb2_lidar_v002.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_msi_digital_image_maps/bundle_near_msi_digital_image_maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.nlr/bundle_near.nlr.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/nearmsi.shapebackplane/bundle_nearmsi.shapebackplane.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/bundle_altimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.image_processing/bundle_image_processing.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.ola/bundle_ola.xml)
- [USGS product record](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_pan_mosaic_5cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_albedo_mosaic_6_25cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm)

PDS bundle IDs: `urn:nasa:pds:satellite-dione.cassini.shape-models-maps`, `urn:nasa:pds:satellite-mimas.cassini.shape-models-maps`, `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps`, `urn:nasa:pds:satellite-rhea.cassini.shape-models-maps`, `urn:nasa:pds:satellite-tethys.cassini.shape-models-maps`, `urn:nasa:pds:galileo.ast-gaspra.color_geom_cubes`, `urn:nasa:pds:hay.lidar`, `urn:jaxa:darts:hyb2_lidar`, `urn:nasa:pds:near_msi_digital_image_maps`, `urn:nasa:pds:near.nlr`, `urn:nasa:pds:nearmsi.shapebackplane`, `urn:nasa:pds:orex.altimetry`, `urn:nasa:pds:orex.image_processing`, `urn:nasa:pds:orex.ola`.

USGS catalogue IDs: `bennu_osiris_rex_ocams_global_pan_mosaic_5cm`, `bennu_osiris_rex_ocams_global_albedo_mosaic_6_25cm`, `bennu-osiris-rex-ocams-photometric-mosaics-25cm`, `near_msi_albedo_mosaics`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
