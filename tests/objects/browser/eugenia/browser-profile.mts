import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/eugenia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eugenia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/eugenia/eugenia-shape-surface@2x.webp",
    "/scenes/eugenia/eugenia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/eugenia/eugenia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
