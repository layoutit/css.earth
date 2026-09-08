import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/ganymed/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ganymed',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ganymed/ganymed-directional-sun.webp",
      "two": "/scenes/ganymed/ganymed-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ganymed/ganymed-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ganymed/ganymed-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
