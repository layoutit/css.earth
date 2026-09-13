import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-1999-fr33/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1999-fr33',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-directional-sun.webp",
      "two": "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1999-fr33/asteroid-1999-fr33-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
