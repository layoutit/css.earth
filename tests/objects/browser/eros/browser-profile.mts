import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
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
    "slowId": "infrared",
    "winnerId": "normal",
    "slowAsset": "/scenes/eros/eros-infrared-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "infrared",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
