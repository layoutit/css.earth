# Reproduce mapped science inputs

These tools run offline, before the existing celestial-body preparers. They
produce compact, pinned GeoTIFF inputs. The browser receives only prepared
textures and existing content controls.

Install `requirements-mapped-science.txt` in a Python 3.12+ virtual environment.
Set `OPENBLAS_NUM_THREADS=1`, `OMP_NUM_THREADS=1`, and run one command at a time.
The four body acquisition plans identify originals in the `mapped-science`
group; use the normal acquisition executor to restore them. Original binaries
remain excluded from Git. The compact output TIFFs are checked in deliberately.

Run these from the repository root, using that environment's Python:

```
python tools/objects/acquisition/geology-grid.py src/planets/moon/source/geology/prepare-grid.json
python tools/objects/acquisition/coordinate-tiff-grid.py src/planets/moon/source/science/prepare-cf-map.json
python tools/objects/acquisition/geology-grid.py src/planets/europa/source/geology/prepare-grid.json
python tools/objects/acquisition/nims-composite.py src/planets/europa/source/nims/prepare-composite.json
python tools/objects/acquisition/nims-composite.py src/planets/callisto/source/nims/prepare-composite.json
python tools/objects/acquisition/pds4-byte-geotiff.py src/planets/charon/source/science/prepare-bond-map.json
python tools/objects/acquisition/test_mapped_science.py
```

Each plan pins original bytes and coordinate conventions; each receipt pins the
result. Failures require source review, never an automatic pin refresh. GDAL and
compression versions can affect container bytes; numeric samples and mapping
must also be compared before accepting an output from a changed environment.

NIMS display uses the guide's same-parity RGB bands. The actual registered TIFF
CRS and affine govern mapping, as recommended by the guides. PDS labels retain
rounded original west-longitude projection fields and, in Europa 17ENGLOBAL01A,
an incorrectly abbreviated upper-left northing. COC backplanes use the older
unregistered geometry. None of those fields replaces the registered TIFF grid.
The output retains the registered GIS latitude coordinates on the source
ellipsoid. Minnaert correction does not remove all photometric artifacts.
Band-specific linear display ranges are fixed across observations. Negative
calibrated noise clips to the low display endpoint; ISIS special/nonfinite
values are missing. The first observation in each plan wins an overlap. No
per-frame color normalization, despiking, blending, mineral estimation or gap
fill is applied.

NIMS registration uses explicit inverse-coordinate lookup in 32-row strips. Each
canonical longitude/latitude is projected through the registered native CRS and
selects precisely its native source cell; missing cells never borrow neighboring
measurements. The output is a spherical EQC grid with linear angular rows. The
source ellipsoid is used only by its native projection. This also avoids version-
dependent ellipsoidal EQC interpretation. The independent source-point proof
covers a Callisto limb cell that the former warp resampler incorrectly filled.
