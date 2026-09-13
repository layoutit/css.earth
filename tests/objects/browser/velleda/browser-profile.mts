import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/velleda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'velleda',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/velleda/velleda-shape-surface@2x.webp",
    "/scenes/velleda/velleda-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/velleda/velleda-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
