/** The only process boundary into Peppi and pdr. Exact discovery cannot truncate; decoding loads every advertised data object. */
import { spawn } from 'node:child_process';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { pdsToolchain } from './pds-toolchain.mts';

export type PdsPackageRequest =
  | { readonly operation: 'resolve-target'; readonly names: readonly string[] }
  | { readonly operation: 'discover-target'; readonly targetLid: string }
  | { readonly operation: 'discover-product'; readonly targetLid: string; readonly lidvid: string }
  | { readonly operation: 'decode-product'; readonly labelPath: string; readonly arrayDirectory?: string };

export interface PdsPackageAnswer {
  readonly schema: 'cssearth-pds-package-answer@1'; readonly peppi: string; readonly pdr: string;
  readonly operation: PdsPackageRequest['operation']; readonly products?: readonly Record<string, unknown>[];
  readonly targets?: readonly { readonly lid: string; readonly name: string; readonly aliases: readonly string[]; readonly type: string; readonly harvestIso: string }[];
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
def export_array(array):
    if not request.get('arrayDirectory'):return {}
    directory=Path(request['arrayDirectory']);directory.mkdir(parents=True,exist_ok=True)
    name='native-'+str(len(structures))+'.npy'
    array=np.ma.asarray(array)
    values=np.asarray(array) if not np.ma.getmaskarray(array).any() else np.ma.filled(array.astype(float),np.nan)
    np.save(directory/name,values)
    return {'arrayFile':name}

answer = {'schema':'cssearth-pds-package-answer@1','peppi':version('pds.peppi'),'pdr':version('pdr'),'operation':operation}

def value(item):
    if item is None or item is np.ma.masked or np.ma.is_masked(item): return None
    if isinstance(item, bytes): return item.decode('utf-8', errors='replace')
    if isinstance(item, np.generic): return value(item.item())
    if isinstance(item, (list, tuple, np.ndarray)): return [value(entry) for entry in item]
    if isinstance(item, float) and not math.isfinite(item): return None
    if isinstance(item, (str, int, float, bool)): return item
    return str(item)

if operation == 'resolve-target':
    names = request['names']
    if not names or any(not isinstance(name,str) or not name or len(name) > 200 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ._()/+-'" for c in name) for name in names):
        raise ValueError('PDS target names contain unsupported characters')
    quoted = lambda text: text.replace('\\','\\\\').replace('"','\\"')
    clauses = [f'(pds:Target.pds:name eq "{quoted(name)}" or pds:Alias.pds:alternate_title eq "{quoted(name)}")' for name in names]
    fields = ['lid','pds:Target.pds:name','pds:Alias.pds:alternate_title','pds:Target.pds:type','ops:Harvest_Info.ops:harvest_date_time']
    table = pep.Products(pep.PDSRegistryClient()).filter('product_class eq "Product_Context"').filter(' or '.join(clauses)).fields(fields).as_dataframe(max_rows=None)
    rows = [] if table is None else [{str(name):value(row[name]) for name in table.columns} for _,row in table.iterrows()]
    by_lid = {}
    for row in rows:
        lid = row['lid']; aliases = row.get('pds:Alias.pds:alternate_title') or []
        if not isinstance(aliases,list): aliases = [aliases]
        by_lid[lid] = {'lid':lid,'name':row['pds:Target.pds:name'],'aliases':aliases,'type':row['pds:Target.pds:type'],'harvestIso':row['ops:Harvest_Info.ops:harvest_date_time']}
    answer['targets'] = list(by_lid.values())
elif operation in ('discover-target', 'discover-product'):
    target = request['targetLid']; lidvid = request.get('lidvid')
    identifiers = target + (lidvid or '')
    if not target.startswith('urn:nasa:pds:context:target:') or (lidvid is not None and not lidvid.startswith('urn:nasa:pds:')) or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:._-' for c in identifiers):
        raise ValueError('PDS identifiers contain unsupported characters')
    fields = ['lid','vid','lidvid','ops:Label_File_Info.ops:file_ref','ops:Label_File_Info.ops:file_size','ops:Label_File_Info.ops:md5_checksum',
      'ops:Data_File_Info.ops:file_ref','ops:Data_File_Info.ops:file_size','ops:Data_File_Info.ops:md5_checksum','pds:Target_Identification.pds:name',
      'ref_lid_target','pds:Observing_System_Component.pds:name','pds:Time_Coordinates.pds:start_date_time','pds:Time_Coordinates.pds:stop_date_time',
      'pds:Primary_Result_Summary.pds:processing_level','ops:Harvest_Info.ops:harvest_date_time']
    query = pep.Products(pep.PDSRegistryClient()).has_target(target).observationals()
    if operation == 'discover-product': query = query.filter(f'lidvid eq "{lidvid}"')
    table = query.fields(fields).as_dataframe(max_rows=None if operation == 'discover-target' else 2)
    answer['products'] = [] if table is None else [{str(name):value(row[name]) for name in table.columns} for _,row in table.iterrows()]
elif operation == 'decode-product':
    label = Path(request['labelPath']).resolve()
    data = pdr.read(label)
    if str(data.standard) == 'PDS3':
        structures = []
        def native_metadata(key):
            if data.metadata.fieldcounts.get(key, 0) != 1: return {}
            block = data.metablock(key) or {}
            bins = block.get('BAND_BIN') or {}
            names, sizes = block.get('AXIS_NAME', []), block.get('CORE_ITEMS', [])
            bands = block.get('BANDS')
            if isinstance(names, (list, tuple)) and isinstance(sizes, (list, tuple)) and len(names) == len(sizes) and list(names).count('BAND') == 1:
                bands = sizes[list(names).index('BAND')]
            return {'unit':value(block.get('CORE_UNIT', block.get('UNIT'))),
                'centers':value(bins.get('BAND_BIN_CENTER')), 'wavelengthUnit':value(bins.get('BAND_BIN_UNIT')),
                'bands':value(bands)}
        for key in data.keys():
            if key == 'LABEL' or key.lower() == 'label' or 'HEADER' in key or key == 'HISTORY': continue
            native = data[key]
            if hasattr(native, 'columns'):
                columns = []
                for name in native.columns:
                    column = native[name]
                    numeric = np.issubdtype(column.dtype, np.number)
                    valid = np.asarray(column)[np.isfinite(np.asarray(column))] if numeric else None
                    columns.append({'name':str(name),'dtype':str(column.dtype),'numeric':numeric,
                        'finite':int(valid.size) if numeric else None,
                        'minimum':float(valid.min()) if numeric and valid.size else None,
                        'maximum':float(valid.max()) if numeric and valid.size else None})
                structures.append({'name':key,'kind':'table','shape':list(native.shape),'dtype':'table','elements':int(native.size),'columns':columns})
                continue
            array = np.ma.asarray(data.get_scaled(key))
            if not np.issubdtype(array.dtype, np.number): continue
            valid = np.asarray(array.compressed())
            valid = valid[np.isfinite(valid)]
            if not valid.size: raise ValueError(f'{key} has no finite samples')
            structures.append({**export_array(array),'name':key,'nativeMetadata':native_metadata(key),'shape':list(array.shape),'dtype':str(array.dtype),'elements':int(array.size),'finite':int(valid.size),'minimum':float(valid.min()),'maximum':float(valid.max())})
        if not structures: raise ValueError('PDS3 product has no supported numeric structure')
        answer['decoded'] = {'standard':'PDS3','metadata':{'scaling':'pdr get_scaled with special-value masking for arrays; tables as decoded by pdr','excludedNonScienceObjects':[key for key in data.keys() if 'HEADER' in key or key == 'HISTORY']},'structures':structures}
        json.dump(answer, sys.stdout, allow_nan=False, separators=(',',':'))
        sys.exit(0)
    root = ET.parse(label).getroot()
    def local(tag): return tag.rsplit('}',1)[-1]
    all_special_constants = [(local(child.tag),(child.text or '').strip()) for node in root.iter() if local(node.tag) == 'Special_Constants' for child in node if child.text]
    structures = []
    for key in data.keys():
        if key == 'label' or key.endswith('_HEADER') or key.startswith('HEADER_'): continue
        native = np.asanyarray(data[key])
        numeric = np.issubdtype(native.dtype, np.number)
        array = np.ma.asarray(data.get_scaled(key)) if numeric else native
        mask = np.ma.getmaskarray(array)
        values = np.asarray(array)
        finite = np.isfinite(values) if numeric else None
        matching = [node for node in root.iter() if local(node.tag).startswith('Array_') and
            any(local(child.tag) == 'local_identifier' and (child.text or '').strip() == key for child in node)]
        special_constants = [] if len(matching)!=1 else [(local(child.tag),(child.text or '').strip()) for node in matching[0].iter() if local(node.tag)=='Special_Constants' for child in node if child.text]
        special = np.zeros(array.shape, dtype=bool)
        if numeric:
            for _, text in special_constants:
                try:
                    constant = np.array([int(text,16)], dtype=np.uint32).view(np.float32)[0] if text.lower().startswith('0x') and native.dtype.itemsize == 4 else float(text)
                    special |= np.asarray(native) == constant
                except (ValueError, OverflowError): pass
        valid = finite & ~special & ~mask if numeric else None
        units = [] if len(matching) != 1 else [(child.text or '').strip() for element in matching[0] if local(element.tag) == 'Element_Array' for child in element if local(child.tag) == 'unit']
        structures.append({**(export_array(np.ma.array(values,mask=~valid)) if numeric else {}),'name':key,'nativeMetadata':{'unit':units[0] if len(units) == 1 else None},'shape':list(array.shape),'dtype':str(array.dtype),'elements':int(array.size),'masked':int(mask.sum()),'special':int(special.sum()),
          **({'finite':int(valid.sum()),'minimum':float(values[valid].min()),'maximum':float(values[valid].max())} if numeric and valid.any() else {})})
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
    def spectral_bins():
        bins = []
        for node in root.iter():
            if local(node.tag) != 'Bin_Wavelength': continue
            center = next((child for child in node.iter() if local(child.tag) == 'center_wavelength'), None)
            width = next((child for child in node.iter() if local(child.tag) == 'bin_width_wavelength'), None)
            filter_ = next((child for child in node.iter() if local(child.tag) == 'filter_name'), None)
            if center is not None and width is not None and filter_ is not None:
                bins.append({'filter':(filter_.text or '').strip(),'center':(center.text or '').strip(),'width':(width.text or '').strip(),
                  'centerUnit':center.attrib.get('unit'),'widthUnit':width.attrib.get('unit')})
        return bins
    def optical_filters():
        filters = []
        for node in root.iter():
            if local(node.tag) != 'Imaging': continue
            reference = next((child for child in node.iter() if local(child.tag) == 'local_identifier_reference'), None)
            optical = next((child for child in node.iter() if local(child.tag) == 'Optical_Filter'), None)
            if reference is None or optical is None: continue
            fields = {local(child.tag):child for child in optical.iter()}
            name, center, width = fields.get('filter_name'), fields.get('center_filter_wavelength'), fields.get('bandwidth')
            if name is not None and center is not None and width is not None:
                filters.append({'array':(reference.text or '').strip(),'filter':(name.text or '').strip(),'center':(center.text or '').strip(),'width':(width.text or '').strip(),
                  'centerUnit':center.attrib.get('unit'),'widthUnit':width.attrib.get('unit')})
        return filters
    def field_with_unit(name):
        node = next((node for node in root.iter() if local(node.tag) == name), None)
        return None if node is None or node.text is None else {'value':node.text.strip(),'unit':node.attrib.get('unit')}
    refs = []
    for node in root.iter():
        if local(node.tag) != 'Internal_Reference': continue
        values = {local(child.tag):(child.text or '').strip() for child in node}
        if values.get('lid_reference') and values.get('reference_type'): refs.append(values)
    answer['decoded'] = {'standard':str(data.standard),'metadata':{'logicalIdentifier':first('logical_identifier'),'version':first('version_id'),'title':first('title'),
      'productClass':first('product_class'),'processingLevel':first('processing_level'),'description':child_text('Primary_Result_Summary','description'),
      'startIso':first('start_date_time'),'stopIso':first('stop_date_time'),'targetName':child_text('Target_Identification','name'),
      'observingSystem':component_names(),
      'fileNames':all_('file_name'),'localIdentifiers':all_('local_identifier'),'units':all_('unit'),'filter':first('filter_name'),
      'centerFilterWavelength':first('center_filter_wavelength'),'bandwidth':first('bandwidth'),'spectralBins':spectral_bins(),'opticalFilters':optical_filters(),
      'mapProjection':first('map_projection_name'),'longitudeDirection':first('longitude_direction'),
      'pixelResolutionX':field_with_unit('pixel_resolution_x'),'pixelResolutionY':field_with_unit('pixel_resolution_y'),
      'specialConstants':[{'kind':kind,'value':text} for kind,text in all_special_constants],'references':refs},'structures':structures}
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
  if (request.operation === 'resolve-target') {
    const targets = requireArray(raw.targets, 'PDS targets').map((entry, index) => { const target = requireRecord(entry, `PDS target ${index}`); return {
      lid: requireString(target.lid, 'PDS target lid'), name: requireString(target.name, 'PDS target name'),
      aliases: requireArray(target.aliases, 'PDS target aliases').map(alias => requireString(alias, 'PDS target alias')),
      type: requireString(target.type, 'PDS target type'), harvestIso: requireString(target.harvestIso, 'PDS target harvest time') }; });
    return { schema: 'cssearth-pds-package-answer@1', peppi: peppiVersion, pdr: pdrVersion, operation: request.operation, targets };
  }
  if (request.operation === 'discover-product' || request.operation === 'discover-target') {
    const products = requireArray(raw.products, 'PDS products').map((entry, index) => requireRecord(entry, `PDS product ${index}`));
    if (request.operation === 'discover-product' && products.length > 1) throw new Error(`${request.lidvid} is not a unique PDS product.`);
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
