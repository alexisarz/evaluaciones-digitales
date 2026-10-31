import {
  emptyDecisionTree, isDecisionTree, treeAddBranch,
  treeRemoveBranch, treeUpdateBranch, treeUpdateNode,
} from '../../features/examQuestions/structuredAnswers'

function TreeNode({ node, tree, onChange, readOnly, disabled, isRoot = false }) {
  return <li className="decision-tree-item">
    <div className={`decision-tree-node ${node.branches.length ? 'decision' : 'leaf'}`}>
      {readOnly ? <span>{node.text || '—'}</span> : <input aria-label={isRoot ? 'Nodo inicial' : `Nodo ${node.id}`} value={node.text} onChange={(event) => onChange(treeUpdateNode(tree, node.id, event.target.value))} disabled={disabled} placeholder={isRoot ? 'Pregunta inicial' : 'Decisión o resultado'} />}
      {!readOnly && !disabled && <button type="button" className="tree-add-branch" onClick={() => onChange(treeAddBranch(tree, node.id))}>+ Rama</button>}
    </div>
    {node.branches.length > 0 && <ul className="decision-tree-children">{node.branches.map((branch) => <li className="decision-tree-branch" key={branch.id}>
      <div className="decision-tree-branch-label">
        {readOnly ? <span>{branch.label || '—'}</span> : <>
          <input aria-label={`Etiqueta de la rama ${branch.id}`} value={branch.label} onChange={(event) => onChange(treeUpdateBranch(tree, node.id, branch.id, event.target.value))} disabled={disabled} placeholder="Sí / No / otro" />
          {!disabled && <button type="button" aria-label={`Eliminar rama ${branch.id}`} title="Eliminar esta rama y sus nodos" onClick={() => onChange(treeRemoveBranch(tree, node.id, branch.id))}>×</button>}
        </>}
      </div>
      <ul><TreeNode node={branch.child} tree={tree} onChange={onChange} readOnly={readOnly} disabled={disabled} /></ul>
    </li>)}</ul>}
  </li>
}

export default function DecisionTree({ value, onChange, readOnly = false, disabled = false }) {
  const tree = isDecisionTree(value) ? value : emptyDecisionTree()
  return <div className="decision-tree-editor">
    {typeof value === 'string' && value.trim() && <p className="legacy-structured-answer">Respuesta anterior en texto: {value}</p>}
    {!readOnly && <p className="decision-tree-help">Escribí el nodo inicial y agregá ramas. Cada rama conecta con otro nodo; podés seguir ramificando desde él.</p>}
    <div className="decision-tree-scroll"><ul className="decision-tree-root"><TreeNode node={tree.root} tree={tree} onChange={onChange} readOnly={readOnly} disabled={disabled} isRoot /></ul></div>
  </div>
}
