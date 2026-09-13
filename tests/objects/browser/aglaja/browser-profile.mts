import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/aglaja/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aglaja',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/aglaja/aglaja-shape-surface@2x.webp",
    "/scenes/aglaja/aglaja-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/aglaja/aglaja-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
