import {parse, object, string, optional, dictionary} from '@cssearth/core/schema';
import { validateRelativePath } from '../giant/index.ts';
/** Material addresses forbid parent fragments even inside otherwise valid public-prefix text. */
const MATERIAL_ADDRESS_POLICY = { namespace: /^[a-z][a-z0-9-]*$/, publicPrefix: /^\/[a-z0-9/-]+\/$/, forbiddenFragment: '..' };
const materialBase = object({schema:string,namespace:string,publicPrefix:string,files:optional(dictionary(string))});
/** Shared address and numeric checks run before raster allocation or writes. */
export function validateMaterialRecipe(input: unknown, schema: string) {
  const config = parse(input, materialBase, 'material recipe');
  if (config?.schema !== schema) throw new TypeError('Unsupported material capability recipe.');
  if (!MATERIAL_ADDRESS_POLICY.namespace.test(config.namespace)) throw new TypeError('Invalid material namespace.');
  if (typeof config.publicPrefix !== 'string' || !MATERIAL_ADDRESS_POLICY.publicPrefix.test(config.publicPrefix) || config.publicPrefix.includes(MATERIAL_ADDRESS_POLICY.forbiddenFragment)) throw new TypeError('Invalid material public prefix.');
  for (const filename of Object.values(config.files ?? {})) validateRelativePath(filename);
  /** All numeric extensions, including fields outside the base schema, must be finite. */
  const validateFiniteMaterialParameters = (value: unknown): void => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Material parameters must be finite.');
    if (value && typeof value === 'object') Object.values(value).forEach(validateFiniteMaterialParameters);
  };
  validateFiniteMaterialParameters(input);
  return config;
}
