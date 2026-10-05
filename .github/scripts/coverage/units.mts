/** Source-owned executable units. Offsets are UTF-16, matching TypeScript, V8 and source maps. */
import ts from 'typescript';
export type UnitKind = 'lines' | 'branches' | 'functions';
export interface Unit {
    id: string;
    kind: UnitKind;
    start: number;
    end: number;
    line: number;
    column: number;
    snippet: string;
    label: string;
    requiresOwnRange?: {
        start: number;
        end: number;
    };
}
export interface SourceUnits {
    units: Unit[];
    limits: string[];
}
export function sourceUnits(file: string, source: string): SourceUnits {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const units: Unit[] = [], limits: string[] = [];
    const lineUnits = new Map<number, Unit>();
    const erased = (n: ts.Node): boolean => ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
        || (ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword || (m.kind === ts.SyntaxKind.AbstractKeyword && !ts.isClassDeclaration(n))))
        || (ts.isImportDeclaration(n) && !!n.importClause?.isTypeOnly)
        || (ts.isExportDeclaration(n) && (n.isTypeOnly || (!!n.exportClause && ts.isNamedExports(n.exportClause) && n.exportClause.elements.length > 0
            && n.exportClause.elements.every(e => e.isTypeOnly))));
    const token = (n: ts.Node): ts.Node => {
        if (ts.isBlock(n))
            return n.statements.length ? token(n.statements[0]!) : n;
        if (ts.isVariableStatement(n))
            return token(n.declarationList.declarations[0]!);
        if (ts.isVariableDeclaration(n))
            return n.name;
        if (ts.isExpressionStatement(n))
            return n.expression;
        if (ts.isFunctionDeclaration(n) && n.name)
            return n.name;
        if (ts.isClassDeclaration(n) && n.name)
            return n.name;
        return n.getFirstToken(sf) ?? n;
    };
    const add = (kind: UnitKind, n: ts.Node, label: string) => {
        let t = token(n);
        if (kind === 'functions') {
            if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)
                || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)) && n.name && !ts.isComputedPropertyName(n.name))
                t = n.name;
            else if (ts.isArrowFunction(n) && n.parameters.length)
                t = n.parameters[0]!.name;
            else
                t = n.getChildren(sf).find(c => c.kind === ts.SyntaxKind.FunctionKeyword
                    || c.kind === ts.SyntaxKind.ConstructorKeyword || c.kind === ts.SyntaxKind.OpenParenToken) ?? n.getFirstToken(sf) ?? n;
        }
        const start = t.getStart(sf), first = t.getFirstToken(sf) ?? t;
        const end = Math.max(start + 1, first.getEnd());
        const line = sf.getLineAndCharacterOfPosition(start).line + 1;
        const unit: Unit = {
            column: sf.getLineAndCharacterOfPosition(start).character + 1,
            snippet: source.split("\n")[line - 1]!.trim().slice(0, 180),
            id: `${kind}:${start}:${label}`, kind, start, end, line, label,
        };
        if (label === 'parameter:default')
            unit.requiresOwnRange = { start: n.getStart(sf), end: n.getEnd() };
        if (kind === 'lines') {
            if (!lineUnits.has(line))
                lineUnits.set(line, unit);
        }
        else
            units.push(unit);
    };
    const visit = (n: ts.Node): void => {
        if (erased(n))
            return;
        if (ts.isImportDeclaration(n) && n.importClause && !n.importClause.name && n.importClause.namedBindings
            && ts.isNamedImports(n.importClause.namedBindings) && n.importClause.namedBindings.elements.length
            && n.importClause.namedBindings.elements.every(e => e.isTypeOnly))
            return;
        if (ts.isStatement(n) && !ts.isBlock(n) && !ts.isEmptyStatement(n)
            && !(ts.isFunctionDeclaration(n) && !n.body))
            add('lines', n, ts.SyntaxKind[n.kind]);
        if (ts.isVariableDeclaration(n))
            add('lines', n.name, 'variable');
        if (ts.isPropertyDeclaration(n) && ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)) {
            limits.push(`line ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: static field initializer cannot be distinguished from instance initializer ranges`);
            return;
        }
        if (ts.isPropertyDeclaration(n) || ts.isEnumMember(n))
            add('lines', n.name, ts.isPropertyDeclaration(n) ? 'field' : 'enum member');
        if (ts.isFunctionLike(n) && 'body' in n && n.body)
            add('functions', n, ts.SyntaxKind[n.kind]);
        if (ts.isIfStatement(n)) {
            add('branches', n.thenStatement, 'if');
            if (n.elseStatement)
                add('branches', n.elseStatement, 'else');
            else
                limits.push(`line ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: implicit else has no executable token`);
        }
        if (ts.isCaseClause(n) || ts.isDefaultClause(n)) {
            add('branches', n.statements[0] ?? n, ts.isCaseClause(n) ? 'case' : 'default');
        }
        if (ts.isCatchClause(n))
            add('branches', n.block, 'catch');
        if (ts.isTryStatement(n) && n.finallyBlock)
            add('branches', n.finallyBlock, 'finally');
        if (ts.isConditionalExpression(n)) {
            add('branches', n.whenTrue, 'ternary:true');
            add('branches', n.whenFalse, 'ternary:false');
        }
        if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind))
            add('branches', n.right, ts.tokenToString(n.operatorToken.kind) ?? 'logical');
        if (ts.isIterationStatement(n, false))
            add('branches', n.statement, 'loop');
        if (ts.isParameter(n) && n.initializer) {
            limits.push(`line ${sf.getLineAndCharacterOfPosition(n.initializer.getStart(sf)).line + 1}: default initializer has no distinct V8 range`);
            // No descendant units: expressions in a default inherit indistinguishable function coverage.
            ts.forEachChild(n.name, visit);
            return;
        }
        if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n)) && n.questionDotToken) {
            add('branches', n.questionDotToken, 'optional:continuation');
        }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    units.push(...lineUnits.values());
    return { units: units.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)), limits };
}
