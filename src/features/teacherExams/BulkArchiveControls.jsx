import ConfirmDialog from '../../shared/components/ConfirmDialog'

export function BulkArchiveToolbar({ selectedCount, busy, onClear, onArchive }) {
  return <section className="archive-selection-bar" aria-label="Archivar exámenes seleccionados">
    <span>{selectedCount} seleccionados{selectedCount > 100 && ' · máximo 100 por operación'}</span>
    {selectedCount > 0 && <button className="text-action" type="button" onClick={onClear} disabled={busy}>Limpiar selección</button>}
    <button className="secondary-action archive-bulk-button" type="button" disabled={selectedCount === 0 || selectedCount > 100 || busy} onClick={onArchive}>Archivar seleccionados</button>
  </section>
}

export function BulkArchiveConfirmation({ count, busy, onCancel, onConfirm }) {
  if (!count) return null
  return <ConfirmDialog titleId="bulk-archive-title" title={`¿Archivar ${count} examen${count === 1 ? '' : 'es'}?`} actions={<>
    <button className="secondary-action" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
    <button className="primary-action" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Archivando…' : 'Archivar'}</button>
  </>}><p>Los exámenes seleccionados pasarán a Exámenes archivados. Sus entregas y notas se conservarán y podrás consultarlas desde allí.</p></ConfirmDialog>
}
