import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/anahita/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'anahita',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/anahita/anahita-directional-sun.webp",
      "two": "/scenes/anahita/anahita-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/anahita/anahita-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/anahita/anahita-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
