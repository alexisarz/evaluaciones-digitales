import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { archiveTeacherExams } from './teacherExamsSlice'

export default function useBulkArchive(legajoProfe, visibleEligibleIds) {
  const dispatch = useDispatch()
  const [selectedIds, setSelectedIds] = useState([])
  const [pendingIds, setPendingIds] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [successCount, setSuccessCount] = useState(0)
  const allVisibleSelected = visibleEligibleIds.length > 0 && visibleEligibleIds.every((id) => selectedIds.includes(id))

  const toggle = (id) => setSelectedIds((current) => current.includes(id)
    ? current.filter((item) => item !== id) : [...current, id])
  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleEligibleIds.includes(id))
    : [...new Set([...current, ...visibleEligibleIds])])
  const remove = (id) => setSelectedIds((current) => current.filter((item) => item !== id))
  const clear = () => setSelectedIds([])
  const requestArchive = () => {
    if (selectedIds.length > 0 && selectedIds.length <= 100) setPendingIds([...selectedIds])
  }
  const confirmArchive = async () => {
    if (!pendingIds || busy) return
    setBusy(true)
    setError('')
    setSuccessCount(0)
    try {
      await dispatch(archiveTeacherExams({ ids: pendingIds, legajoProfe })).unwrap()
      setSelectedIds((current) => current.filter((id) => !pendingIds.includes(id)))
      setSuccessCount(pendingIds.length)
      setPendingIds(null)
    } catch (caught) {
      setError(caught.message || 'No se pudieron archivar los exámenes. Intentá nuevamente.')
      setPendingIds(null)
    } finally { setBusy(false) }
  }

  return { selectedIds, pendingIds, busy, error, successCount, allVisibleSelected,
    toggle, toggleAllVisible, remove, clear, requestArchive, confirmArchive,
    cancelArchive: () => setPendingIds(null) }
}
