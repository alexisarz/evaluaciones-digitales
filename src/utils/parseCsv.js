export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim()); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []; cell = ''
    } else {
      cell += char
    }
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  if (rows.length < 2) throw new Error('El CSV debe tener encabezados y al menos una fila.')

  const headers = rows[0].map((header) => header.trim())
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error('Los encabezados del CSV están vacíos o repetidos.')
  }
  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`La fila ${index + 2} tiene una cantidad incorrecta de columnas.`)
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]))
  })
  return { headers, records }
}
