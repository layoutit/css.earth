import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/anahita/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'anahita',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/anahita/anahita-shape-surface@2x.webp",
    "/scenes/anahita/anahita-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/anahita/anahita-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
