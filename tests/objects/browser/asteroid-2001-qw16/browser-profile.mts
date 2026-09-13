import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asteroid-2001-qw16/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-2001-qw16',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asteroid-2001-qw16/asteroid-2001-qw16-directional-sun.webp",
      "two": "/scenes/asteroid-2001-qw16/asteroid-2001-qw16-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asteroid-2001-qw16/asteroid-2001-qw16-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/asteroid-2001-qw16/asteroid-2001-qw16-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
