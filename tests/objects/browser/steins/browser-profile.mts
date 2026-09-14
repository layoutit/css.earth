import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/steins/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'steins',controls,audit:{
  "preparedAssetPairs": [],
  "canonicalPreparedAssets": [
    "/scenes/steins/steins-osiris-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "osiris",
    "slowId": "normal",
    "winnerId": "osiris",
    "slowAsset": "/scenes/steins/steins-normal-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "osiris",
      "normal",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
