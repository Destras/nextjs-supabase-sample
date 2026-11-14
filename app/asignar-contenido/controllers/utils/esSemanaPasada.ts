/**
 * Una semana "ya pasó" cuando es anterior a la semana en curso del
 * tratamiento. Con el tratamiento sin iniciar (`semanaEnCurso === null`)
 * ninguna semana está bloqueada.
 */
const esSemanaPasada = (
  semana: number,
  semanaEnCurso: number | null,
): boolean => semanaEnCurso !== null && semana < semanaEnCurso

export { esSemanaPasada }
