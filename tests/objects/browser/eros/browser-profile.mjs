import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/eros/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eros',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eros/eros-directional-sun.webp",
      "two": "/scenes/eros/eros-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eros/eros-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "elevation",
    "winnerId": "normal",
    "slowAsset": "/scenes/eros/eros-elevation-surface@2x.webp",
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
