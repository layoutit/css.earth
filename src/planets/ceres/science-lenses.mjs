// Preparation-owned elevation display and legend.
export const SCIENCE_LENSES = [
  {
    id: "elevation", label: "Elevation", format: "geotiff",
    path: "science/ceres-hamo-dtm.tif",
    description: "Dawn stereo model · shaded relief",
    title: "Color shows height above the source's 470 km reference sphere; brightness shows terrain relief under fixed northwest lighting. Polar caps beyond 60° latitude are withheld because the published model interpolates polar gaps without a validity mask. Gray grid marks withheld or missing data.",
    sourceUrl: "https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m",
    minimum: -30000, maximum: 20000,
    colors: ["#253494", "#2c7fb8", "#41b6c4", "#ffffcc", "#d95f0e"],
    labels: ["−30", "−5", "20"], units: "km",
  },
];
