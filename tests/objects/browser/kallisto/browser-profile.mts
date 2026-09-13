import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/kallisto/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kallisto',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/kallisto/kallisto-directional-sun.webp",
      "two": "/scenes/kallisto/kallisto-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/kallisto/kallisto-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kallisto/kallisto-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
