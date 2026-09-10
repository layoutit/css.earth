import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/johanna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'johanna',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/johanna/johanna-directional-sun.webp",
      "two": "/scenes/johanna/johanna-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/johanna/johanna-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/johanna/johanna-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
