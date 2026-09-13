import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/astraea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'astraea',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/astraea/astraea-shape-surface@2x.webp",
    "/scenes/astraea/astraea-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/astraea/astraea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
