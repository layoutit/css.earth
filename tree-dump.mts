import { navigationTree, type TreeNode } from '../site/navigation/navigation-tree.mts';
const lines: string[] = [];
const walk = (nodes: TreeNode[], depth = 0) => { for (const n of nodes) { lines.push(`${'  '.repeat(depth)}${n.label} [${n.key}] ${n.href ?? '-'}${n.focusId ? ' focus=' + n.focusId : ''}`); walk(n.children, depth + 1); } };
walk(navigationTree()); process.stdout.write(lines.join('\n') + '\n');
