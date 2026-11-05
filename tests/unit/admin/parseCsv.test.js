import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../../src/utils/parseCsv'

describe('carga masiva CSV', () => {
  it('acepta encabezado con BOM, separador de punto y coma y valores entre comillas', () => {
    const result = parseCsv('\uFEFFlegajo;nombre;apellido;cursosActivos\r\n101;"Ana, María";"Pérez";"CURSO-A|CURSO-B"\r\n')
    expect(result.headers).toEqual(['legajo', 'nombre', 'apellido', 'cursosActivos'])
    expect(result.records).toEqual([{ legajo: '101', nombre: 'Ana, María', apellido: 'Pérez', cursosActivos: 'CURSO-A|CURSO-B' }])
  })

  it('respeta comas y comillas escapadas dentro de una celda', () => {
    const result = parseCsv('legajo,nombre,apellido\n102,"Juan ""Pepe"", Jr.",Gómez\n')
    expect(result.records[0].nombre).toBe('Juan "Pepe", Jr.')
  })

  it('rechaza encabezados duplicados, filas incompletas y comillas sin cerrar', () => {
    expect(() => parseCsv('legajo,legajo\n101,Ana')).toThrow('encabezados')
    expect(() => parseCsv('legajo,nombre\n101')).toThrow('fila 2')
    expect(() => parseCsv('legajo,nombre\n101,"Ana')).toThrow('comillas sin cerrar')
    expect(() => parseCsv('legajo,nombre')).toThrow('al menos una fila')
  })
})
