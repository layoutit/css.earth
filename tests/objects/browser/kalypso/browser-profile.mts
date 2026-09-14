import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/kalypso/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kalypso',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/kalypso/kalypso-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kalypso/kalypso-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
