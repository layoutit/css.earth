# Astroquery

cssEarth uses [Astroquery 0.4.11](https://pypi.org/project/astroquery/), installed into an ignored local toolchain from the
hashed lock beside this file. Astroquery is copyright 2011–2024 Astroquery Developers and distributed under the BSD 3-Clause
license reproduced in [LICENSE.rst](LICENSE.rst). cssEarth does not copy or modify Astroquery source code and does not imply
endorsement by the Astropy Team or Astroquery contributors.

# PDS packages

cssEarth installs [pds.peppi 0.5.0](https://github.com/NASA-PDS/peppi) and
[pdr 1.4.4](https://github.com/MillionConcepts/pdr) into an ignored local Conda environment. Peppi owns complete paginated target searches and exact PDS4 Registry
discovery and pdr owns supported PDS3/PDS4 decoding. cssEarth copies or modifies neither package. It retains the complete
archive file set, byte pins, intended-use checks and scientific qualification. Peppi is copyright California Institute of
Technology and distributed under Apache-2.0; pdr is copyright 2021 Million Concepts and distributed under BSD-3-Clause.
Their licenses and Peppi's notice are reproduced beside this file.

Please cite Ginsburg et al., “astroquery: An Astronomical Web-querying Package in Python”, *The Astronomical Journal* 157:98
(2019), [doi:10.3847/1538-3881/aafc33](https://doi.org/10.3847/1538-3881/aafc33), and the version-specific Astroquery release.

The software license does not grant rights in data returned by an observatory. Each cssEarth program and product continues to
record the archive origin, attribution, access state and reuse terms of its own input data.

# PyVO

cssEarth uses [PyVO 1.9.1](https://pypi.org/project/pyvo/) as the sole implementation of IVOA TAP requests and VOTable
parsing. PyVO is installed from the same hash-locked environment; no PyVO source is copied or modified. PyVO is distributed
under the BSD 3-Clause license reproduced in [PYVO-LICENSE.rst](PYVO-LICENSE.rst). Cite Graham et al., “PyVO: Python access
to the Virtual Observatory”, *Astronomy and Computing* 25 (2018), doi:10.1016/j.ascom.2018.07.003.

# Astropy

Astroquery and PyVO depend on [Astropy 8.0.1](https://pypi.org/project/astropy/). It is installed from the hash-locked
environment and is not copied or modified. Astropy is distributed under the BSD 3-Clause license reproduced in
[ASTROPY-LICENSE.rst](ASTROPY-LICENSE.rst). Its NDData arithmetic owns selected-output
error propagation. [Astropy visualization](https://docs.astropy.org/en/stable/visualization/index.html)
owns WCSAxes sky coordinates, ImageNormalize scaling and quantity-aware axes. Astropy FITS
and QTable serialize the scientific outputs, including units and masks.

# Matplotlib

cssEarth uses [Matplotlib 3.11.2](https://matplotlib.org/) for static telescope output figures.
It is an installed, hash-pinned dependency in the astronomy environment; no implementation
source is copied or modified. Its complete license is retained in
[MATPLOTLIB-LICENSE.txt](MATPLOTLIB-LICENSE.txt). See [savefig](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.savefig.html)
for the PNG/SVG output boundary. Numeric values, scientific interpretation and receipts remain
owned by cssEarth. Plotted archive data retain their original provenance and terms.

# Optional output reference tools

The output oracle imports [specutils 2.4.0](https://specutils.readthedocs.io/) and
[Photutils 3.0.0](https://photutils.readthedocs.io/), both under BSD-3-Clause. They are
installed in an optional test environment, not copied, modified, or bundled into the
CLI. Their upstream distributions retain the copyright and license notices. The
pinned optional versions are in `oracle-requirements.txt`; the reports record the
versions used. These comparisons do not imply endorsement by either project.
