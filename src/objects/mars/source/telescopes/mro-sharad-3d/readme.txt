Mars Reconnaissance Orbiter SHARAD 3D Radargram Bundle

Citation:
Putzig, N., F. Foss, M. Perry, G. Morgan, and P. Sava (2025). Mars Reconnaissance Orbiter SHARAD 3D Radargram Bundle. PDS Geosciences (GEO) Node. https://doi.org/10.17189/a5av-yc11.

1. Introduction

This bundle contains 3D radargrams produced from data acquired by the Mars Reconnaissance Orbiter (MRO) Shallow Radar (SHARAD) instrument, which uses a 15-25 MHz radio signal to probe up to several 
kilometers through low-loss materials like the polar layered deposits, and up to a few hundred meters in typical geologic materials. Reflections occur where there are significant changes in the 
dielectric permittivity among layered deposits, occurring over lateral scales of at least a few kilometers. 3D radargrams are produced using a consistent set of synthetic-aperture radar processing 
parameters described in the accompanying User's Guides (document/3D_processing_v1.0.pdf and document/3D_processing_v2.0.pdf).

The bundle contains the following collections:

- One data collection located in the data directory.
- One browse collection located in the browse directory.
- Two document collections located in the catalog and document directories. The PDS3 catalog files are located in the catalog directory and the processing documents and release notes are located in 
  the document directory.
- One miscellaneous collection for the PDS3 index files located in the index directory.
  
In the DATA collection, each 3D radargram consists of an amalgamation of data collected over many SHARAD tracks crossing a given projected area. Each 3D radargram contains values of the radar 
backscatter power, strength, or amplitude arranged in an ARRAY with either time delay or depth on the fastest varying (Z) axis, the projection X coordinate on the slowest varying axis, and the 
projection Y coordinate on the intermediately varying axis. The label file for each 3D radargram contains information about the axes sampling intervals, projections, and data scaling. 

In the BROWSE collection, there are a series of JPEG-format images excerpted from each 3D radargram, showing 2D radargrams for every 100th sample in the X and Y directions and a radar time-delay or 
depth slice (map view with values at all X and Y locations) for every 25th sample in the Z (time delay or depth) dimension.  The name of each browse image contains the corresponding X, Y, or Z index 
value. Each JPEG image has an accompanying label file.


2. PDS3-to-PDS4 Migration

The original PDS3 dataset, archived in October 2021, has been migrated to meet the PDS4 standard. The PDS4 labels and other PDS4 products are merged with the PDS3 volume such that all the PDS3 files 
and directories are preserved. Thus, users who want access to the PDS3 labels can continue to use them. All data and browse products have been given PDS4 labels. 

New data products added to the bundle in future releases will be accompanied by both PDS3 and PDS4 labels. Some PDS3 files remain but are not considered part of the PDS4 bundle. These files are 
indicated by an asterisk (*) in section 3 below. The files in the extras directory have not been given PDS4 labels since most of them are not PDS4-compliant.


3. Bundle Contents

