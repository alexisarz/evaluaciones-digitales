// Firestore Timestamp no es serializable: el store conserva fechas como ISO strings.
export function serializeFirestore(value) {
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeFirestore)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeFirestore(item)]))
  }
  return value
}
