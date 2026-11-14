export { useFetchTratamientosByPaciente } from './api/useFetchTratamientosByPaciente'
export { useFetchEvaluacionesDelTratamientoActivo } from './api/useFetchEvaluacionesDelTratamientoActivo'
export { useFetchPlanContenidoDelTratamientoActivo } from './api/useFetchPlanContenidoDelTratamientoActivo'
export { useSetEntregasPlan } from './api/useSetEntregasPlan'
export type {
  Tratamiento,
  Nivel,
  Evaluacion,
  EntregaSemanal,
  FraseDerivada,
  FrasesPorSemana,
  SlotKey,
  ColumnKey,
} from './TratamientoTypes'
export type { UseFetchEvaluacionesDelTratamientoActivoResult } from './api/useFetchEvaluacionesDelTratamientoActivo'
export type { UseFetchPlanContenidoDelTratamientoActivoResult } from './api/useFetchPlanContenidoDelTratamientoActivo'
export type {
  UseSetEntregasPlanResult,
  SetEntregasPlanResult,
} from './api/useSetEntregasPlan'
export { TRATAMIENTO_STATE, EtapaStatus } from './TratamientoTypes'
export type {
  SemanaContenido,
  EntregaPlanInsertRow,
} from './utils/serializeEntregasPlan'
export { serializeEntregasPlan } from './utils/serializeEntregasPlan'
export { mapEntregasToSemanas } from './utils/mapEntregasToSemanas'
export {
  SLOT_DEFINITIONS,
  SLOT_KEYS,
  SEMANA_GRID_TEMPLATE,
} from './utils/slotDefinitions'
export { semanasConContenido } from './utils/semanasConContenido'
export { isEtapaCerrada } from './utils/isEtapaCerrada'

export { useFetchHistoriaDelPaciente } from './api/useFetchHistoriaDelPaciente'
export type {
  EtapaHistoria,
  EventoEvolucion,
  TerapeutaResponsable,
} from './TratamientoTypes'
export type { UseFetchHistoriaDelPacienteResult } from './api/useFetchHistoriaDelPaciente'

// ---------------------------------------------------------------------------
// medir-chakras / PR2 — Estructura de centros energéticos (design §4.2)
// ---------------------------------------------------------------------------

export { useFetchEstructuraPaciente } from './api/useFetchEstructuraPaciente'
export { useRegistrarMedicion } from './api/useRegistrarMedicion'
export { useEditarMedicion } from './api/useEditarMedicion'
export { useCerrarEtapaConMedicion } from './api/useCerrarEtapaConMedicion'
export type { UseFetchEstructuraPacienteResult } from './api/useFetchEstructuraPaciente'
export type {
  EstructuraPaciente,
  EtapaEstructura,
  Medicion,
  MedicionHistoria,
  ValorCentro,
  CentroEnergetico,
  MomentoMedicion,
  MedicionNoEditableMotivo,
  CampoMedicion,
  MedicionRpcError,
  MedicionErrorUi,
} from './TratamientoTypes'
export { validarValoresMedicion } from './utils/validarValoresMedicion'
export { erroresVisiblesMedicion } from './utils/erroresVisiblesMedicion'
export { serializeValoresMedicion } from './utils/serializeValoresMedicion'
export { mapMedicionError } from './utils/mapMedicionError'
export { construirCampos } from './utils/construirCampos'
// EstructuraPacienteRaw is never exported — private to mapEstructuraPaciente.ts (Rule 5).