* indicates not part of PDS4 bundle

  [root directory]                                                       
  |
  |-- bundle_sharad_3d.xml   PDS4 bundle XML label                                                                        
  |-- readme.txt             PDS4 readme file, the file you are reading                                          
  |-- aareadme.txt*          PDS3 readme file                                                                         
  |-- voldesc.cat*           Description of the contents of this volume for the PDS3 catalog 
  |-- errata.txt*            Comments and errata concerning this volume (superseded by release_notes.txt in document collection)
  |                                                                          
  |--[BROWSE]                              Collection containing the browse images 
  |  |
  |  |-- collection_browse_inventory.csv   Browse collection inventory
  |  |-- collection_browse.xml             Browse collection XML label
  |  |-- [PLANUM_AUSTRALE_3D_V1_TIME], 
  |  |   [PLANUM_BOREUM_3D_V1_TIME],
  |  |   [PLANUM_BOREUM_3D_V2_TIME],
  |  |   [EAST_DEUTERONILUS_MENSAE_3D_V2_TIME]
  |  |    |
  |  |    |--[X], [Y], [Z]
  |  |       |-- *_diiii.JPG               8-bit JPEG images where d = X, Y, or Z and iiii = index
  |  |       |-- *_diiii.LBL/XML           PDS detached labels for JPEG images
  |  |-- browinfo.txt*                     Description of files in the browse subdirectory (superseded by browse_collection_description.txt in document collection)         
  |   
  |--[CATALOG]                                                  Collection containing PDS3 catalog objects           
  |  |                                                                        
  |  |-- collection_document_catalog_inventory.csv               Document_catalog collection inventory
  |  |-- collection_document_catalog.xml                         Document_catalog collection XML label
  |  |-- 3d_ds.cat                                               Description of this dataset                       
  |  |-- 3d_ds.xml                                               Detached PDS4 XML label for 3d_ds.cat          
  |  |-- mission.cat                                             Description of the MRO mission           
  |  |-- mission.xml                                             Detached PDS4 XML label for mission.cat              
  |  |-- insthost.cat                                            Description of the MRO spacecraft           
  |  |-- insthost.xml                                            Detached PDS4 XML label for insthost.cat               
  |  |-- sharadinst.cat                                          Description of the SHARAD instrument               
  |  |-- sharadinst.xml                                          Detached PDS4 XML label for sharadinst.cat                       
  |  |-- ref.cat                                                 List of publications mentioned in catalog files
  |  |-- ref.xml                                                 Detached PDS4 XML label for ref.cat   
  |  |-- dsmap_polar.cat*                                        Description of polar stereographic map projection for applicable PDS3 labels
  |  |-- person.cat*                                             Description of primary personnel who created this volume
  |  |-- catinfo.txt*                                            Description of files in the catalog subdirectory          
  |  |                                                                           
  |--[DATA]                                                      Collection containing 3D data products
  |  | 
  |  |-- collection_data_inventory.csv                           Data collection inventory
  |  |-- collection_data.xml                                     Data collection XML label
  |  |-- *.dat                                                   Data files containing binary 32-bit floating-point 3D arrays
  |  |-- *.xml                                                   PDS4 labels describing the data files
  |  |-- *.lbl                                                   PDS3 labels describing the data files
  |   
  |--[DOCUMENT]                                                  Collection containing relevant documents           
  |  |                                                                        
  |  |-- collection_document_inventory.csv                       Document collection inventory                   
  |  |-- collection_document.xml                                 Document collection xml label                   
  |  |-- 3d_processing_v1.0.pdf                                  Processing description and user's guide         
  |  |-- 3d_processing_v1.0.xml                                  PDS4 label for 3d_processing_v1.0.pdf           
  |  |-- 3d_processing_v1.0.lbl*                                 PDS3 label for 3d_processing_v1.0.pdf           
  |  |-- 3d_processing_v2.0.pdf                                  Processing description and user's guide updated for version 2 products        
  |  |-- 3d_processing_v2.0.xml                                  PDS4 label for 3d_processing_v2.0.pdf           
  |  |-- 3d_processing_v2.0.lbl*                                 PDS3 label for 3d_processing_v2.0.pdf           
  |  |-- foss_2021.pdf                                           Processing document for East Deuteronilus Mensae data
  |  |-- foss_2021.xml                                           PDS4 label for foss_2021.pdf              
  |  |-- foss_2021.lbl*                                          PDS3 label for foss_2021.pdf              
  |  |-- foss_et_al_2016.pdf                                     Processing document for north pole data         
  |  |-- foss_et_al_2016.xml                                     PDS4 label for foss_et_al_2016.pdf              
  |  |-- foss_et_al_2016.lbl*                                    PDS3 label for foss_et_al_2016.pdf              
  |  |-- foss_et_al_2018.pdf                                     Processing document for south pole data         
  |  |-- foss_et_al_2018.xml                                     PDS4 label for foss_et_al_2018.pdf              
  |  |-- foss_et_al_2018.lbl*                                    PDS3 label for foss_et_al_2018.pdf              
  |  |-- browse_collection_description.txt                       Description of browse collection extracted from the PDS3 browinfo.txt
  |  |-- browse_collection_description.xml                       PDS4 label for browse_collection_description.txt
  |  |-- release_notes.txt                                       Bundle release notes and errata                 
  |  |-- release_notes.xml                                       PDS4 label for release_notes.txt                
  |  |-- docinfo.txt*                                            Description of files in document subdirectory      
  |
  |--[INDEX]                                                     Collection containing index files                   
  |   |                                                                        
  |   |-- collection_miscellaneous_inventory.csv                 Miscellaneous_index collection inventory                   
  |   |-- collection_miscellaneous.xml                           Miscellaneous_index collection xml label                   
  |   |-- browindex.tab                                          Index to all browse data products in this data set         
  |   |-- browindex.xml                                          PDS4 label for browindex.tab                               
  |   |-- browindex.lbl*                                         PDS3 label for browindex.tab                               
  |   |-- east_deuteronilus_mensae_3d_v2_observations.tab        List of source products for east_deuteronilus_mensae_3d_v2_time.dat   
  |   |-- east_deuteronilus_mensae_3d_v2_observations.xml        PDS4 label for east_deuteronilus_mensae_3d_v2_observations.tab
  |   |-- east_deuteronilus_mensae_3d_v2_observations.lbl*       PDS3 label for east_deuteronilus_mensae_3d_v2_observations.tab
  |   |-- index.tab                                              Index to all data products in this data set                
  |   |-- index.xml                                              PDS4 label for index.tab                                   
  |   |-- index.lbl*                                             PDS3 label for index.tab                                    
  |   |-- planum_australe_3d_v1_observations.tab                 List of source products for planum_australe_3d_v1_time.dat 
  |   |-- planum_australe_3d_v1_observations.xml                 PDS4 label for planum_australe_3d_v1_observations.tab      
  |   |-- planum_australe_3d_v1_observations.lbl*                PDS3 label for planum_australe_3d_v1_observations.tab      
  |   |-- planum_boreum_3d_v1_observations.tab                   List of source products for planum_boreum_3d_v1_time.dat   
  |   |-- planum_boreum_3d_v1_observations.xml                   PDS4 label for planum_boreum_3d_v1_observations.tab        
  |   |-- planum_boreum_3d_v1_observations.lbl*                  PDS3 label for planum_boreum_3d_v1_observations.tab        
  |   |-- planum_boreum_3d_v2_observations.tab                   List of source products for planum_boreum_3d_v2_time.dat   
  |   |-- planum_boreum_3d_v2_observations.xml                   PDS4 label for planum_boreum_3d_v2_observations.tab        
  |   |-- planum_boreum_3d_v2_observations.lbl*                  PDS3 label for planum_boreum_3d_v2_observations.tab        
  |   |-- indxinfo.txt*                                          Description of files in this subdirectory                  
  |
  |--[EXTRAS]*               Directory containing supplemental material
  |  |
  |  |-- [ANIMATIONS]*       Directory containing MP4 movies of 3D radargrams
  |  |-- [SEG-Y]*            Directory containing versions of the data products in SEG-Y format
  |  |-- [SOFTWARE]*         Directory containing software demonstrating how to read the data products
  |  |-- [SURFACE]*          Directory containing SHARAD and MOLA composite surface maps
  |  |-- extrinfo.txt*       Description of files in extras subdirectory      


