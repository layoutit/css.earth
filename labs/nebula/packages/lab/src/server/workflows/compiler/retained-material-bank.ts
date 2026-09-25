import { prepareRetainedMaterialBank as prepare, type RetainedMaterialBankOptions } from '@cssearth/bake/volume/node';
export type {RetainedMaterialBankOptions} from '@cssearth/bake/volume/node';
import {compileCssVolume} from '../../../adapters/preparation/css-volume.ts';
import {validatePreparedCssVolume} from '../../../adapters/renderer/volume-validation.ts';
import {assertCompilerBankIdentity,assertCompilerLensGeometry} from './bank-validation.ts';
export function prepareRetainedMaterialBank(options:RetainedMaterialBankOptions){return prepare(options,{readVolume:validatePreparedCssVolume,compileVolume:input=>validatePreparedCssVolume(compileCssVolume({...input,recipe:{anchors:[]}})),assertBankIdentity:assertCompilerBankIdentity,assertLensGeometry:assertCompilerLensGeometry});}
