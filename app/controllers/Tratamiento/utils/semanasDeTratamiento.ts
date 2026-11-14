/**
 * Semanas de contenido por mes de tratamiento (1 mes ≈ 4 semanas). Fuente única
 * del factor: la usan `semanasDeTratamiento` y la timeline del paciente para no
 * re-derivar el "4" en dos lugares.
 */
const SEMANAS_POR_MES = 4

/**
 * Derives the total number of content weeks for a treatment.
 *
 * A treatment spans `cantidad_niveles` months of `SEMANAS_POR_MES` weeks each,
 * one content delivery per week → `cantidad_niveles * SEMANAS_POR_MES` (16 for
 * the standard 4-level treatment). This is the SINGLE source of truth for
 * content weeks.
 *
 * The modality's `cantidad_sesiones` (16/32) is clinical metadata of the therapy
 * team — it is NOT the number of content weeks and never enters this formula.
 * (Confirmed with the product team: they are sessions, not weeks.)
 *
 * Returns null when `cantidadNiveles` is null (incomplete data). 0 is a valid
 * value and is not treated as falsy.
 */
const semanasDeTratamiento = (cantidadNiveles: number | null): number | null =>
  cantidadNiveles === null ? null : cantidadNiveles * SEMANAS_POR_MES

export { semanasDeTratamiento, SEMANAS_POR_MES }
