# Phoebe sources and preparation

## Selected views

Monochrome uses the original [Cassini PDS mosaic](https://planetarydata.jpl.nasa.gov/img/data/cassini/cassini_orbiter/coiss_3001/data/images/SP_1M_0_0_SIMP.IMG), described by [NASA](https://science.nasa.gov/resource/map-of-phoebe-december-2005/) and [DLR](https://europlanet.dlr.de/Cassini-Atlases/phoebe.html). The attached PDS3 label describes a 2880 × 1440 byte image at 8 pixels/degree, about 233 m/pixel at the 106.8 km reference sphere. Image detail varies substantially. The working map retains this native density.

The source is simple cylindrical, north up, with zero longitude at its center. Although the label uses west-positive coordinates, image columns advance eastward. Preparation reads the attached pointer and projection offsets, then rolls to the shared 0–360° east-positive layout. The equal-axis reference sphere makes the label's planetographic latitude equivalent to planetocentric latitude.

There is no published missing-value mask in this product. Exact-zero pixels connected to the northern image edge are conservatively marked as missing before interpolation. Isolated black crater shadows are preserved. This inferred mask cannot certify every dark pixel; source seams, interpolation and photographed illumination remain. The mosaic is an observation, not recovered albedo. Removing local shadows would require the original images and observation geometry; we do not brighten black observations or invent their contents.

Elevation is radial height in kilometres above a 106.8 km reference sphere, from the [Gaskell 2012 shape release](https://sbn.psi.edu/pds/resource/phoebeshape.html). A −12 to +12 km palette and fixed, moderate relief lighting show terrain slopes. This is not a geoid or a separately measured DEM. The full model includes less-constrained terrain outside Cassini image coverage. The application's directional Shadows control is separate from this cartographic relief and defaults to the shared flood lighting.

## Shape and orientation

The PDS4 `phoebe_ver128q.tab` vertex-facet product has 99,846 explicit vertex rows and 196,608 triangular facets, with coordinates in kilometres. Preparation reads those row identifiers, checks the released dimensions and units, and intersects rays with the actual source facets. The retained display uses 1,216 triangles, below the 2,000-face budget. It is a simplified rendering of the source model, not a scientific-resolution reconstruction. Each face is prepared as a native PolyCSS `u` triangle in raster mode, with a 128 × 128 texture cell and precomputed flood/directional lighting banks. PolyCSS owns triangle coverage; no transparent rectangular face wrapper or runtime geometry is used. Elevation is sampled on a 721 × 361 angular grid from the source mesh, independently of that display simplification.

The source documents 208 Cassini ISS images and a 147 m position RMS. That error statistic is not an image or terrain resolution claim. Q128 was selected for roughly kilometre-scale source sampling at this body's size; the archive also provides denser Q256 and Q512 versions.

The body-fixed orientation follows the rotation parameters documented with this model: RA 356.90°, Dec 77.88°, and W = 178.58° + 931.639° × days since J2000. The later NAIF pck00011 pole declination is 77.80°. We retain the model's own frame and disclose the difference, rather than silently mixing frames. Its propagated prime meridian is a source-model phase, not a newly validated contemporary rotation solution. Orbit and mean physical radius (106.5 km) use the existing JPL-backed astronomy package; the cartographic reference sphere remains 106.8 km.

## Dataset survey

| Candidate | Decision |
| --- | --- |
| Cassini 8 pixels/degree PDS monochrome mosaic | Included at native density, with source shading and variable resolution disclosed. |
| DLR 2048 × 1024 web texture and annotated NASA map sheet | Excluded as duplicate, lower-density or annotated presentations of the same mapping. |
| Gaskell Q128 shape, migrated unchanged to PDS4 | Included for geometry and Elevation; Q256/Q512 are denser alternatives, not additional lens concepts. |
| Cassini SBIB calibrated/projected image groups, including color sequences | Surveyed at https://sbib.psi.edu/data/PDS-Phoebe/index.html. 341 calibrated images are indexed, including a RED/GRN/BL1 sequence at about 713–777 m/pixel. An actual projected RED cube was inspected: it uses a 108.95 × 101.8 km ellipsoid and ShapeModel=Null, rather than the Gaskell mesh. Its registration onto the chosen shape and regional photometry are unqualified. No arbitrary RGB or global coverage is inferred. |
| VIMS water absorption mapping (Fraser and Brown 2018) | Scientifically distinct candidate. The paper presents mapped absorption depths, but a reusable numerical map with matching projection and validity metadata has not been located. Figure colors are not numerical source data; this remains unresolved. |
| Disk spectra and isolated thermal observations | Excluded from surface lenses because they do not supply a qualified spatial map. |

Cassini regional color and VIMS mapping remain possible follow-up work; their existence is not confused with availability of a ready global texture. The VIMS study is https://arxiv.org/abs/1803.04979.

## Reproduction

Original URLs, byte lengths and hashes are pinned in `source/manifest.json`; small original labels, format documentation and preparation recipes are checked in. Large original products are reacquirable inputs. `pnpm acquire:planets -- --object=phoebe` restores sources, and `pnpm prepare:planets -- --object=phoebe` prepares the package. The navigation portrait, minimap and lens images all use the same interpreted source geometry and imagery. Runtime receives prepared assets through the generic adapter.
