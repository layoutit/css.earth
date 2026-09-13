import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/oenone/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'oenone',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/oenone/oenone-shape-surface@2x.webp",
    "/scenes/oenone/oenone-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/oenone/oenone-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
