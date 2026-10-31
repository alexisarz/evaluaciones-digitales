export default function ArchiveExamButton({ exam, busy, onArchive }) {
  return <button className="text-action" type="button" disabled={busy} onClick={() => onArchive(exam)}>
    {busy ? 'Archivando…' : 'Archivar'}
  </button>
}
