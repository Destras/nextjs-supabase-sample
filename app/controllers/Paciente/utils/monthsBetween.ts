/**
 * Counts complete calendar months between `desde` (ISO yyyy-mm-dd) and `hasta` (Date).
 *
 * Uses the same day-of-month logic as `computeEdad`: a month is only "complete" once
 * the day-of-month in `hasta` is >= the day-of-month in `desde`. This keeps the
 * month-counting semantics consistent across the codebase.
 */
const monthsBetween = (desde: string, hasta: Date): number => {
  const [dY, dM, dD] = desde.split('-').map(Number)
  // Calendario LOCAL, no UTC: `desde` es una columna `date` (día calendario local)
  // y `hasta` un instante. Leer `hasta` por UTC desfasaba el conteo cerca del cambio
  // de mes en zonas != UTC (el proyecto es UTC-3) → mismo criterio que deriveHeroStats.
  const hY = hasta.getFullYear()
  const hM = hasta.getMonth() + 1
  const hD = hasta.getDate()
  let meses = (hY - dY) * 12 + (hM - dM)
  if (hD < dD) meses -= 1
  return Math.max(0, meses)
}

export { monthsBetween }
