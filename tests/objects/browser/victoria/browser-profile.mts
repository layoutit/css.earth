import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/victoria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'victoria',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/victoria/victoria-shape-surface@2x.webp",
    "/scenes/victoria/victoria-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/victoria/victoria-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
