import { collection, getDoc, getDocs, doc, query, where } from 'firebase/firestore'
import { db } from '../firebase'

const coursesCollection = collection(db, 'cursos')

export async function obtenerCursosPorProfesor(legajoProfe) {
  const snapshot = await getDocs(query(coursesCollection, where('legajoProfe', '==', Number(legajoProfe))))
  return snapshot.docs.map((course) => ({ id: course.id, ...course.data() }))
}

/** Los códigos viven en users.cursosActivos; no se usa una colección inscripciones. */
export async function obtenerCursosPorCodigos(courseCodes = []) {
  const courses = await Promise.all(courseCodes.map(async (code) => {
    const course = await getDoc(doc(db, 'cursos', code))
    return course.exists() ? { id: course.id, ...course.data() } : null
  }))
  return courses.filter(Boolean)
}
