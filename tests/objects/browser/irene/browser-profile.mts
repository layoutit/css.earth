import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/irene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'irene',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/irene/irene-shape-surface@2x.webp",
    "/scenes/irene/irene-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/irene/irene-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
