import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/psyche/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'psyche',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/psyche/psyche-directional-sun.webp",
      "two": "/scenes/psyche/psyche-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/psyche/psyche-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/psyche/psyche-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
