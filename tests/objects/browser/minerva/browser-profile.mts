import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/minerva/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'minerva',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/minerva/minerva-shape-surface@2x.webp",
    "/scenes/minerva/minerva-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/minerva/minerva-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
