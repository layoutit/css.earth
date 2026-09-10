import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/sapientia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sapientia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/sapientia/sapientia-directional-sun.webp",
      "two": "/scenes/sapientia/sapientia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/sapientia/sapientia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/sapientia/sapientia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
