export const TABLE_KIND = 'decision_table'
export const TREE_KIND = 'decision_tree'

export const isDecisionTable = (value) => value?.kind === TABLE_KIND && Array.isArray(value.columns) && Array.isArray(value.rows)
export const isDecisionTree = (value) => value?.kind === TREE_KIND && value.root && typeof value.root === 'object'

export const emptyDecisionTable = () => ({
  kind: TABLE_KIND,
  columns: ['Regla 1'],
  rows: [{ id: 1, label: '', values: [''] }],
})

export const emptyDecisionTree = () => ({
  kind: TREE_KIND,
  root: { id: 1, text: '', branches: [] },
})

export function tableAddRow(table) {
  const id = Math.max(0, ...table.rows.map((row) => Number(row.id) || 0)) + 1
  return { ...table, rows: [...table.rows, { id, label: '', values: table.columns.map(() => '') }] }
}

export function tableRemoveRow(table) {
  return { ...table, rows: table.rows.slice(0, -1) }
}

export function tableAddColumn(table) {
  return {
    ...table,
    columns: [...table.columns, `Regla ${table.columns.length + 1}`],
    rows: table.rows.map((row) => ({ ...row, values: [...row.values, ''] })),
  }
}

export function tableRemoveColumn(table) {
  if (table.columns.length <= 1) return table
  return {
    ...table,
    columns: table.columns.slice(0, -1),
    rows: table.rows.map((row) => ({ ...row, values: row.values.slice(0, -1) })),
  }
}

export function tableUpdateColumn(table, columnIndex, label) {
  return { ...table, columns: table.columns.map((column, index) => index === columnIndex ? label : column) }
}

export function tableUpdateCell(table, rowId, columnIndex, value) {
  return {
    ...table,
    rows: table.rows.map((row) => row.id !== rowId ? row : columnIndex === -1
      ? { ...row, label: value }
      : { ...row, values: row.values.map((cell, index) => index === columnIndex ? value : cell) }),
  }
}

function mapNode(node, nodeId, transform) {
  if (node.id === nodeId) return transform(node)
  return { ...node, branches: node.branches.map((branch) => ({ ...branch, child: mapNode(branch.child, nodeId, transform) })) }
}

function maxTreeId(node) {
  return Math.max(Number(node.id) || 0, ...node.branches.flatMap((branch) => [Number(branch.id) || 0, maxTreeId(branch.child)]))
}

export function treeUpdateNode(tree, nodeId, text) {
  return { ...tree, root: mapNode(tree.root, nodeId, (node) => ({ ...node, text })) }
}

export function treeAddBranch(tree, nodeId) {
  const id = maxTreeId(tree.root) + 1
  return { ...tree, root: mapNode(tree.root, nodeId, (node) => ({
    ...node,
    branches: [...node.branches, { id, label: '', child: { id: id + 1, text: '', branches: [] } }],
  })) }
}

export function treeUpdateBranch(tree, nodeId, branchId, label) {
  return { ...tree, root: mapNode(tree.root, nodeId, (node) => ({
    ...node,
    branches: node.branches.map((branch) => branch.id === branchId ? { ...branch, label } : branch),
  })) }
}

export function treeRemoveBranch(tree, nodeId, branchId) {
  return { ...tree, root: mapNode(tree.root, nodeId, (node) => ({
    ...node,
    branches: node.branches.filter((branch) => branch.id !== branchId),
  })) }
}

export function hasStructuredContent(value) {
  if (isDecisionTable(value)) return value.rows.some((row) => row.label.trim() || row.values.some((cell) => cell.trim()))
  if (isDecisionTree(value)) {
    const filled = (node) => Boolean(node.text.trim() || node.branches.some((branch) => branch.label.trim() || filled(branch.child)))
    return filled(value.root)
  }
  return false
}
