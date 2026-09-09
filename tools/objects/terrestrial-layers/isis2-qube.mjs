/** Decode the explicitly selected legacy ISIS2 PC_REAL raster layout. These
 * rescued mission products are not relabelled as reviewed PDS image products.
 * Their original labels, history, special pixels and record padding stay intact. */
export function decodeIsis2Qube(bytes, grid) {
  const head = bytes.subarray(0, Math.min(bytes.length, 65536)).toString('ascii');
  const end = head.search(/^END\s*$/m);
  if (end < 0) throw new Error('ISIS2 QUBE label is unterminated.');
  const label = head.slice(0, end);
  const field = key => {
    const values = [...label.matchAll(new RegExp('^\\s*' + key.replaceAll('^', '\\^') + '\\s*=\\s*([^\\r\\n]+)', 'gm'))];
    if (values.length !== 1) throw new Error('Missing or duplicate ISIS2 field: ' + key);
    return values[0][1].trim();
  };
  const integer = key => /^\d+$/.test(field(key)) ? Number(field(key)) : NaN;
  const record = integer('RECORD_BYTES'), pointer = integer('^QUBE'), width = grid.width, height = grid.height;
  const offset = (pointer - 1) * record, length = width * height * 4;
  if (!label.startsWith('CCSD3ZF0000100000001NJPL3IF0PDS200000001 = SFDU_LABEL') ||
      field('RECORD_TYPE') !== 'FIXED_LENGTH' || field('FILE_STATE') !== 'CLEAN' ||
      field('AXIS_NAME').replaceAll(' ', '') !== '(SAMPLE,LINE,BAND)' ||
      field('CORE_ITEMS').replaceAll(' ', '') !== `(${width},${height},1)` ||
      field('SUFFIX_ITEMS').replaceAll(' ', '') !== '(0,0,0)' || integer('AXES') !== 3 ||
      integer('CORE_ITEM_BYTES') !== 4 || field('CORE_ITEM_TYPE') !== 'PC_REAL' ||
      Number(field('CORE_BASE')) !== 0 || Number(field('CORE_MULTIPLIER')) !== 1 ||
      field('CORE_VALID_MINIMUM') !== '16#FF7FFFFA#' || field('CORE_NULL') !== '16#FF7FFFFB#' ||
      ![record, pointer, width, height].every(n => Number.isSafeInteger(n) && n > 0) ||
      offset < end + 3 || integer('LABEL_RECORDS') * record < end + 3 ||
      integer('FILE_RECORDS') * record !== bytes.length || offset + length > bytes.length ||
      bytes.length - offset - length >= record) throw new Error('ISIS2 QUBE layout differs from the authored grid.');
  const special = ['CORE_LOW_REPR_SATURATION', 'CORE_LOW_INSTR_SATURATION', 'CORE_HIGH_INSTR_SATURATION', 'CORE_HIGH_REPR_SATURATION'];
  special.forEach((key, i) => {
    if (field(key) !== `16#${(0xff7ffffc + i).toString(16).toUpperCase()}#`) throw new Error('ISIS2 special-pixel definitions changed.');
  });
  const data = new Float32Array(width * height), valid = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const at = offset + i * 4, bits = bytes.readUInt32LE(at), value = bytes.readFloatLE(at);
    if (bits >= 0xff7ffffb && bits <= 0xff7fffff) { data[i] = NaN; continue; }
    if (!Number.isFinite(value) || Math.abs(value) > 1e30) throw new Error('Unexpected ISIS2 scalar value.');
    data[i] = value; valid[i] = 1;
  }
  return { data, valid, width, height, offset };
}
