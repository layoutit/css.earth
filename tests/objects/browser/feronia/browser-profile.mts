import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/feronia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'feronia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/feronia/feronia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/feronia/feronia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
