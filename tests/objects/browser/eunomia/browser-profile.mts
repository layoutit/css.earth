import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eunomia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eunomia',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/eunomia/eunomia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eunomia/eunomia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
