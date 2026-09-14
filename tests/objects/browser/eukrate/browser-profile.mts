import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eukrate/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eukrate',controls,audit:{
  "preparedAssetPairs": [],
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
