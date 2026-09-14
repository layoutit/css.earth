import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/hersilia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hersilia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hersilia/hersilia-directional-sun.webp",
      "two": "/scenes/hersilia/hersilia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hersilia/hersilia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hersilia/hersilia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
