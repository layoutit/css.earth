# Celestial source directory

Choose the entries relevant to the body and missing product; this is not a
requirement to search every archive. Start with existing body manifests and
source records, then follow the provider's target, mission or paper links.
These are discovery routes, not prequalified datasets. Preserve product-specific
versions, frames, processing levels and reuse terms in the body records.

## Spacecraft observations, meshes and mapped surfaces

| Source | What to look for | Selection detail |
| --- | --- | --- |
| [NASA PDS Data Search](https://pds.nasa.gov/datasearch/data-search/) | Mission and non-mission collections across planetary targets; node search tools and APIs. | Search the target name, number, mission and instrument. Open collection inventories and labels, not just catalogue summaries. |
| [PDS Small Bodies Node mission directories](https://pds-smallbodies.astro.umd.edu/data_sb/missions/) | Native and calibrated asteroid/comet observations, instrument documentation and derived products. [Lucy](https://pds-smallbodies.astro.umd.edu/data_sb/missions/lucy/) is a direct entry. | Read errata and geometry companions. A calibrated image can retain preliminary camera geometry. |
| [PDS SBN/PSI shape models](https://sbn.psi.edu/pds/shape-models/) and [non-mission archive](https://sbnarchive.psi.edu/pds4/non_mission/) | Spacecraft, radar and other published shape reconstructions; vertex/facet tables, radius grids and companion records. | Search author names as well as targets. Thomas and Gaskell releases illustrate numeric models stored as `.tab`, not `.obj`. |
| [Small Body Mapping Tool](https://sbmt.jhuapl.edu/) | Shape models, mapped spacecraft observations and related scientific products for supported small bodies. | Follow each model's source and public release. A body appearing in SBMT does not guarantee public access to its mesh or registered observations. |
| [JAXA DARTS Hayabusa2](https://darts.isas.jaxa.jp/planet/project/hayabusa2/) and [Watanabe et al. model release](https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/Watanabe_2019/README.html) | Ryugu images, multiple-resolution OBJ/DAT meshes, per-facet numeric tables and paper-analysis inputs. | SfM and SPC models are distinct. The per-facet CSV is not interchangeable with a vertex/connectivity table. |
| [JAXA JADE2](https://jade2.darts.isas.jaxa.jp/) | Explore Hayabusa2 products spatially and trace selected surface layers to their downloadable data. | Use numeric products and their metadata for scientific lenses, rather than a screenshot of the viewer. |
| [DLR Dawn maps](https://dawngis.dlr.de/) | Vesta and Ceres mosaics, color/spectral products and terrain models. | Read whether a DTM stores radius or height above a reference surface; keep the published projection and longitude convention. |
| [USGS Astropedia](https://astrogeology.usgs.gov/search) | Controlled mosaics, albedo maps, terrain and geologic products for planets, moons and small bodies. | For example, [NEAR MSI albedo mosaics](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics). Read the map's photometric normalization and gap policy. |
| [ESA Planetary Science Archive](https://www.cosmos.esa.int/web/psa) | ESA planetary mission observations and derived collections, including Rosetta. | Keep instrument, calibration level and shape/camera version together; browse the actual product bundle. |
| [PDS Geosciences](https://pds-geosciences.wustl.edu/) | Planetary and lunar topography, gravity, spectroscopy and related mission products. | A derived gravity or spectral field is a separate scientific quantity, not an optical surface texture. |
| [NAIF SPICE data](https://naif.jpl.nasa.gov/naif/data.html) | Reconstructed trajectories, attitude, body frames, clocks and DSK shape kernels where released. | Read kernel comments for provisional or placeholder values; compare the pole, period and epoch with the selected shape release. No DSK in one directory does not rule out an OBJ, table or paper release elsewhere. |

## Shapes from Earth-based observations

| Source | What to look for | Selection detail |
| --- | --- | --- |
| [JPL radar asteroid shapes](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) | Target-specific radar shape downloads and publications. | Retain resolution, pole ambiguities and poorly constrained terrain. Radar backscatter is not optical albedo. |
| [DAMIT](https://damit.cuni.cz/) | Asteroid shape/spin solutions, references and supporting observations from light-curve inversion. | Check scale and alternate pole solutions. A convex inversion model does not resolve craters or supply photographic texels. |
| [LAM VLT/SPHERE asteroid survey](https://observations.lam.fr/astero/) and [3D shapes](https://observations.lam.fr/astero/3Dshape/) | Disk-resolved images and published asteroid OBJ models, including MPCD reconstructions. | Follow the target's paper and image collection; an optical shape reconstruction does not imply a global registered mosaic. |

## Papers and research-code inputs

| Source | What to look for |
| --- | --- |
| [CDS VizieR](https://vizier.cds.unistra.fr/) | Machine-readable paper tables and associated files. Search by paper identifier and inspect each table's column definitions. |
| [DLR publication repository](https://elib.dlr.de/) | Author-hosted planetary papers and conference material. Follow supplements and data-availability links to the actual numeric files. |
| [Ryugu controlled mosaic release](https://doi.org/10.7910/DVN/WW3IH0) | A concrete Harvard Dataverse example: a paper-associated surface release outside the mission's main archive. Follow analogous author-linked Dataverse, Zenodo or Figshare deposits and inspect their file inventories. |
| [TEMPEST research repository](https://github.com/duncanLyster/TEMPEST) | Thermal-model input meshes and configurations. Inspect the version used by the paper, including public history when current files omit those inputs. |

When a paper uses a mesh but its archive entry does not expose one, follow the
paper's analysis software and data citations. Look for numeric geometry in model
inputs, example configurations, release assets and supplements, including
`.obj`, `.stl`, `.ply`, `.vtk`, vertex/facet tables and radius grids. Confirm what
each table represents; point positions or facet centres alone need not provide
surface connectivity. Simulation outputs and author-drawn models remain models,
even when distributed beside spacecraft observations.

For a relevant public Git repository, inspect its file tree and path history
before cloning it or downloading large archives. If a cleanup removed the input,
inspect the last public revision containing it. Pin the exact commit and bytes;
establish upstream provenance and reuse terms rather than assuming the code's
license covers third-party data. Retrieve only the needed files. Do not bypass
restricted releases or turn a failed request into a claim of nonexistence.

Dinkinesh is a worked example: [Lyster et al. (2025)](https://doi.org/10.5194/epsc-dps2025-546)
describe a 1,266-facet input. TEMPEST's current tree omitted it, but
[commit `7df4c88`](https://github.com/duncanLyster/TEMPEST/commit/7df4c88063ebe811cbdd25b97c19f85559607459)
contains `data/shape_models/dinkinesh.stl` and `selam_two_lobes.stl`.
The retrieved Dinkinesh file has 635 distinct vertices and 1,266 triangles;
the Selam file is a smooth lobe approximation. This establishes accessible
geometry candidates, not photograph registration. The
[Dinkinesh source account](../../../../src/planets/dinkinesh/README.md#lucy-photographic-source-check-13-september-2026)
owns the inspection results and unresolved model/frame questions.

For a numeric-table example, [Mathilde's Thomas release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/)
contains both `253mathilde.tab` (shape) and `253mathimg.tab` (reconstructed image
geometry). Read the [registration investigation](registered-photographic-mosaics.md#inspect-the-release-before-reconstructing-geometry)
before substituting image-header pointing for such companion tables.

## Positions, physical values and places

| Source | What to look for | Selection detail |
| --- | --- | --- |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Ephemerides, vectors and orbital elements for target/observer/time selections. | Preserve centre, frame, time scale, units and epoch. These are not surface meshes or complete image-camera solutions. |
| [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) | Small-body identity, orbit class, physical values and their references. | Carry each measurement's uncertainty and source; a diameter does not establish three axes. |
| [IAU/USGS Gazetteer](https://planetarynames.wr.usgs.gov/) | Adopted surface names, coordinates, extents, target coordinate systems and GIS exports. | Match the selected model's frame. A centre/extent is not a surveyed feature boundary; unpositioned names cannot establish anchors. |

After selecting a product, return to the existing
[preparation recipe map](implementation-map.md#registered-photographic-mosaics)
and qualification guidance. Add useful newly discovered routes here; keep exact
body input pins and detailed investigation results in their existing owners.
