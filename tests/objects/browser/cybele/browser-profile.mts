import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/cybele/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cybele',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/cybele/cybele-shape-surface@2x.webp",
    "/scenes/cybele/cybele-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/cybele/cybele-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
