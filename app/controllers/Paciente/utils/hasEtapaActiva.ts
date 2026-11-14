import type { Paciente } from '../PacienteTypes'

/**
 * Whether the paciente currently has an open (active) etapa — started or not.
 *
 * Derived from `etapaActivaId` (Task 0.2, fix for H1): with `fecha_inicio`
 * nullable (DEC-10's escape hatch lets an etapa exist without ever starting),
 * `fechaInicioEtapaActiva === null` stopped meaning "no hay etapa activa" —
 * it can now also mean "hay etapa activa pero todavía no arrancó". Only
 * `etapaActivaId`, the raw pointer to the open etapa set by the mapper
 * regardless of whether it started, still answers this question
 * unambiguously.
 */
const hasEtapaActiva = (paciente: Paciente): boolean =>
  paciente.etapaActivaId !== null

export { hasEtapaActiva }
