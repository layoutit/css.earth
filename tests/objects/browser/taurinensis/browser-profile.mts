import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/taurinensis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'taurinensis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/taurinensis/taurinensis-directional-sun.webp",
      "two": "/scenes/taurinensis/taurinensis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/taurinensis/taurinensis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/taurinensis/taurinensis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
