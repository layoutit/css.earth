/** The only process boundary into Peppi and pdr. Exact discovery cannot truncate; decoding loads every advertised data object. */
import { spawn } from 'node:child_process';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { pdsToolchain } from './pds-toolchain.mts';

export type PdsPackageRequest =
  | { readonly operation: 'discover-product'; readonly targetLid: string; readonly lidvid: string }
  | { readonly operation: 'decode-product'; readonly labelPath: string };

export interface PdsPackageAnswer {
  readonly schema: 'cssearth-pds-package-answer@1'; readonly peppi: string; readonly pdr: string;
  readonly operation: PdsPackageRequest['operation']; readonly products?: readonly Record<string, unknown>[];
  readonly decoded?: { readonly standard: string; readonly metadata: Record<string, unknown>; readonly structures: readonly Record<string, unknown>[] };
}

const PYTHON = String.raw`
import json, math, sys
from importlib.metadata import version
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
import pdr
import pds.peppi as pep

request = json.load(sys.stdin)
operation = request['operation']
answer = {'schema':'cssearth-pds-package-answer@1','peppi':version('pds.peppi'),'pdr':version('pdr'),'operation':operation}

def value(item):
    if item is None or item is np.ma.masked or np.ma.is_masked(item): return None
    if isinstance(item, bytes): return item.decode('utf-8', errors='replace')
    if isinstance(item, np.generic): return value(item.item())
    if isinstance(item, (list, tuple, np.ndarray)): return [value(entry) for entry in item]
    if isinstance(item, float) and not math.isfinite(item): return None
    if isinstance(item, (str, int, float, bool)): return item
    return str(item)

if operation == 'discover-product':
    target = request['targetLid']; lidvid = request['lidvid']
    if not target.startswith('urn:nasa:pds:context:target:') or not lidvid.startswith('urn:nasa:pds:') or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:._-' for c in target + lidvid):
        raise ValueError('PDS identifiers contain unsupported characters')
    fields = ['lid','vid','lidvid','ops:Label_File_Info.ops:file_ref','ops:Label_File_Info.ops:file_size','ops:Label_File_Info.ops:md5_checksum',
      'ops:Data_File_Info.ops:file_ref','ops:Data_File_Info.ops:file_size','ops:Data_File_Info.ops:md5_checksum','pds:Target_Identification.pds:name',
      'ref_lid_target','pds:Observing_System_Component.pds:name','pds:Time_Coordinates.pds:start_date_time','pds:Time_Coordinates.pds:stop_date_time',
      'pds:Primary_Result_Summary.pds:processing_level','ops:Harvest_Info.ops:harvest_date_time']
    table = pep.Products(pep.PDSRegistryClient()).has_target(target).observationals().filter(f'lidvid eq "{lidvid}"').fields(fields).as_dataframe(max_rows=2)
    answer['products'] = [] if table is None else [{str(name):value(row[name]) for name in table.columns} for _,row in table.iterrows()]
elif operation == 'decode-product':
    label = Path(request['labelPath']).resolve()
    data = pdr.read(label)
    structures = []
    for key in data.keys():
        if key == 'label' or key.endswith('_HEADER'): continue
        array = np.asanyarray(data[key])
        mask = np.ma.getmaskarray(array)
        values = np.asarray(np.ma.filled(array, np.nan))
        numeric = np.issubdtype(values.dtype, np.number)
        finite = np.isfinite(values) if numeric else None
        structures.append({'name':key,'shape':list(array.shape),'dtype':str(array.dtype),'elements':int(array.size),'masked':int(mask.sum()),
          **({'finite':int(finite.sum()),'minimum':float(values[finite].min()),'maximum':float(values[finite].max())} if numeric and finite.any() else {})})
    root = ET.parse(label).getroot()
    def local(tag): return tag.rsplit('}',1)[-1]
    def first(name):
        node = next((node for node in root.iter() if local(node.tag) == name), None)
        return None if node is None or node.text is None else node.text.strip()
    def all_(name): return [node.text.strip() for node in root.iter() if local(node.tag) == name and node.text]
    def child_text(block, name):
        parent = next((node for node in root.iter() if local(node.tag) == block), None)
        node = None if parent is None else next((child for child in parent.iter() if local(child.tag) == name), None)
        return None if node is None or node.text is None else node.text.strip()
    def component_names():
        return [child_text_from(node, 'name') for node in root.iter() if local(node.tag) == 'Observing_System_Component']
    def child_text_from(parent, name):
        node = next((child for child in parent if local(child.tag) == name), None)
        return None if node is None or node.text is None else node.text.strip()
    refs = []
    for node in root.iter():
        if local(node.tag) != 'Internal_Reference': continue
        values = {local(child.tag):(child.text or '').strip() for child in node}
        if values.get('lid_reference') and values.get('reference_type'): refs.append(values)
    answer['decoded'] = {'standard':str(data.standard),'metadata':{'logicalIdentifier':first('logical_identifier'),'version':first('version_id'),
      'productClass':first('product_class'),'startIso':first('start_date_time'),'stopIso':first('stop_date_time'),'targetName':child_text('Target_Identification','name'),
      'observingSystem':component_names(),
      'fileNames':all_('file_name'),'localIdentifiers':all_('local_identifier'),'units':all_('unit'),'filter':first('filter_name'),
      'centerFilterWavelength':first('center_filter_wavelength'),'bandwidth':first('bandwidth'),'references':refs},'structures':structures}
else: raise ValueError(f'Unsupported PDS package operation: {operation}')

json.dump(answer, sys.stdout, allow_nan=False, separators=(',',':'))
`;

