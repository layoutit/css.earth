import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/laurentia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'laurentia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/laurentia/laurentia-shape-surface@2x.webp",
    "/scenes/laurentia/laurentia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/laurentia/laurentia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
