/**
 * Chronological anchor of an `etapas_tratamiento` row: its `fecha_inicio`, or
 * — when it never started (`inicioTratamiento`, a closed-never-started etapa
 * is possible: `fecha_inicio null` + `fecha_finalizacion` set) — its
 * `created_at`, collapsed to the calendar day (`.slice(0, 10)`).
 *
 * `fecha_inicio` is a `date` (`'2026-07-13'`); `created_at` is a
 * `timestamptz` (`'2026-07-13T09:00:00+00:00'`). Collapsing the latter to a
 * calendar day is what makes this agree with the SQL's
 * `coalesce(fecha_inicio, created_at::date)` (see `65_alertas.sql` and
 * `62_rpc_admin.sql`) — do not drop the `.slice(0, 10)`.
 *
 * Single source of truth for this rule, consumed by both the `Paciente` and
 * `Tratamiento` entities (etapaOrdinal, mapAsignacionToPaciente,
 * mapAsignacionToPacienteEditData, mapEtapasToHistoria) — kept here (rather
 * than inside either entity's `utils/`) so both can call it directly without
 * crossing into the other entity's internals.
 */
const etapaSortKey = (
  fechaInicio: string | null,
  createdAt: string | null | undefined,
): string => fechaInicio ?? (createdAt ?? '').slice(0, 10)

export { etapaSortKey }
