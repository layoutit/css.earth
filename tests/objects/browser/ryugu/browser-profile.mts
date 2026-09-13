import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ryugu/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ryugu',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/ryugu/ryugu-normal-surface@2x.webp",
    "/scenes/ryugu/ryugu-directional-sun@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "elevation",
    "winnerId": "normal",
    "slowAsset": "/scenes/ryugu/ryugu-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "enhanced",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
