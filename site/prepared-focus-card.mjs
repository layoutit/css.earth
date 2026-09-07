const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });
const words = value => value.replaceAll('-', ' ').replace(/^./u, letter => letter.toUpperCase());

/** One retained card transports the selected prepared record; no catalogue is imported here. */
export function createPreparedFocusCard(root) {
  if (!root) return { set() {} };
  const fields = Object.fromEntries(['name', 'aliases', 'status', 'distance', 'uncertainty', 'membership', 'association', 'basis', 'reference']
    .map(name => [name, root.querySelector(`[data-focus-${name}]`)]));
  const links = [...root.querySelectorAll('[data-focus-source]')];
  const write = (name, value) => { if (fields[name].textContent !== value) fields[name].textContent = value; };
  return { set(record, sources = []) {
    if (!record) { root.hidden = true; return; }
    root.dataset.preparedFocusId = record.id;
    write('name', record.name);
    write('aliases', record.aliases.length ? `Also known as ${record.aliases.join(', ')}` : '');
    fields.aliases.hidden = record.aliases.length === 0;
    const cluster = record.kind === 'galaxy-cluster';
    write('status', cluster ? record.classification.name : `${words(record.status)} galaxy`);
    write('distance', `${number.format(record.distance.valuePc)} pc${cluster ? ' (comoving, redshift-derived)' : ''}`);
    const { minusPc, plusPc, uncertainty } = record.distance;
    write('uncertainty', uncertainty ? `${number.format(uncertainty.statisticalPc)} pc statistical; ${number.format(uncertainty.systematicPc)} pc systematic`
      : minusPc !== undefined && plusPc !== undefined ? `−${number.format(minusPc)} / +${number.format(plusPc)} pc` : 'Not supplied');
    write('membership', cluster ? 'Galaxy cluster' : words(record.membership.group));
    write('association', cluster ? `Spectroscopic redshift ${record.redshift.value}` : words(record.membership.subgroup));
    write('basis', cluster ? `${record.classification.basis} ${record.distance.method}` : record.membership.basis);
    write('reference', `Distance reference: ${record.distance.sourceRef}`);
    for (const [index, link] of links.entries()) {
      const source = sources[index];
      link.hidden = !source;
      if (source) { link.href = source.url; link.textContent = source.citation; }
      else { link.removeAttribute('href'); link.textContent = ''; }
    }
  } };
}
