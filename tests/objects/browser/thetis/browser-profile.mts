import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/thetis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thetis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/thetis/thetis-directional-sun.webp",
      "two": "/scenes/thetis/thetis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/thetis/thetis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/thetis/thetis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
