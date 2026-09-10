This directory contains global nighttime temperature and rock abundance maps of the Moon derived using the Lunar Reconnaissance Orbiter (LRO) Diviner Lunar Radiometer Experiment. All maps are gridded at 128 pixels-per-degree (ppd) and span +/-180˚ longitude and +/-70˚ latitude. 

Each data product has both a GeoTIFF and JP2 version. For the JP2 files, conversion from the integer digital number (DN) to the derived value is given by the equation: VALUE = (DN * SCALING_FACTOR) + OFFSET. The GeoTIFF files are floating point and do not need conversion. The available data products are:

1) Channel 6-9 brightness temperature (e.g., TB6), bolometric temperature (TBOL), and regolith temperature (TREG). These are each calculated at midnight(M) and slope-adjusted midnight (SAM).
	SCALING_FACTOR = 0.01
	OFFSET = 100

2) Rock abundance, calculated at slope-adjusted midnight (RA_SAM_70Sto70N)
	SCALING_FACTOR = 0.001
	OFFSET = 0

3) Bolometric temperature and regolith temperature anomaly, calculated at slope adjusted midnight (TBOL_ANOM_70Sto70N and TREG_ANOM_70Sto70N)
	SCALING_FACTOR = 0.01
	OFFSET = 0