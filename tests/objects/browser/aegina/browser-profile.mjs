import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/aegina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aegina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/aegina/aegina-directional-sun.webp",
      "two": "/scenes/aegina/aegina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/aegina/aegina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/aegina/aegina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
