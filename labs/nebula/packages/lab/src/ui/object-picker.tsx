import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface PickerObject { id: string; name: string }
export function ObjectPicker({ value, objects, disabled, onChange }: {
  value: string; objects: readonly PickerObject[]; disabled?: boolean; onChange(id: string): void;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const host = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const label = objects.find(object => object.id === value)?.name ?? value;
  const normalized = query.toLowerCase().replace(/\s/g, '');
  const matches = objects.filter(object => `${object.id} ${object.name}`.toLowerCase().replace(/\s/g, '').includes(normalized));
  const current = matches[Math.min(active, Math.max(0, matches.length - 1))];
  const expand = () => { if (!disabled) { setQuery(''); setActive(0); setOpen(true); } };
  const choose = (id: string) => { setOpen(false); setQuery(''); onChange(id); };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !host.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open && current) document.getElementById(`object-option-${current.id}`)?.scrollIntoView({ block: 'nearest' }); }, [open, current?.id]);
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Enter' && open) { event.preventDefault(); if (current) choose(current.id); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { expand(); return; }
      setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    }
  }
  return <div className="object-picker" ref={host} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="visually-hidden" htmlFor="subject">Object</label>
    <input id="subject" ref={input} role="combobox" autoComplete="off" spellCheck={false}
      data-object-id={value} aria-expanded={open} aria-autocomplete="list" aria-controls="object-results"
      aria-activedescendant={open && current ? `object-option-${current.id}` : undefined}
      disabled={disabled} value={open ? query : label} placeholder={open ? 'Search objects…' : label}
      onFocus={expand} onClick={() => { if (!open) expand(); }} onKeyDown={keyboard}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} />
    <button type="button" className="object-picker-toggle" aria-label={open ? 'Close object list' : 'Choose object'} disabled={disabled}
      aria-expanded={open} tabIndex={-1} onMouseDown={event => event.preventDefault()}
      onClick={() => { if (open) setOpen(false); else { expand(); input.current?.focus(); } }}>⌄</button>
    {open && <div className="object-picker-popup"><div id="object-results" role="listbox" aria-label="Objects">
      {matches.map(object => <button key={object.id} id={`object-option-${object.id}`} type="button" role="option" tabIndex={-1}
        data-object-id={object.id} data-active={current?.id === object.id} aria-selected={object.id === value}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(object.id)}>
        <span>{object.name}</span>{object.id === value && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>{!matches.length && <p role="status">No matching objects</p>}</div>}
  </div>;
}
