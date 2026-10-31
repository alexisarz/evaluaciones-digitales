import DecisionTable from './DecisionTable'
import DecisionTree from './DecisionTree'
import { hasStructuredContent, isDecisionTable, isDecisionTree } from '../../features/examQuestions/structuredAnswers'

export default function StructuredAnswer({ type, value, onChange, readOnly = false, disabled = false, emptyLabel = 'Sin respuesta' }) {
  if (readOnly && !hasStructuredContent(value)) {
    return <p className="structured-answer-empty">{typeof value === 'string' && value.trim() ? value : emptyLabel}</p>
  }
  if (type === 'Tabla de decisión') return <DecisionTable value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} />
  if (type === 'Árbol de decisión' || type === 'Árbol') return <DecisionTree value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} />
  if (isDecisionTable(value)) return <DecisionTable value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} />
  if (isDecisionTree(value)) return <DecisionTree value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} />
  return <p className="structured-answer-empty">{typeof value === 'string' ? value || emptyLabel : emptyLabel}</p>
}
