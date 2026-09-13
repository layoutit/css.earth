import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/davida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'davida',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/davida/davida-shape-surface@2x.webp",
    "/scenes/davida/davida-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/davida/davida-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
