import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/erato/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erato',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/erato/erato-directional-sun.webp",
      "two": "/scenes/erato/erato-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/erato/erato-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/erato/erato-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
