import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/bennu/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bennu',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bennu/bennu-directional-sun.webp",
      "two": "/scenes/bennu/bennu-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bennu/bennu-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "elevation",
    "winnerId": "normal",
    "slowAsset": "/scenes/bennu/bennu-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "surface",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
