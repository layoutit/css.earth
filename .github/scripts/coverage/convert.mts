/** Convert V8 ranges to original-source evidence once, for all collectors. Never infer hits from missing evidence. */
import { readFileSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve, relative, dirname } from 'node:path';
import { SourceMapConsumer } from 'source-map-js';
import type { RawSourceMap, MappingItem } from 'source-map-js';
import ts from 'typescript';
import { readRaw, localFile, object, list, text, parseFunctions } from './raw.mts';
import type { RawScript, V8Function } from './raw.mts';
export interface Interval {
    start: number;
    end: number;
    covered: boolean;
    rangeStart?: number;
    rangeEnd?: number;
}
export interface Evidence {
    files: Map<string, Interval[]>;
    loaded: Set<string>;
    unmapped: {
        script: string;
        reason: string;
        count: number;
    }[];
    kind: string;
    costMs: number;
    qualified?: boolean;
    hits?: Map<string, Set<string>>;
}
export function directIntervals(functions: V8Function[], length: number): {
    intervals: Interval[];
    ambiguous: number;
} {
    const ranges = functions.flatMap(f => f.ranges);
    if (ranges.some(r => r.endOffset > length))
        throw new Error('V8 range exceeds script length');
    const endpoints = [...new Set(ranges.flatMap(r => [r.startOffset, r.endOffset]))].sort((a, b) => a - b);
    const intervals: Interval[] = [];
    let ambiguous = 0;
    for (let i = 0; i < endpoints.length - 1; i++) {
        const start = endpoints[i]!, end = endpoints[i + 1]!;
        const matches = ranges.filter(r => r.startOffset <= start && r.endOffset >= end).sort((a, b) => (a.endOffset - a.startOffset) - (b.endOffset - b.startOffset));
        if (!matches.length)
            continue;
        const width = matches[0]!.endOffset - matches[0]!.startOffset;
        const ties = matches.filter(r => r.endOffset - r.startOffset === width);
        if (ties.some(r => (r.count > 0) !== (ties[0]!.count > 0))) {
            ambiguous++;
            continue;
        }
        intervals.push({ start, end, covered: matches[0]!.count > 0, rangeStart: matches[0]!.startOffset, rangeEnd: matches[0]!.endOffset });
    }
    return { intervals, ambiguous };
}
function lowerBound(values: number[], position: number): number {
    let lo = 0, hi = values.length;
    while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid]! < position)
        lo = mid + 1;
    else
        hi = mid;
    }
    return lo;
}
function starts(source: string): number[] {
    const result = [0];
    for (let i = 0; i < source.length; i++) {
        if (source[i] === '\n') result.push(i + 1);
    }
    return result;
}
function offset(source: string, lines: number[], line: number, column: number): number {
    if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 0 || lines[line - 1] === undefined)
        throw new Error('Invalid source-map position');
    const start = lines[line - 1]!, next = lines[line], lineEnd = next === undefined ? source.length : next - 1;
    const end = lineEnd > start && source[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd;
    if (start + column > end)
        throw new Error('Source-map column exceeds line');
    return start + column;
}
export function parseMap(value: unknown): RawSourceMap {
    const o = object(value);
    if (o.version !== 3 && o.version !== '3')
        throw new Error('Expected source-map version 3');
    const sources = list(o.sources).map(text), names = list(o.names).map(text);
    const result: RawSourceMap = { version: '3', sources, names, mappings: text(o.mappings) };
    if (o.sourceRoot !== undefined)
        result.sourceRoot = text(o.sourceRoot);
    if (o.sourcesContent !== undefined) {
        const content = list(o.sourcesContent);
        if (content.length !== sources.length)
            throw new Error('Source content count differs');
        // The library accepts null entries, despite its older declaration claiming strings only.
        if (content.some(c => c !== null && typeof c !== 'string'))
            throw new Error('Invalid sourcesContent');
        result.sourcesContent = content as string[];
    }
    return result;
}
function identity(source: string, base: string, root: string): string | undefined {
    const clean = source.split('?')[0]!;
    const path = resolve(dirname(base), clean), local = relative(root, path).replaceAll('\\', '/');
    if (!local.startsWith('../') && !local.startsWith('/'))
        return local;
    // Comparison builds may belong to another checkout. Content validation below makes this rebasing safe.
    const match = clean.match(/(?:^|\/)(site|packages|src)\/(.+)$/u);
    return match ? `${match[1]}/${match[2]}` : undefined;
}
export function mapIntervals(source: string, functions: V8Function[], mapValue: unknown, base: string, root: string, moves: Record<string, string> = {}): {
    files: Map<string, Interval[]>;
    loaded: Set<string>;
    issues: Map<string, number>;
} {
    const map = parseMap(mapValue), consumer = new SourceMapConsumer(map), generatedLines = starts(source);
    const { intervals, ambiguous } = directIntervals(functions, source.length);
    const files = new Map<string, Interval[]>(), loaded = new Set<string>(), issues = new Map<string, number>();
    const issue = (reason: string) => issues.set(reason, (issues.get(reason) ?? 0) + 1);
    if (ambiguous)
        issues.set('ambiguous V8 interval', ambiguous);
    const cached = new Map<string, {
        file: string;
        source: string;
        lines: number[];
    } | null>();
    const original = (name: string) => {
        if (cached.has(name))
            return cached.get(name);
        const originalFile = identity(name, base, root);
        const file = originalFile ? movedPath(originalFile, moves) : undefined;
        if (!file || !existsSync(resolve(root, file))) {
            issue(`source outside repository or absent: ${name}`);
            cached.set(name, null);
            return null;
        }
        const originalSource = readFileSync(resolve(root, file), 'utf8'), embedded = consumer.sourceContentFor(name, true);
        if (file.endsWith('.astro')) {
            issue(`Astro virtual module (extracted script, not full template): ${file}`);
            cached.set(name, null);
            return null;
        }
        if (embedded === null) {
            issue(`missing sourcesContent: ${file}`);
            cached.set(name, null);
            return null;
        }
        if (embedded !== originalSource) {
            issue(`stale sourcesContent: ${file}`);
            cached.set(name, null);
            return null;
        }
        const result = { file, source: originalSource, lines: starts(originalSource) };
        cached.set(name, result);
        loaded.add(file);
        return result;
    };
    const mappings: MappingItem[] = [];
    consumer.eachMapping(m => mappings.push(m));
    const generatedOffsets = mappings.map(m => offset(source, generatedLines, m.generatedLine, m.generatedColumn));
    const mappingAt = new Map(generatedOffsets.map((position, i) => [position, mappings[i]!]));
    const intervalStarts = intervals.map(r => r.start);
    const ambiguousOffsets = new Set<number>();
    for (let i = 1; i < mappings.length; i++) {
        const a = mappings[i - 1]!, b = mappings[i]!;
        if (generatedOffsets[i] === generatedOffsets[i - 1] && (a.source !== b.source || a.originalLine !== b.originalLine || a.originalColumn !== b.originalColumn))
            ambiguousOffsets.add(generatedOffsets[i]!);
    }
    if ((generatedOffsets[0] ?? source.length) > 0)
        issue('generated prefix without source mapping');
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
    for (let i = 0; i < mappings.length; i++) {
        const m = mappings[i]!, generated = generatedOffsets[i]!;
        if (ambiguousOffsets.has(generated)) {
            issue('ambiguous original positions at generated start');
            continue;
        }
        if (m.source === null || m.originalLine === null || m.originalColumn === null) {
            issue('segment without original position');
            continue;
        }
        const origin = original(m.source);
        if (!origin)
            continue;
        const exactIndex = lowerBound(intervalStarts, generated);
        const intervalIndex = intervalStarts[exactIndex] === generated ? exactIndex : exactIndex - 1;
        const candidate = intervals[intervalIndex], evidence = candidate && generated < candidate.end ? candidate : undefined;
        if (!evidence) {
            issue('segment without V8 evidence');
            continue;
        }
        const endGenerated = generatedOffsets[i + 1] ?? source.length;
        for (let j = intervalIndex + 1; intervals[j] && intervals[j]!.start < endGenerated; j++)
            if (intervals[j]!.covered !== evidence.covered) {
                issue('V8 boundary inside source-map segment (start owns segment)');
                break;
            }
        const start = offset(origin.source, origin.lines, m.originalLine, m.originalColumn);
        // A segment points at an original token, not at the text up to the next arbitrary original mapping.
        // Extending across that gap would falsely cover erased/dead statements after minification.
        scanner.setText(origin.source);
        scanner.setTextPos(start);
        const kind = scanner.scan();
        if (kind >= ts.SyntaxKind.FirstTriviaToken && kind <= ts.SyntaxKind.LastTriviaToken) {
            issue('segment points at original trivia');
            continue;
        }
        const end = Math.max(start + 1, scanner.getTextPos());
        // An exact start and the final mapped token can attest that a default initializer has a distinct original V8 range.
        const first = evidence.rangeStart === undefined ? undefined : mappingAt.get(evidence.rangeStart);
        const lastIndex = evidence.rangeEnd === undefined ? -1 : lowerBound(generatedOffsets, evidence.rangeEnd) - 1, last = lastIndex >= 0 ? mappings[lastIndex] : undefined;
        let owner: {
            rangeStart?: number;
            rangeEnd?: number;
        } = {};
        if (first?.source === m.source && last?.source === m.source && first.originalLine !== null && first.originalColumn !== null
            && last.originalLine !== null && last.originalColumn !== null
            && !ambiguousOffsets.has(evidence.rangeStart!)) {
            const rangeStart = offset(origin.source, origin.lines, first.originalLine, first.originalColumn);
            const lastStart = offset(origin.source, origin.lines, last.originalLine, last.originalColumn);
            scanner.setTextPos(lastStart);
            const lastKind = scanner.scan();
            if (!(lastKind >= ts.SyntaxKind.FirstTriviaToken && lastKind <= ts.SyntaxKind.LastTriviaToken) && lastStart >= rangeStart)
                owner = { rangeStart, rangeEnd: scanner.getTextPos() };
        }
        const values = files.get(origin.file) ?? [];
        values.push({ start, end, covered: evidence.covered, ...owner });
        files.set(origin.file, values);
    }
    return { files, loaded, issues };
}
export function movedPath(file: string, moves: Record<string, string>): string {
    const seen = new Set<string>();
    for (let steps = 0; moves[file]; steps++) {
        if (steps > Object.keys(moves).length)
            throw new Error(`Cyclic move map: ${file}`);
        if (seen.has(file))
            throw new Error(`Cyclic move map: ${file}`);
        seen.add(file);
        file = moves[file]!;
    }
    return file;
}
/** Exact inline function identity. No normalization, fuzzy matching or inferred offsets. */
export function inlineIntervals(source: string, functions: V8Function[], originals: Map<string, string>): {
    files: Map<string, Interval[]>;
    loaded: Set<string>;
    issues: string[];
} {
    const files = new Map<string, Interval[]>(), loaded = new Set<string>(), issues: string[] = [];
    const intervals = directIntervals(functions, source.length).intervals;
    const sf = ts.createSourceFile('inline.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visit = (node: ts.Node): void => {
        if (ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
            const start = node.getStart(sf), end = node.getEnd(), exact = source.slice(start, end);
            const matches: {
                file: string;
                start: number;
            }[] = [];
            for (const [file, original] of originals) {
                let position = original.indexOf(exact);
                while (position >= 0) {
                    matches.push({ file, start: position });
                    position = original.indexOf(exact, position + 1);
                }
            }
            if (matches.length === 1) {
                const match = matches[0]!;
                const mapped = intervals.filter(r => r.start < end && r.end > start).map(r => ({
                    start: Math.max(r.start, start) - start + match.start,
                    end: Math.min(r.end, end) - start + match.start,
                    covered: r.covered,
                }));
                files.set(match.file, [...(files.get(match.file) ?? []), ...mapped]);
                loaded.add(match.file);
                return; // Nested ranges are already translated with the uniquely matched enclosing function.
            }
            issues.push(`${matches.length ? 'ambiguous/duplicate' : 'no exact'} inline function match: ${node.name?.getText(sf) ?? 'anonymous'}`);
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return { files, loaded, issues };
}
export function convert(dir: string, root: string, moves: Record<string, string> = {}, inlineFiles: string[] = []): Evidence {
    const raw = readRaw(dir);
    const status = resolve(dir, 'status.json');
    const qualified = raw.kind === 'node'
        ? existsSync(status) && object(JSON.parse(readFileSync(status, 'utf8'))).exitCode === 0
        : !raw.issues.some(issue => issue.startsWith('Page error'));
    const result: Evidence = {
        files: new Map(), loaded: new Set(), unmapped: [],
        kind: raw.kind, costMs: raw.costMs, qualified,
    };
    const originals = new Map(inlineFiles.map(file => [file, stripTypeScriptTypes(readFileSync(resolve(root, file), 'utf8'), { mode: 'strip' })]));
    for (const issue of raw.issues)
        result.unmapped.push({ script: 'collector', reason: issue, count: 1 });
    for (const script of raw.scripts) {
        try {
            convertScript(script);
        }
        catch (error) {
            result.unmapped.push({ script: script.url, reason: error instanceof Error ? error.message : String(error), count: 1 });
        }
    }
    function convertScript(script: RawScript) {
        const source = readFileSync(localFile(dir, script.source), 'utf8');
        parseFunctions(script.functions);
        if (script.map) {
            if (!script.mapBase)
                throw new Error('Mapped script lacks mapBase');
            const mapped = mapIntervals(source, script.functions, JSON.parse(readFileSync(localFile(dir, script.map), 'utf8')), script.mapBase, root, moves);
            for (const file of mapped.loaded)
                result.loaded.add(file);
            for (const [file, intervals] of mapped.files)
                result.files.set(file, [...(result.files.get(file) ?? []), ...intervals]);
            for (const [reason, count] of mapped.issues)
                result.unmapped.push({ script: script.url, reason, count });
        }
        else if (script.sourcePath && /\.(?:mts|ts|js|mjs)$/u.test(script.sourcePath)) {
            if (raw.issues.includes(`No independently captured Node source: ${script.sourcePath}`)) return;
            const file = movedPath(script.sourcePath, moves), original = readFileSync(resolve(root, file), 'utf8');
            const expected = /\.(mts|ts)$/u.test(script.sourcePath) ? stripTypeScriptTypes(original, { mode: 'strip', sourceUrl: script.url }) : original;
            if (original !== source && expected !== source)
                throw new Error(`Direct source differs from repository: ${file}`);
            const { intervals, ambiguous } = directIntervals(script.functions, source.length);
            result.loaded.add(file);
            result.files.set(file, [...(result.files.get(file) ?? []), ...intervals]);
            if (ambiguous)
                result.unmapped.push({ script: script.url, reason: 'ambiguous V8 intervals', count: ambiguous });
        }
        else {
            const inline = inlineIntervals(source, script.functions, originals);
            for (const file of inline.loaded)
                result.loaded.add(file);
            for (const [file, intervals] of inline.files)
                result.files.set(file, [...(result.files.get(file) ?? []), ...intervals]);
            for (const reason of inline.issues)
                result.unmapped.push({ script: script.url, reason, count: 1 });
            if (!inline.loaded.size)
                result.unmapped.push({ script: script.url, reason: 'script has neither direct repository identity nor source map; exact inline mapping unavailable', count: 1 });
        }
    }
    return result;
}
