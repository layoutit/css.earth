import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/ryugu/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ryugu',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ryugu/ryugu-directional-sun.webp",
      "two": "/scenes/ryugu/ryugu-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ryugu/ryugu-normal-surface@2x.webp"
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
