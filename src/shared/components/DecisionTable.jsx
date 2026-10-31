import {
  emptyDecisionTable, isDecisionTable, tableAddColumn, tableAddRow,
  tableRemoveColumn, tableRemoveRow, tableUpdateCell, tableUpdateColumn,
} from '../../features/examQuestions/structuredAnswers'

export default function DecisionTable({ value, onChange, readOnly = false, disabled = false }) {
  const table = isDecisionTable(value) ? value : emptyDecisionTable()
  const editable = !readOnly && !disabled
  const minWidth = Math.max(560, 260 + table.columns.length * 190)

  return <div className="decision-table-editor">
    {typeof value === 'string' && value.trim() && <p className="legacy-structured-answer">Respuesta anterior en texto: {value}</p>}
    <div className="decision-table-scroll" role="region" aria-label="Tabla de decisión con desplazamiento horizontal" tabIndex={0}><table className="decision-table" style={{ minWidth }}><thead><tr>
      <th scope="col">Condición / acción</th>
      {table.columns.map((column, index) => <th scope="col" key={index}>{readOnly ? column || `Regla ${index + 1}` : <input aria-label={`Nombre de la regla ${index + 1}`} value={column} onChange={(event) => onChange(tableUpdateColumn(table, index, event.target.value))} disabled={disabled} />}</th>)}
    </tr></thead><tbody>
      {table.rows.map((row, rowIndex) => <tr key={row.id}>
        <th scope="row">{readOnly ? row.label || '—' : <input aria-label={`Condición o acción ${rowIndex + 1}`} value={row.label} onChange={(event) => onChange(tableUpdateCell(table, row.id, -1, event.target.value))} disabled={disabled} placeholder="Condición o acción" />}</th>
        {table.columns.map((_, columnIndex) => <td key={columnIndex}>{readOnly ? row.values[columnIndex] || '—' : <input aria-label={`Fila ${rowIndex + 1}, regla ${columnIndex + 1}`} value={row.values[columnIndex] ?? ''} onChange={(event) => onChange(tableUpdateCell(table, row.id, columnIndex, event.target.value))} disabled={disabled} placeholder="Sí / No / X / —" />}</td>)}
      </tr>)}
    </tbody></table></div>
    {editable && <div className="decision-table-actions">
      <button type="button" className="secondary-action" onClick={() => onChange(tableAddRow(table))}>+ Fila</button>
      <button type="button" className="secondary-action" onClick={() => onChange(tableAddColumn(table))}>+ Columna</button>
      <button type="button" className="secondary-action" onClick={() => onChange(tableRemoveRow(table))} disabled={!table.rows.length}>− Fila</button>
      <button type="button" className="secondary-action" onClick={() => onChange(tableRemoveColumn(table))} disabled={table.columns.length <= 1}>− Columna</button>
    </div>}
  </div>
}
