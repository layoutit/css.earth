import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/dimorphos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dimorphos',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/dimorphos/dimorphos-shape-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "shape",
    "slowId": "albedo",
    "winnerId": "shape",
    "slowAsset": "/scenes/dimorphos/dimorphos-albedo-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "shape",
      "draco",
      "elevation",
      "albedo",
      "slope"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