4.  File Formats

This section describes file formats for the kinds of files contained on the archive bundle.

*.XML Files 
Each PDS4 product in this bundle is described by a PDS4 label in a separate file with the same name as the file described by the label but with the extension .xml. PDS4 labels are XML 
(eXtended Markup Language) files that conform to the PDS4 Information Model XML schema at https://pds.nasa.gov/pds4/schema/released/. The PDS4 labels are best viewed in an XML-aware text editor and 
may be used by software that can manipulate XML documents.

*.LBL Files
Files with the .LBL extension are PDS3 labels. Every data and browse file is described by a PDS3 label in a separate file with the same base name but the extension .lbl. PDS3 labels are ASCII text 
files intended to be read by humans and by software. A PDS3 label consists of a series of statements in the form "keyword = value", where keywords are defined in the PDS3 Data Dictionary. PDS3 label
files have lines delimited with a carriage return character (ASCII 13) and a line feed character (ASCII 10).
 
*.TXT Files
Files with the .txt extension are ASCII text files which may have embedded PDS3 labels. Each line in a .txt file ends with a carriage return character (ASCII 13) and a line feed character (ASCII 10).
 
*.PDF Files
Files with the .pdf extension are in Portable Document Format/A. PDF/A is an ISO-standardized format of PDF (Portable Document Format) suitable for long-term archiving.

