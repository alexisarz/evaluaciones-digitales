export const changedCourseMembership = (previous, next) =>
  previous.length !== next.length || previous.some((code) => !next.includes(code))

export const addedCourseMembership = (previous, next) =>
  next.some((code) => !previous.includes(code))

export const sanitizeCourseCode = (value) => String(value ?? '').replace(/[^\p{L}0-9-]/gu, '')

export function findOrphanCourseAssignments(users, courses) {
  const existingCodes = new Set(courses.map((course) => course.id ?? course.idCurso))
  return users.filter((user) => ['alumno', 'profesor'].includes(user.rol))
    .map((user) => ({
      legajo: String(user.legajo ?? user.id),
      missingCodes: (Array.isArray(user.cursosActivos) ? user.cursosActivos : [])
        .filter((code) => !existingCodes.has(code)),
    }))
    .filter((user) => user.missingCodes.length > 0)
}
