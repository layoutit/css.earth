import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/alkmene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'alkmene',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/alkmene/alkmene-shape-surface@2x.webp",
    "/scenes/alkmene/alkmene-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/alkmene/alkmene-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
