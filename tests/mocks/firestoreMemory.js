export function makeFirestoreMemory(records) {
  let nextId = 0
  const withUpdates = (current, values) => {
    const result = { ...current }
    for (const [field, value] of Object.entries(values)) {
      if (value?.__testDelete) delete result[field]
      else if (value?.__testArrayUnion) result[field] = [...new Set([...(result[field] ?? []), ...value.__testArrayUnion])]
      else if (value?.__testArrayRemove) result[field] = (result[field] ?? []).filter((item) => !value.__testArrayRemove.includes(item))
      else result[field] = value
    }
    return result
  }
  const snapshot = (path) => ({
    id: path.split('/').at(-1),
    ref: { path },
    exists: () => records.has(path),
    data: () => records.get(path),
  })
  const matches = (data, filter) => filter.operator === 'limit' ||
    (filter.operator === '==' && data[filter.field] === filter.value) ||
    (filter.operator === 'array-contains' && data[filter.field]?.includes(filter.value))

  return {
    collection: (parent, path) => ({ path: parent?.path ? `${parent.path}/${path}` : path }),
    doc: (parent, ...segments) => ({ path: [parent?.path, ...(segments.length ? segments : [`auto-${++nextId}`])].filter(Boolean).join('/') }),
    where: (field, operator, value) => ({ field, operator, value }),
    arrayUnion: (...values) => ({ __testArrayUnion: values }),
    arrayRemove: (...values) => ({ __testArrayRemove: values }),
    deleteField: () => ({ __testDelete: true }),
    limit: (value) => ({ operator: 'limit', value }),
    query: (reference, ...filters) => ({ ...reference, filters }),
    getDoc: async (reference) => snapshot(reference.path),
    getDocs: async (reference) => {
      const docs = [...records.keys()]
        .filter((path) => path.startsWith(`${reference.path}/`) && path.slice(reference.path.length + 1).indexOf('/') === -1)
        .filter((path) => (reference.filters ?? []).every((filter) => matches(records.get(path), filter)))
        .slice(0, reference.filters?.find((filter) => filter.operator === 'limit')?.value)
        .map(snapshot)
      return { docs, empty: docs.length === 0 }
    },
    runTransaction: async (_database, callback) => {
      const changes = []
      const transaction = {
        get: async (reference) => snapshot(reference.path),
        update: (reference, values) => changes.push(['update', reference.path, values]),
        set: (reference, values) => changes.push(['set', reference.path, values]),
        delete: (reference) => changes.push(['delete', reference.path]),
      }
      const result = await callback(transaction)
      for (const [type, path, values] of changes) {
        if (type === 'delete') records.delete(path)
        else records.set(path, type === 'update' ? withUpdates(records.get(path), values) : values)
      }
      return result
    },
    serverTimestamp: () => ({ serverTime: true }),
  }
}
