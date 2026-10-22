export function getPublishedGrade(attempt) {
  if (attempt?.estadoEntrega !== 'entregado' || attempt.estadoCorreccion !== 'corregido' ||
    attempt.notaPublicada === false || typeof attempt.nota !== 'number' || !Number.isFinite(attempt.nota)) {
    return null
  }
  return attempt.nota
}
