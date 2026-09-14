import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/ida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ida',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/ida/ida-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "calibrated",
    "winnerId": "normal",
    "slowAsset": "/scenes/ida/ida-calibrated-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "elevation",
      "calibrated"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
