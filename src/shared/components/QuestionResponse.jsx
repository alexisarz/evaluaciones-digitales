import StructuredAnswer from './StructuredAnswer'

export default function QuestionResponse({ type, value, emptyLabel = 'Sin respuesta' }) {
  if (type === 'Tabla de decisión' || type === 'Árbol de decisión' || type === 'Árbol') {
    return <StructuredAnswer type={type} value={value} readOnly emptyLabel={emptyLabel} />
  }
  return <p>{typeof value === 'string' && value.trim() ? value : emptyLabel}</p>
}
