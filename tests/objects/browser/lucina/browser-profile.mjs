import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/lucina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lucina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lucina/lucina-directional-sun.webp",
      "two": "/scenes/lucina/lucina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lucina/lucina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lucina/lucina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
