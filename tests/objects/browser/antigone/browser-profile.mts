import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/antigone/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'antigone',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/antigone/antigone-shape-surface@2x.webp",
    "/scenes/antigone/antigone-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/antigone/antigone-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
