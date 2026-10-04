/** Mechanical module style: preserve a module's introductory block above imports. */
import type { Rule } from 'eslint';

export const headerCommentFirst: Rule.RuleModule = {
  meta: { type: 'layout', schema: [], messages: { first: 'Keep the introductory comment block above imports.' } },
  create(context) {
    const source = context.sourceCode;
    return {
      Program(node) {
        const imports = [];
        for (const statement of node.body) {
          if (statement.type !== 'ImportDeclaration') break;
          imports.push(statement);
        }
        if (!imports.length) return;
        const start = imports[0].range?.[0];
        const end = imports.at(-1)?.range?.[1];
        if (start === undefined || end === undefined) return;
        const next = node.body[imports.length]?.range?.[0] ?? source.text.length;
        for (const comment of source.getAllComments()) {
          if (comment.type !== 'Block' || !comment.loc || comment.loc.start.column !== 0 || !comment.range) continue;
          // Directive comments belong to their statement, rather than to the module header.
          if (/^\s*\*?\s*(?:eslint|prettier|@ts-|@vite-)/u.test(comment.value)) continue;
          // An attached declaration JSDoc is API documentation, not a module header.
          if (comment.range[0] >= end && node.body[imports.length] && !/\n\s*\n/u.test(source.text.slice(comment.range[1], next))) continue;
          if (comment.range[0] > start && comment.range[0] < next && comment.range[0] <= Math.max(end, next)) {
            context.report({ loc: comment.loc, messageId: 'first' });
          }
        }
      },
    };
  },
};
