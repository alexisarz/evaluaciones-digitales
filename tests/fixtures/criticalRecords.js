export const student = (overrides = {}) => ({
  legajo: 101,
  nombre: 'Ana',
  apellido: 'López',
  rol: 'alumno',
  activo: true,
  contrasenaActiva: false,
  cursosActivos: ['CURSO-A'],
  ...overrides,
})

export const exam = (overrides = {}) => ({
  nombre: 'Parcial 1',
  legajoProfe: 200045,
  cursoCodigo: 'CURSO-A',
  estado: 'finalizado',
  fechaInicio: '2026-11-01T19:00:00Z',
  duracionMinutos: 120,
  toleranciaMinutos: 15,
  ...overrides,
})

export const delivery = (overrides = {}) => ({
  examenId: 'exam-1',
  legajoProfe: 200045,
  legajoAlumno: 101,
  estadoEntrega: 'entregado',
  estadoCorreccion: 'pendiente',
  notaPublicada: false,
  preguntas: [{ idPregunta: 1, puntajeMaximo: 2 }, { idPregunta: 2, puntajeMaximo: 8 }],
  respuestas: [{ idPregunta: 1, respuestaTexto: 'Respuesta A' }, { idPregunta: 2, respuestaTexto: 'Respuesta B' }],
  ...overrides,
})
