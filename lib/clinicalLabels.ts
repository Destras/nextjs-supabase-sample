/**
 * Strings de label clínicas centralizadas (D-MC-2)
 *
 * PROVISORIOS — pendiente de un glosario definitivo del equipo de producto.
 * Cuando llegue, se actualiza
 * únicamente este archivo; ningún .tsx de los epics 1 y 3 hardcodea estas cadenas.
 *
 * Todos los componentes que necesiten mostrar el nombre de un mes de tratamiento
 * o de una etapa deben importar desde este módulo en lugar de definir el string
 * localmente.
 */

const MES_LABEL = 'Mes de tratamiento'

// Forma corta para chips/celdas inline ("Mes 2/4", "Mes 1"). Separada de
// MES_LABEL (forma larga de títulos/columnas) para que el glosario del cliente
// pueda mapear ambas sin que ninguna quede hardcodeada en un .tsx.
const MES_SHORT_LABEL = 'Mes'

const ETAPA_LABEL = 'Etapa'

export { MES_LABEL, MES_SHORT_LABEL, ETAPA_LABEL }
