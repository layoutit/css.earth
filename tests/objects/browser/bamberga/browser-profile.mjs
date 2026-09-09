import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/bamberga/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bamberga',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bamberga/bamberga-directional-sun.webp",
      "two": "/scenes/bamberga/bamberga-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bamberga/bamberga-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/bamberga/bamberga-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
