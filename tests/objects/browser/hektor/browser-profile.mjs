import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hektor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hektor',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hektor/hektor-directional-sun.webp",
      "two": "/scenes/hektor/hektor-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hektor/hektor-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hektor/hektor-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
