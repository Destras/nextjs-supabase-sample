const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Semana de contenido en curso (1-based) contada desde el arranque del
 * tratamiento: cada bloque de 7 días desde `fechaInicio`; la semana 1 empieza
 * el día del arranque (ver "Semana de contenido" en CONTEXT.md).
 *
 * - Cuenta días de calendario LOCAL: `fechaInicio` es una columna `date` (día
 *   local) y `hoy` un instante; leer `hoy` por UTC adelantaba la semana a la
 *   noche en zonas != UTC (el proyecto es UTC-3).
 * - No topea ni piso ni techo: devuelve 0 o negativo si `fechaInicio` es
 *   futura, y sigue creciendo pasado el final del plan. Cada consumidor decide
 *   su tope (`mesActual`, `semanaGlobal`): los dos ponen el piso en 1.
 *
 * Es la única fuente de la que salen la semana y el mes de tratamiento
 * (ADR 0011: un mes de tratamiento son 4 semanas).
 */
const semanaActual = (fechaInicio: string, hoy: Date): number => {
  const [y, m, d] = fechaInicio.slice(0, 10).split('-').map(Number)
  // Date.UTC sobre los componentes locales: la resta da días enteros exactos,
  // sin que un cambio de horario (DST) corra el resultado por una hora.
  const inicio = Date.UTC(y, m - 1, d)
  const actual = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const dias = Math.round((actual - inicio) / MS_PER_DAY)
  return Math.floor(dias / 7) + 1
}

export { semanaActual }
