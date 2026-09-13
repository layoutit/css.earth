import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/herculina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'herculina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/herculina/herculina-directional-sun.webp",
      "two": "/scenes/herculina/herculina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/herculina/herculina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/herculina/herculina-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
