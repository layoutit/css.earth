import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/asteroid-2002-ce26/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-2002-ce26',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-2002-ce26/asteroid-2002-ce26-directional-sun.webp",
      "two": "/scenes/asteroid-2002-ce26/asteroid-2002-ce26-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-2002-ce26/asteroid-2002-ce26-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-2002-ce26/asteroid-2002-ce26-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
