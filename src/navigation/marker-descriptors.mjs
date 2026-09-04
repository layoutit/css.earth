const STANDARD_DISC_OPERATIONS = Object.freeze([
  Object.freeze({ type: "rotate" }),
  Object.freeze({ type: "trim", threshold: 10 }),
  Object.freeze({
    type: "resize",
    width: "tile",
    height: "tile",
    fit: "cover",
    position: "centre",
    kernel: "lanczos3",
  }),
  Object.freeze({ type: "png" }),
]);

export const PLANNED_MARKER_DESCRIPTORS = Object.freeze([
  marker("mercury", "mercury.jpg", 876817,
    "5ea3d3b713fce74f6b45faa182023210ada11ae62b8b51183a5fc134e7ce1304",
    "https://science.nasa.gov/wp-content/uploads/2023/11/mercury-messenger-globe-pia15162.jpg",
    "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington"),
  marker("venus", "venus.webp", 210095,
    "59ff56b81de18402302f1e397384bd1d7fecff906d04ef229a64462fe516f42a",
    "https://science.nasa.gov/wp-content/uploads/2023/05/688-venus-1200-jpg.webp",
    "NASA/JPL-Caltech"),
  marker("earth", "earth.jpg", 183367,
    "48ccd32ef57d182662999905841109095d66d68d69e27dba7decc6e134a811a0",
    "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001016/GSFC_20171208_Archive_e001016~large.jpg",
    "NASA"),
  marker("uranus", "uranus.jpg", 83489,
    "3dcc83114f1a25caa1ae1a1436830fffaa15a3e429666dbf4c68bcf035e8932b",
    "https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg",
    "NASA/JPL-Caltech"),
  marker("neptune", "neptune.jpg", 179592,
    "3cf960937217cb53d52f67d0c30d53c694cfbafc2ac8ca137c6539eb12a2a312",
    "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/0/PIA01492-1.jpg/jcr:content/renditions/cq5dam.web.1280.1280.jpeg",
    "NASA/JPL"),
]);

export const NAVIGATION_SUN_SOURCE = Object.freeze({
  path: "sun-hmi.jpg",
  expectedBytes: 39336,
  expectedSha256: "58c23164c4bae8352a88c7473345bc43067000ecc8a956a3328b64adb0e83c43",
  origin: "https://science.nasa.gov/wp-content/uploads/2024/07/bigsunspot-hmiintensity-00200-print.jpg?w=768",
  credit: "NASA Solar Dynamics Observatory/HMI",
  license: "NASA media usage guidelines",
});

export const NAVIGATION_BLACKHOLE_SOURCE = Object.freeze({
  path: "black-hole-accretion-disk-nasa.jpg",
  expectedBytes: 73718,
  expectedSha256: "40719fba8771e81aefd47f678d9b13b85161201a1674cf3ed65d67c64dcc348c",
  origin: "https://svs.gsfc.nasa.gov/vis/a010000/a013300/a013326/Black_Hole_Accretion_Disk_Sim_4k_ProRes.00386_print.jpg",
  credit: "NASA's Goddard Space Flight Center/Jeremy Schnittman",
  license: "NASA media usage guidelines",
});

export const NAVIGATION_SUPERNOVA_SOURCE = Object.freeze({
  path: "cassiopeia-a-miri.png",
  expectedBytes: 886860,
  expectedSha256: "7869aca68bc8b10df9766e9456a86fe393067170beb016580fbbdc2c90b5c4dd",
  origin: "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2023/04/STScI-01GWQC2N0MCSM6PX1Z6A8FBYQM.png?crop=faces%2Cfocalpoint&fit=clip&h=800&w=800",
  credit: "NASA, ESA, CSA, D. Milisavljevic, T. Temim, I. De Looze; processing: J. DePasquale (STScI)",
  license: "NASA media usage guidelines and credited partner rights",
});

export const NAVIGATION_GITHUB_SOURCE = Object.freeze({
  path: "github-mark.svg",
  expectedBytes: 915,
  expectedSha256: "830f4ba059be5e05f5bef2128c43414d382c0e8019d346217816467918923600",
  origin: "https://github.com/logos",
  credit: "GitHub",
  license: "GitHub Logo Guidelines",
});

export const NAVIGATION_SETTINGS_SOURCE = Object.freeze({
  path: "settings-mark.svg",
  expectedBytes: 867,
  expectedSha256: "f9ddf6a53e01e9b1ded38c2de9f7b7c72de63ad119abf6f10ab660fb9a823c16",
  origin: "Project-authored navigation control",
  credit: "cssEarth",
  license: "MIT",
});

export const NAVIGATION_DOWNLOAD_SOURCE = Object.freeze({
  path: "download-mark.svg",
  expectedBytes: 204,
  expectedSha256: "144b65f8b2190997429d53feb5f897bd231d2e6735a19fb815bf4476ab02dfd6",
  origin: "Project-authored navigation control",
  credit: "cssEarth",
  license: "MIT",
});

export const NAVIGATION_SHARE_SOURCE = Object.freeze({
  path: "share-mark.svg",
  expectedBytes: 289,
  expectedSha256: "639006c3b9579f2b70a02df7ce3fe12b29b54bd98a1ecab8400ff9a87a7a767c",
  origin: "Project-authored navigation control",
  credit: "cssEarth",
  license: "MIT",
});

function marker(planetId, path, expectedBytes, expectedSha256, origin, credit) {
  return Object.freeze({
    schema: "cssearth-navigation-marker@1",
    planetId,
    owner: "navigation",
    source: Object.freeze({
      path,
      expectedBytes,
      expectedSha256,
      origin,
      credit,
      license: "NASA media usage guidelines and credited partner rights",
    }),
    operations: STANDARD_DISC_OPERATIONS,
  });
}
