import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import type { HeroStats } from '../dashboardTypes'
import { deriveScorePromedio } from './deriveScorePromedio'

// Mes calendario LOCAL: fechaAlta es un date sin tz (día calendario) y "este
// mes" es el mes del terapeuta que mira el dashboard. Usar UTC desfasaba el
// conteo cerca del cambio de mes en zonas != UTC (el proyecto es UTC-3), e iba
// en contra de buildSaludo, que también lee la hora local.
const yearMonth = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Heroes del terapeuta: T1 activos, T2 nuevos este mes (Tier A) + score
// promedio del caseload (Tier B, reusa deriveScorePromedio). "Con alerta" se
// saca del hero (la campana global ya cubre ese número con los 4 tipos reales).
const deriveHeroStats = (
  pacientes: ReadonlyArray<Paciente>,
  now: Date,
): HeroStats => {
  const activos = pacientes.filter(
    (p) => p.state === PACIENTE_STATE.ACTIVE,
  ).length

  const nowYm = yearMonth(now)
  const nuevosEsteMes = pacientes.filter(
    (p) =>
      p.generalInfo.fechaAlta != null &&
      p.generalInfo.fechaAlta.slice(0, 7) === nowYm,
  ).length

  const scorePromedio = deriveScorePromedio(pacientes)

  return { activos, nuevosEsteMes, scorePromedio }
}

export { deriveHeroStats }
