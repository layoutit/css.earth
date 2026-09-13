import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/kalliope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kalliope',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/kalliope/kalliope-shape-surface@2x.webp",
    "/scenes/kalliope/kalliope-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/kalliope/kalliope-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
