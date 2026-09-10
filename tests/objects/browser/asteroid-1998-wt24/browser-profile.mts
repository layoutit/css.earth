import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/asteroid-1998-wt24/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-1998-wt24',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-1998-wt24/asteroid-1998-wt24-directional-sun.webp",
      "two": "/scenes/asteroid-1998-wt24/asteroid-1998-wt24-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-1998-wt24/asteroid-1998-wt24-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-1998-wt24/asteroid-1998-wt24-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
