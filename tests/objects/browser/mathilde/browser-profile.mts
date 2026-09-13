import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/mathilde/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mathilde',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/mathilde/mathilde-normal-surface@2x.webp",
    "/scenes/mathilde/mathilde-directional-sun@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "elevation",
    "winnerId": "normal",
    "slowAsset": "/scenes/mathilde/mathilde-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
