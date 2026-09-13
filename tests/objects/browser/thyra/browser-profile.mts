import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/thyra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thyra',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/thyra/thyra-shape-surface@2x.webp",
    "/scenes/thyra/thyra-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/thyra/thyra-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
