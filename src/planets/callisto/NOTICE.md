# Callisto notices

- Surface: NASA/JPL/USGS, Galileo SSI and Voyager image mosaic. USGS lists the
  [dataset](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km)
  as public domain, with no use restrictions. Prepared maps retain the source's
  photometric normalization and overlap matching; changes here are resampling,
  no-data annotation, projection packing and lighting presentation.
- Galileo color: NASA/JPL/DLR PIA03456, redistributed by USGS as public domain.
  The retained published PNG is geometrically reprojected with an explicit
  coverage cutoff; no new radiometric calibration is claimed. The source camera
  review uses NASA/JPL/USGS monochrome mapping and IAU/USGS Gazetteer positions
  only as registration evidence, never as replacement color texture.
- Jupiter context: NASA, ESA, STScI, and Amy Simon. The pinned Hubble photograph
  is cropped to a prepared disk; see the image URL and NASA media guidance in
  the source manifest.
- Sky panorama: ESO/S. Brunier, CC BY 4.0. See `source/stars/ESO-IMAGE-LICENSE.md`.
- Star catalogue: David Nash / Astronexus, HYG v4.1, CC BY-SA 4.0.
  See `source/stars/LICENSE.md` and `hyg-v41-field.json`.
- Title outlines: Inter by Rasmus Andersson, SIL Open Font License 1.1.
- Physical and orbital context: NASA/JPL and IAU/WGCCRE through the project's
  vendored astronomy package. See that package's provenance and notices.

No observed texture is claimed for missing coverage. Globe lighting is an
approximation and does not recover terrain hidden by photographed shadows.

## B6 sources

The added views derive from credited public USGS/NASA scientific products. Preserve the source authors, PDS citation and processing qualifications recorded in README.md and the source manifest. No endorsement is implied.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 12 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.
