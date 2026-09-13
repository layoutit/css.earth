Attributes {
    lon {
        String standard_name "longitude";
        String long_name "longitude";
        String units "degrees_east";
        String axis "X";
        String sdn_parameter_urn "SDN:P01::ALONZZ01";
        String sdn_parameter_name "Longitude east";
        String sdn_uom_urn "SDN:P06::DEGE";
        String sdn_uom_name "Degrees east";
    }
    lat {
        String standard_name "latitude";
        String long_name "latitude";
        String units "degrees_north";
        String axis "Y";
        String sdn_parameter_urn "SDN:P01::ALATZZ01";
        String sdn_parameter_name "Latitude north";
        String sdn_uom_urn "SDN:P06::DEGN";
        String sdn_uom_name "Degrees north";
    }
    crs {
        String grid_mapping_name "latitude_longitude";
        String epsg_code "EPSG:4326";
        Float64 inverse_flattening 298.257223563;
        Float64 semi_major_axis 6378137.0;
        DODS {
            Int32 strlen 0;
        }
    }
    elevation {
        String standard_name "height_above_mean_sea_level";
        String long_name "Elevation relative to sea level";
        String units "m";
        String grid_mapping "crs";
        String sdn_parameter_urn "SDN:P01::BATHHGHT";
        String sdn_parameter_name "Sea floor height (above mean sea level) {bathymetric height}";
        String sdn_uom_urn "SDN:P06::ULAA";
        String sdn_uom_name "Metres";
    }
    NC_GLOBAL {
        String title "The GEBCO_2026 Grid - a continuous terrain model for oceans and land at 15 arc-second intervals";
        String summary "The GEBCO_2026 Grid is a continuous, global terrain model for ocean and land with a spatial resolution of 15 arc seconds.The grid uses as a base-map Version 2.8 of the SRTM15+ data set (Tozer et al, 2019). This data set is a fusion of land topography with measured and estimated seafloor topography. It is augmented with gridded bathymetric data sets developed as part of the Nippon Foundation-GEBCO Seabed 2030 Project.";
        String keywords "BATHYMETRY/SEAFLOOR TOPOGRAPHY, DIGITAL ELEVATION/DIGITAL TERRAIN MODELS";
        String Conventions "CF-1.6, ACDD-1.3";
        String id "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa";
        String naming_authority "https://dx.doi.org";
        String history "Information on the development of the data set and the source data sets included in the grid can be found in the data set documentation available from https://www.gebco.net";
        String source "The GEBCO_2026 Grid is the 2026 release of the  global bathymetric product published by the General Bathymetric Chart of the Oceans (GEBCO) and has been developed through the Nippon Foundation-GEBCO Seabed 2030 Project. This is a collaborative project between the Nippon Foundation of Japan and GEBCO. The Seabed 2030 Project aims to bring together all available bathymetric data to produce the definitive map of the world ocean floor and make it available to all.";
        String comment "The data in the GEBCO_2026 Grid should not be used for navigation or any purpose relating to safety at sea.";
        String license "The GEBCO Grid is placed in the public domain and may be used free of charge. Use of the GEBCO Grid indicates that the user accepts the conditions of use and disclaimer information: https://www.gebco.net/";
        String date_created "2026-04-17";
        String creator_name "GEBCO through the Nippon Foundation-GEBCO Seabed 2030 Project";
        String creator_email "gdacc@seabed2030.org";
        String creator_url "https://www.gebco.net";
        String institution "On behalf of the General Bathymetric Chart of the Oceans (GEBCO), the data are held at the British Oceanographic Data Centre (BODC).";
        String project "Nippon Foundation - GEBCO Seabed2030 Project";
        String creator_type "International organisation";
        Float64 geospatial_bounds -180.0, -90.0, 180.0, 90.0;
        String geospatial_bounds_crs "WGS84";
        String geospatial_bounds_vertical_crs "EPSG:5831";
        Float64 geospatial_lat_min -90.0;
        Float64 geospatial_lat_max 90.0;
        String geospatial_lat_units "degrees_north";
        Float64 geospatial_lat_resolution 0.004166666666666667;
        Float64 geospatial_lon_min -180.0;
        Float64 geospatial_lon_max 180.0;
        String geospatial_lon_units "degrees_east";
        Float64 geospatial_lon_resolution 0.004166666666666667;
        Float64 geospatial_vertical_min -10930.0;
        Float64 geospatial_vertical_max 8627.0;
        String geospatial_vertical_units "meters";
        Float64 geospatial_vertical_resolution 1.0;
        String geospatial_vertical_positive "up";
        String identifier_product_doi "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa";
        String references "DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa";
        Float64 node_offset 1.0;
    }
}