*.DAT Files
Files with the .dat extension are tables of binary data. For each SHARAD 3D radargram, there is a single data product (*.dat) that contains a 3-axis array of 32-bit floating-point binary values, 
constituting a 3D volume of returned radar power, strength, or amplitude. A description of the data sampling, scaling, and map projection is provided in the accompanying PDS4 and PDS3 label files 
(*.xml, *.lbl). The labels also describe the contents of each column in the binary table, including data type, number of bytes, and offset from the beginning of the row. For more information about 
the format and content of the data product, see 3d_ds.cat, which can be found in the CATALOG directory.

*.JPG Files
Files with the .jpg extension are JPEG browse images, found in the BROWSE directory. Browse images are intended to provide quick-look access into the data. For each axis of the 3D array, there is a 
collection of 8-bit JPEG browse images (*.JPG) at a fixed interval (e.g., every 100 or 25 samples) in each of the X, Y, and Z (DELAY_TIME or DEPTH) dimensions. Each browse image includes all samples 
in the opposing dimensions, with the column and row sampling given by the corresponding AXIS_INTERVAL values reported in the label file (*.xml, *.lbl) in the DATA directory.

As noted in the corresponding label files for each browse image, the same subset of the full range of backscatter powers, strengths, or amplitudes in the entire 3D radagram is scaled to the JPEG 
image DN values 0-255. Those full-range values are reported in the PDS4 and PDS3 labels in the <description> tag and DESCRIPTION keyword, respectively.

*.TAB Files
Files with the .tab extension are tables of ASCII text in which all rows are the same length and all columns in the table are aligned. They are found in the INDEX directory of this archive. The file 
index.tab contains a row with the file name and creation time for each data product in the archive. Similarly, the file browindex.tab contains a row for each browse product in the archive. Rows are 
terminated with ASCII carriage return and line feed characters. Character fields are enclosed in double quotation marks ("). (Character fields are padded with spaces to keep quotation marks in the 
same columns of successive records.) Character fields are left justified, and numeric fields are right justified. 

The index tables are accompanied by PDS labels that describe the columns in the table, including the data type, number of characters, and offset from the beginning of the row. 

*.CAT Files
Files with the .cat extension are ASCII text files used to enter information into the PDS3 Online Catalog to enable searches for this data set. The file 3d_ds.cat describes the data set. The files 
mission.cat, insthost.cat, and sharadinst.cat describe the MRO mission, MRO spacecraft, and SHARAD instrument, respectively. Ref.cat is a list of relevant references, and person.cat contains contact 
information about the archive producers. The file dsmap_polar.cat contains the general equations for the polar stereographic map projection used for the data files. This file is referenced in the
part of the PDS3 label that describes the map projection.

*.MP4 Files
Files with the .mp4 extension are MPEG-4 animations illustrating movement through the SHARAD 3D radagrams in various ways. They are found in the EXTRAS/ANIMATIONS directory.

*.PNG Files
Files with the .png extension are images in Portable Network Graphics format, an industry standard for image compression. These files may be opened with many freely available image viewers and web 
browsers; see http://www.libpng.org/pub/png/. They are found in the EXTRAS/SURFACE directory.

*.SGY and *.KWD Files
Files with the .sgy extension are SEG-Y binary data files. Files with the .kwd extension are ASCII text files containing information describing the SEG-Y data for use with SeisWare software. These 
are found in the EXTRAS/SEG-Y directory. See the file segy_info.txt in that directory for more information.

.PRO and .PY Files
Files with these extensions contain source code in IDL and Python respectively. These are found in the EXTRAS/SOFTWARE directory. See the file software_info.txt in that directory for more information.


This bundle was created and archived by the Geosciences Node of the Planetary Data System. Questions about this bundle may be directed to geosci@wunder.wustl.edu.
