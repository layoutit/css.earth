import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/sappho/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sappho',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/sappho/sappho-shape-surface@2x.webp",
    "/scenes/sappho/sappho-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/sappho/sappho-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
