export const forcedBackupId = (attemptId) => `${attemptId}_forced_backup`

export function hasUnsyncedForcedAnswers(local, remote) {
  if (!local || remote?.motivoEntrega !== 'finalizacion_profesor') return false
  return JSON.stringify(local.respuestas ?? []) !== JSON.stringify(remote.respuestas ?? [])
}
