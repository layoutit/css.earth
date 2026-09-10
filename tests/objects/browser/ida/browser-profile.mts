import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ida',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ida/ida-directional-sun.webp",
      "two": "/scenes/ida/ida-directional-sun@2x.webp"
    }
  ],
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
