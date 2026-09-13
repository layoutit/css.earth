import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eukrate/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eukrate',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eukrate/eukrate-directional-sun.webp",
      "two": "/scenes/eukrate/eukrate-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eukrate/eukrate-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/eukrate/eukrate-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
