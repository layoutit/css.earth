Maps made on 6/12/2019 by H. Kaplan

The map FITS files include the following columns: facet number, latitude, longitude, radius, value and sigma.

------------------------------------
Data: OVIRS level 3c (I/F) for equatorial station 3 (12:30pm) with fill factor = 1. Mapped values and uncertainties are calculated with spindex or analogous methods as described in detail by SAWG presentations at STM15. A brief description of the mapped values are as follows:

BandArea3200to3600nm = absorption area between 3200 and 3600 nm (3.2 and 3.6 microns) diagnostic of carbonates and/or organics, calculated on un-ratioed spectra (value calculated outside of SPOC pipeline using a modified, stand-alone version of spindex). 

OH2700nm = hydration feature band depth at 2740 nm (2.74 microns) with continuum points at 2.6 and 3 microns calculated on un-ratioed spectra using the values from a modified, stand-alone version spindex.

Pyroxene920nm = band depth at 920 nm (0.92 microns) with continuum points at 0.807 and 0.984 microns calculated on spectra ratioed to a global average spectrum and using a stand-alone version of spindex.

Refl550nm = the reflectance (I/F) at 550 nm (0.55 microns) calculated on un-ratioed, pipeline values from spindex.

Slope1polyfit = polynomial (1st order) fit to the spectrum between 0.5 and 1.5 microns calculated on spectra ratioed to a global average spectrum using a stand-alone version of spindex. 

Slope2polyfit = polynomial (1st order) fit to the spectrum between 1.0 and 2.2 microns calculated on spectra ratioed to a global average spectrum using a stand-alone version of spindex. 

------------------------------------
Maps: made with 200k Palmer v20 shape model (g_03170mm_spc_obj_0000n00000_v020.obj) in MakeMaps. Data are  combined on facets with weighted average. Getspots file was made 5/29/2019 with metakernel from 5/14/2019.

------------------------------------
Limitations and caveats: some small artifacts (e.g., segment jumps) remain in the OVIRS spectral data and can make their way into the maps. Every effort has been made to filter out bad values including values with abnormally high uncertainty. The suggested color stretch for these maps is mean +/- 2 standard deviations, except for the pyroxene map (g_3170mm_SP_OVIRS_Pyroxene920nm_EQ3_wavc_20190607_hk) which should be should be stretched from 0.001 to 0.0025.