export type PdsPackageRunner = (python: string, env: NodeJS.ProcessEnv, request: PdsPackageRequest) => Promise<unknown>;
export const runPdsPackageProcess: PdsPackageRunner = (python, env, request) => new Promise((done, fail) => {
  const child = spawn(python, ['-c', PYTHON], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.on('error', fail);
  child.on('close', code => code === 0 ? (() => { try { done(JSON.parse(stdout)); } catch (error) { fail(new Error(`PDS packages returned invalid JSON: ${String(error)}`)); } })()
    : fail(new Error(`PDS ${request.operation} failed (status ${code}): ${stderr.slice(-4000)}`)));
  child.stdin.end(JSON.stringify(request));
});

export function parsePdsPackageAnswer(value: unknown, request: PdsPackageRequest, peppiVersion = '0.5.0', pdrVersion = '1.4.4'): PdsPackageAnswer {
  const raw = requireRecord(value, 'PDS package answer');
  if (raw.schema !== 'cssearth-pds-package-answer@1' || raw.operation !== request.operation || raw.peppi !== peppiVersion || raw.pdr !== pdrVersion)
    throw new TypeError('PDS packages answered with the wrong contract, operation or versions.');
  if (request.operation === 'discover-product') {
    const products = requireArray(raw.products, 'PDS products').map((entry, index) => requireRecord(entry, `PDS product ${index}`));
    if (products.length > 1) throw new Error(`${request.lidvid} is not a unique PDS product.`);
    return { schema: 'cssearth-pds-package-answer@1', peppi: peppiVersion, pdr: pdrVersion, operation: request.operation, products };
  }
  const decoded = requireRecord(raw.decoded, 'decoded PDS product'), metadata = requireRecord(decoded.metadata, 'decoded PDS metadata');
  const structures = requireArray(decoded.structures, 'decoded PDS structures').map((entry, index) => {
    const structure = requireRecord(entry, `decoded structure ${index}`);
    requireString(structure.name, 'decoded structure name'); requireString(structure.dtype, 'decoded structure dtype');
    requireFiniteNumber(structure.elements, 'decoded structure elements');
    requireArray(structure.shape, 'decoded structure shape').forEach(value => requireFiniteNumber(value, 'decoded structure axis'));
    return structure;
  });
  return { schema: 'cssearth-pds-package-answer@1', peppi: peppiVersion, pdr: pdrVersion, operation: request.operation,
    decoded: { standard: requireString(decoded.standard, 'PDS standard'), metadata, structures } };
}

export async function pdsPackages(request: PdsPackageRequest, runner: PdsPackageRunner = runPdsPackageProcess): Promise<PdsPackageAnswer> {
  const toolchain = await pdsToolchain();
  return parsePdsPackageAnswer(await runner(toolchain.python, toolchain.env, request), request, toolchain.peppiVersion, toolchain.pdrVersion);
}
