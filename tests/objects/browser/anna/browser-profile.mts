import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/anna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'anna',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/anna/anna-directional-sun.webp",
      "two": "/scenes/anna/anna-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/anna/anna-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/anna/anna-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
