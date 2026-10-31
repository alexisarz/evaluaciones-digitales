export const isActiveStudent = (user) => user?.rol === 'alumno' && user.activo === true

export const activeStudentsFromSnapshot = (snapshot) => snapshot.docs
  .map((item) => ({ id: item.id, ...item.data() }))
  .filter(isActiveStudent)
