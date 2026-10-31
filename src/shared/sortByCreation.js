function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Los registros antiguos sin fecha quedan al final en su orden original. */
export function sortNewestFirst(items, fields = ['fechaCreacion']) {
  const createdAt = (item) => {
    for (const field of fields) {
      const date = timestampMillis(item?.[field])
      if (date !== null) return date
    }
    return null
  }
  return [...items].sort((a, b) => {
    const first = createdAt(a)
    const second = createdAt(b)
    if (first === null && second === null) return 0
    if (first === null) return 1
    if (second === null) return -1
    return second - first
  })
}
