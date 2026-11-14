import type { SemanaContenido } from './serializeEntregasPlan'

const tieneContenido = (semana: SemanaContenido): boolean =>
  [
    semana.meditacion,
    semana.mantra,
    semana.egregor,
    semana.cma,
    semana.ic,
  ].some((casillero) => casillero !== null)

const semanasConContenido = (plan: ReadonlyArray<SemanaContenido>): number =>
  plan.filter(tieneContenido).length

export { semanasConContenido }
