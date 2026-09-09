import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/asteroid-1998-ml14/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1998-ml14',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-directional-sun.webp",
      "two": "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1998-ml14/asteroid-1998-ml14-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
