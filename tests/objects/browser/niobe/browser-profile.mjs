import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/niobe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'niobe',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/niobe/niobe-directional-sun.webp",
      "two": "/scenes/niobe/niobe-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/niobe/niobe-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/niobe/niobe-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
