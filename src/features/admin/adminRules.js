export const changedCourseMembership = (previous, next) =>
  previous.length !== next.length || previous.some((code) => !next.includes(code))

export const addedCourseMembership = (previous, next) =>
  next.some((code) => !previous.includes(code))
