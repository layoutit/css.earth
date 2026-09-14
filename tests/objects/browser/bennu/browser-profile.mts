import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/bennu/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bennu',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/bennu/bennu-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "spectral",
    "winnerId": "normal",
    "slowAsset": "/scenes/bennu/bennu-spectral-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "surface",
      "spectral",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
