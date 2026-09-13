Description of the GASKELL PHOEBE SHAPE MODEL bundle V1.0
=========================================================

Bundle Generation Date: 2020-02-28
Peer Review: 2013 Asteroid Review, Fri Jun 14 00:00:00 MST 2013               
Discipline node: Small Bodies Node


Content description based on the data set catalog file description for the PDS3 version, CO-SA-ISSNA-5-PHOEBESHAPE-V2.0
=======================================================================================================================

Note: for PDS3 data sets migrated to PDS4, the following text is taken
verbatim from the data set description and confidence level note of the
PDS3 data set catalog file. In these cases, some details may not be correct
as a description of the PDS4 bundle.
                                                           
    This shape model of Phoebe is based on 208 Cassini Imaging Science        
    Subsystem narrow and wide angle camera (ISSNA and ISSWA) images. The shape
    model was prepared by Robert Gaskell on August 4, 2012.                   
                                                                              
    Coordinate system:                                                        
                                                                              
    BODY609_POLE_RA   = (  356.90      0.         0.  )                       
    BODY609_POLE_DEC  = (  +77.88      0.         0.  )                       
    BODY609_PM        = (  178.58   +931.639  0.  )                           
                                                                              
    (For help in interpreting the values of the SPICE assignments above, see  
    the document 'PCK Required Reading' (PCK.REQ), available at NAIF and in   
    the document directory of this data set.)                                 
                                                                              
    The parameters of the model are as follows:                               
                                                                              
    Number of landmarks:  522                                                 
    RMS position uncertainty:  147 m/dof (degree of freedom)                  
    Pointing uncertainty:  .045 mrad                                          
    Pointing residual:  .275 mrad                                             
    Number of observations:  22555                                            
    Observations per landmark:  43.2                                          
    RMS landmark location residual:  184 m/dof                                
                                                                              
    The models were originally prepared in the Implicitly Connected           
    Quadrilateral (ICQ) format.  Vertex-facet format versions, derived from   
    the ICQ versions, are also provided.  The filenames are                   
    phoebe_quad512q.tab and phoebe_ver512q.tab, where 512 is the value        
    of Q (an indicator of the resolution).  See below for the full            
    definition of Q and the ICQ format.  For additional information about the 
    shape models, see Gaskell et al. (2008).                                  
                                                                              
    The file 'phoebeimagelist.tab' is a list of the Cassini ISSNA and ISSWA   
    images used to generate this model.  These images are archived in PDS     
    under the data set ID CO-S-ISSNA/ISSWA-2-EDR-V1.0.                        
                                                                              
    A text file, 'icqmodel.asc' is provided in the 'document' directory       
    which describes the ICQ format and the derivation of the                  
    vertex-facet versions.                                                    
                                                                              
    Modification History                                                      
    ====================                                                      
                                                                              
    Version 1.0 of this model was archived in 2011.  For V1.0, all images were
    converted to 8-bit before processing.  For V2.0, the processing code had  
    been updated to handle 16-bit, so the 12-bit Cassini images were left     
    as-is for the processing.  Version 2.0 was archived in 2013.              
                                                                              
    References                                                                
    ==========                                                                
                                                                              
    Gaskell, R.W., O.S. Barnouin-Jha, D.J. Scheeres, A.S. Konopliv, T. Mukai, 
    S. Abe, J. Saito, M. Ishiguro, T. Kubota, T. Hashimoto, J. Kawaguchi, M.  
    Yoshikawa, K. Shirakawa, T. Kominato, N. Hirata, and H. Demura,           
    Characterizing and navigating small bodies with imaging data, Meteoritics 
    and Planetary Science, vol. 43, Issue 6, p. 1049-1061, 2008.


Known issues or problems with the data
======================================

    Note that the vertex-facet versions of the model have some duplicate      
    vertices on the edges and corners of the cube.  The duplicate vertices are
    not used in the facet table, resulting in the presence of some vertices in
    the vertex table which do not appear in the facet table.  This does not   
    affect the correctness of the vertex-facet version.

PDS3 Source
===========

Version 1.0 of this bundle was migrated from version 2.0 of the PDS3 data set CO-SA-ISSNA-5-PHOEBESHAPE-V2.0.
