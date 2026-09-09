  DESCRIPTION OF THE DIGITAL DATABASE FOR
  GEOLOGIC MAP OF GANYMEDE

  USGS SCIENTIFIC INVESTIGATIONS MAP 3237


  INTRODUCTION

  This digital database for the Geologic Map of Ganymede (USGS
  SIM 3237) includes several GIS features that collectively
  present the entire content of the geologic map, along
  with supporting files and metadata. Data is in ArcGIS
  geodatabase format, including attribute domains, and is
  collated within a single feature dataset that preserves
  the relevant geographic information. Together with the
  geologic pamphlet, the GIS database provides
  georeferenced information on the geologic units,
  structure, and morphology of Ganymede. 

  All vector GIS data are in geographic coordinate system
  (GCS_Ganymede_2000, radius of 2632345m) using decimal degrees
  for the horizontal units. Images are in a meter Cartesian
  plane using the various map projections as listed below.


  GEOLOGIC CONTENT

  This database contains one ArcGIS feature dataset with
  the following geologic content:

  GeologicContacts -- Final geologic contact polyline feature
                    class. Contains a "TYPE" field denoting
                    the type of geologic contact.

  GeologyUnits -- Final geologic unit polygon feature class.
                 Contains a "AreaKm2" field containing the
                 area of each polygon, as calculated using
                 the spheroid. Contains a "UnitName" field
                 denoting the unit name. Contains a "Unit"
                 field denoting the unit symbol.

  GroovesRepresentative -- Known representative grooves as 
                           points

  Furrows -- Known furrows as polylines

  CraterRims -- Dititized crater rims as polylines

  SecondaryCraters -- Known secondary craters as a point file 

  Domes -- Known domes as a point file.

  Depressions -- Known depressions as a point file.

  Geologic production: In summary, to produce the new map,
  the relative age relationships of mapped units were determined
  based on crosscutting relationships and differences in crater
  density. For full explaination see Ganymede SIM3227 map text.

  BASE MAP CONTENT

  This map is based on a global image mosaic of Voyager and 
  Galileo data assembled by the USGS at a nominal resolution 
  of 1 km/pixel (Becker and others, 2001).  Voyager 1 partially 
  imaged the subjovian hemisphere of Ganymede, while Voyager 2 
  partially imaged the antijovian hemisphere.  Galileo imaging 
  filled in most of the “gaps” in moderate resolution coverage 
  of the leading and trailing hemispheres. For more see: 
  * Becker, T., et al., 2001. Final Digital Global Maps 
  of Ganymede, Europa, and Callisto, In Lunar and Planetary Science 
  XXXII, Abstract #2009, Lunar and Planetary Institute, Houston (CD-ROM).
  URL: http://www.lpi.usra.edu/meetings/lpsc2001/pdf/2009.pdf 
  
  DIGITAL DATABASE AND METADATA PACKAGE
  (Ganymede_SIM3237_Database.zip)

  The geologic map files, basemap, and supportive files are
  included in the database package, as described below:

  File                       Description
  ---------------------------------------------------------
  sim3237_readme.txt         This readme file.

  sim3237_Ganymede_metadata.txt Text-format FGDC-style 
                             metadata for the database
                             package

  Sim3237_Ganymede_metadata.xml  XML-format FGDC-style
                             metadata for the database
                             package

  Ganymede_Geology_SIM3237_ArcMap10.mxd  ArcGIS version 10
                                     project for the
                                     database package

  Ganymede_Geology_SIM3237_ArcMap10.2.pmf  ArcReader (free
                                     viewer) project for
                                     the database package

  Directories
  --------------------------------------------

  Ganymede_Geology_SIM3237.gdb     ArcGIS geodatabase containing
                             all digital geologic map
                             information

  Ganymede_Geology_SIM3237_Shapefiles directory ESRI shapefile
                                             format for the
                                             geologic files
                                             above

  layerSymbology directory    ArcGIS layer files containing
                              symbol look-up tables for
                              ArcMap


  Raster_Basemap directory  Please see SIM 3237 text for 
  description of base map used in mapping. Image was saved
  in a GeoTiff format using a Simple Cylindrical projection
  image filename:  Gamymede_glo_G29.tif (combined mosaic)

  --------------------------------------------

  Users of the database package may wish to download the
  SIM 3237 pamphlet for the contained Description of Map
  Units.

  The material described above is available on the World
  Wide Web at http:/pubs.usgs.gov/sim/3237/

  ZIP FILES

  The files described above are packaged within a ZIP file.
  Utilities to uncompress ZIP files are available for most
  operating systems and may be found readily with a simple
  web search.

  DIGITAL DATABASE FORMAT

  The digital information compiled in this report used
  ArcGIS v 10, a commercial Geographic Information System
  produced by Environmental Systems Research Institute
  (Esri), Redlands, California. Data layers are also made
  available in Esri shapefile format which is usable in
  nearly all GIS applications.

  OBTAINING HARD-COPY OF SIM-3237

  USGS Information Services
  Box 25286
  Denver Federal Center
  Denver, CO  80225-0046

  (303) 202-4200
  1-888-ASK-USGS
  Email: infoservices@usgs.gov