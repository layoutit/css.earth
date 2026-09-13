import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/nausikaa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nausikaa',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/nausikaa/nausikaa-shape-surface@2x.webp",
    "/scenes/nausikaa/nausikaa-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/nausikaa/nausikaa-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
