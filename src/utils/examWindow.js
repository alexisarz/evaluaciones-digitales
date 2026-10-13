function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return Date.parse(value)
  return Number.NaN
}

export function getExamSchedule(exam) {
  const startMs = toMillis(exam?.fechaInicio)
  const toleranceMinutes = Number(exam?.toleranciaMinutos ?? 0)
  const durationMinutes = Number(exam?.duracionMinutos ?? 120)
  if (!Number.isFinite(startMs) || !Number.isFinite(toleranceMinutes) || toleranceMinutes < 0 ||
    !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null
  }

  const endMs = startMs + durationMinutes * 60_000
  const deadlineMs = Math.min(startMs + toleranceMinutes * 60_000, endMs)
  return { startMs, toleranceMinutes, durationMinutes, deadlineMs, endMs }
}

export function getExamWindowStatus(exam, now = Date.now()) {
  const schedule = getExamSchedule(exam)
  if (!schedule) return { status: 'invalid' }
  const { startMs, deadlineMs, endMs } = schedule
  if (now < startMs) return { status: 'upcoming', boundaryMs: startMs }
  if (now > deadlineMs || now >= endMs) return { status: 'expired', boundaryMs: deadlineMs }
  return { status: 'open', boundaryMs: deadlineMs }
}

/** Estado visible calculado desde la fecha; no depende de tener la página abierta al cambiar la hora. */
export function getEffectiveExamStatus(exam, now = Date.now()) {
  if (['borrador', 'para_corregir', 'cerrado', 'finalizado'].includes(exam?.estado)) return exam.estado
  const schedule = getExamSchedule(exam)
  if (!schedule) return exam?.estado ?? 'programado'
  if (now >= schedule.endMs) return 'finalizado'
  if (now >= schedule.startMs) return 'en_curso'
  return exam?.estado === 'reprogramado' ? 'reprogramado' : 'programado'
}

export function isExamEditable(exam, now = Date.now()) {
  if (['en_curso', 'finalizado', 'para_corregir', 'cerrado'].includes(exam?.estado)) return false
  return ['borrador', 'programado', 'reprogramado'].includes(getEffectiveExamStatus(exam, now))
}

export function formatExamDateTime(milliseconds) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(milliseconds))
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('day')}/${part('month')}/${part('year')} a las ${part('hour')}:${part('minute')} hs`
}

export function examWindowMessage(windowStatus) {
  if (windowStatus.status === 'upcoming') return `El examen comenzará el ${formatExamDateTime(windowStatus.boundaryMs)}.`
  if (windowStatus.status === 'expired') return `El examen venció el ${formatExamDateTime(windowStatus.boundaryMs)}.`
  return 'No se pudo verificar la fecha de este examen. Contactá al profesor.'
}
