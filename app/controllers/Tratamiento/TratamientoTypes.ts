import type {
  Diagnostico,
  AlfabetoCargado,
} from '@/app/controllers/Diagnostico'
import type { Contenido } from '@/app/controllers/Contenido'

enum TRATAMIENTO_STATE {
  ACTIVO = 'activo',
  FINALIZADO = 'finalizado',
  SUSPENDIDO = 'suspendido',
}

enum EtapaStatus {
  PENDIENTE = 'pendiente',
  EN_CURSO = 'en_curso',
  FINALIZADA = 'finalizada',
  ABANDONADA = 'abandonada',
}

interface Evaluacion {
  readonly id: string
  readonly score: number
  readonly fechaRespuesta: string
}

interface Nivel {
  readonly id: string
  readonly numeroNivel: number
  // Null when the etapa has not started yet (register_paciente creates the
  // niveles grid before fecha_inicio is set — DEC-3, inicioTratamiento).
  readonly fechaSeguimientoEsperado: string | null
  readonly fechaSeguimientoReal: string | null
  readonly observaciones: string | null
  readonly evaluacion: Evaluacion | null
}

interface FraseDerivada {
  readonly orden: number
  readonly origen: 'causa' | 'algoritmo'
  readonly texto: string
}

interface EntregaSemanal {
  readonly id: string
  readonly numeroSemana: number
  readonly fechaEntregada: string | null
  readonly fechaEntregaEsperada: string | null
  readonly contenido: ReadonlyArray<Contenido>
}

// Frases derivadas de la etapa activa, indexadas por número de semana —
// disponibles para TODAS las semanas de la etapa (frasesAutomaticas/epic-1,
// Task 1.2), independientemente de si esa semana ya tiene contenido cargado en
// entregas_plan. Única fuente de las frases derivadas (frasesAutomaticas/
// FRA-005): el campo `EntregaSemanal.frases` que existía antes de este fix
// era un duplicado muerto — nunca lo leyó ningún consumidor de producción, y
// además solo cubría semanas con contenido cargado (el gap que esta widening
// vino a resolver). Se borró; este tipo es la única forma de leer "las frases
// de la semana N".
type FrasesPorSemana = Readonly<Record<number, ReadonlyArray<FraseDerivada>>>

// Las 5 columnas persistibles del grid semanal — lo que se escribe en
// `entregas_plan`. Debe espejar el orden 1..5 de SLOT_DEFINITIONS
// (slotDefinitions.ts) y el mapa tipo-por-orden de public.set_entregas_plan
// (71_rpcs_pacientes.sql, DEC-8).
type SlotKey = 'meditacion' | 'mantra' | 'egregor' | 'cma' | 'ic'

// Las 6 columnas del grid — los 5 slots persistibles más la columna
// read-only y automática de "frases". Todo SlotKey es un ColumnKey, pero no
// todo ColumnKey es persistible: `'frases'` es solo de visualización,
// derivada server-side, nunca escrita a través de este módulo.
type ColumnKey = SlotKey | 'frases'

interface Tratamiento {
  readonly id: string
  // Null when the etapa exists but has not started yet (fecha_inicio is set
  // only when set_entregas_plan completes the content plan — DEC-3,
  // inicioTratamiento). Not the same as "no treatment" — see
  // mapEtapaToTratamiento.
  readonly fechaInicio: string | null
  readonly fechaFin: string | null
  readonly diagnostico: Diagnostico
  readonly estado: TRATAMIENTO_STATE
  readonly niveles: ReadonlyArray<Nivel>
  readonly entregasSemanales: ReadonlyArray<EntregaSemanal>
}

interface TerapeutaResponsable {
  readonly terapeutaId: string
  readonly nombre: string
}

type EventoEvolucion =
  | {
      readonly tipo: 'nivel'
      readonly fecha: string
      readonly numeroNivel: number
      readonly score: number | null
      readonly deltaScore: number | null
    }
  | {
      readonly tipo: 'cambio_terapeuta'
      readonly fecha: string
      readonly de: string
      readonly a: string
      readonly motivo: string | null
    }
  | {
      readonly tipo: 'medicion'
      readonly fecha: string
      readonly medicionId: string
      readonly momento: MomentoMedicion
      readonly estructuraGeneral: number
      readonly deltaEstructura: number | null
    }

interface EtapaHistoria {
  readonly id: string
  readonly status: EtapaStatus
  readonly fechaInicio: string | null
  readonly fechaFin: string | null
  readonly diagnostico: Diagnostico
  readonly modalidad: {
    readonly nombre: string
    readonly cantidadNiveles: number
    readonly duracionMesesEstimada: number | null
  } | null
  readonly responsables: ReadonlyArray<TerapeutaResponsable>
  readonly eventos: ReadonlyArray<EventoEvolucion>
  readonly duracionMeses: number | null
  readonly deltaScoreEtapa: {
    readonly primero: number
    readonly ultimo: number
  } | null
  readonly motivoCierre: string | null
  readonly proximaEvaluacion: string | null
  // Alfabetos cargados en ESTA etapa (no los de la etapa activa).
  readonly alfabetos: ReadonlyArray<AlfabetoCargado>
  // Structure-measurement history for this etapa, added in medir-chakras/PR2.
  // Read via PostgREST (fetchHistoriaDelPaciente), where `editable`,
  // `motivoNoEditable`, `esPropia` and the author's *name* (only a bare uuid
  // is available) do not exist server-side. Deliberately a SEPARATE type from
  // `Medicion` (design §4.1, R6) — unifying them would force this mapper to
  // invent an authorization flag it has no way to compute correctly.
  readonly mediciones: ReadonlyArray<MedicionHistoria>
}

// ---------------------------------------------------------------------------
// medir-chakras / PR2 — Estructura de centros energéticos (design §4.1)
// ---------------------------------------------------------------------------

type MomentoMedicion =
  | 'apertura'
  | 'seguimiento'
  | 'cierre'
  | 'cierre_automatico'

type MedicionNoEditableMotivo =
  | 'automatica'
  | 'otro_terapeuta'
  | 'no_es_ultima'
  | 'etapa_posterior_iniciada'
  | 'sin_asignacion'

interface CentroEnergetico {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly etiquetaPaciente: string
  readonly orden: number
}

interface ValorCentro {
  readonly centroId: string
  readonly codigo: string
  readonly nombre: string
  readonly orden: number
  readonly activo: boolean
  readonly valor: number
  // vs. la medición anterior de la MISMA etapa. `null` cuando no hay
  // baseline (primera medición del centro) o cuando la medición completa
  // suprime deltas (apertura / cierre_automatico — ver Medicion.deltaEstructura).
  readonly delta: number | null
}

interface Medicion {
  readonly id: string
  readonly etapaId: string
  readonly momento: MomentoMedicion
  readonly estructuraGeneral: number
  // `null` para la primera medición de la etapa y para `cierre_automatico`
  // (es una copia, no una lectura nueva — mostrar un delta ahí sería
  // engañoso). Derivado en mapEstructuraPaciente, nunca enviado por el RPC
  // (design §1.5 / §8.1: "derivado, nunca almacenado").
  readonly deltaEstructura: number | null
  readonly registradaEn: string
  readonly autor: { readonly id: string; readonly nombre: string } | null
  readonly copiadaDe: string | null
  readonly esPropia: boolean
  readonly editable: boolean
  readonly motivoNoEditable: MedicionNoEditableMotivo | null
  readonly valores: ReadonlyArray<ValorCentro>
}

interface EtapaEstructura {
  readonly id: string
  readonly ordinal: number
  readonly fechaInicio: string | null
  readonly fechaFin: string | null
  readonly estado: EtapaStatus
  readonly iniciada: boolean
  readonly mediciones: ReadonlyArray<Medicion>
  // Derivada: la última medición de `mediciones` (nunca enviada por el RPC).
  readonly medicionActual: Medicion | null
}

interface EstructuraPaciente {
  readonly pacienteId: string
  readonly puedeMedir: boolean
  readonly esAdmin: boolean
  readonly centrosActivos: ReadonlyArray<CentroEnergetico>
  readonly etapas: ReadonlyArray<EtapaEstructura>
}

interface CampoMedicion {
  readonly key: string
  readonly label: string
  // `null` = estructura general; de lo contrario, el id del centro.
  readonly centroId: string | null
  readonly valorAnterior: number | null
}

// Proyección de una medición vía PostgREST (Historia). Ver el comentario en
// `EtapaHistoria.mediciones` arriba — deliberadamente distinta de `Medicion`.
interface MedicionHistoria {
  readonly id: string
  readonly momento: MomentoMedicion
  readonly estructuraGeneral: number
  readonly deltaEstructura: number | null
  readonly registradaEn: string
  // `null` ⇒ "Sistema" (cierre_automatico, registrada_por es null).
  readonly autorNombre: string | null
  readonly valores: ReadonlyArray<{
    readonly centroId: string
    readonly valor: number
  }>
}

// Envelope preservado del error crudo de Postgres/PostgREST para las 3 RPC de
// escritura de mediciones. A diferencia de
// `Paciente/api/callUpdateRpc.ts:15` (colapsa a `{ error: error.message }`,
// destruyendo `error.code`), este tipo preserva {code, message, details,
// hint} completos — necesario para que mapMedicionError distinga PT409 de
// 22023 y para el switch por `message` (no por `code`, sobrecargado en
// 42501 — ver design §4.3, R2).
interface MedicionRpcError {
  readonly code: string
  readonly message: string
  readonly details: string | null
  readonly hint: string | null
}

interface MedicionMutationResult<T> {
  readonly data: T | null
  readonly error: MedicionRpcError | null
}

interface MedicionErrorUi {
  readonly mensaje: string
  // 'estructura_general' | centroId | null (null = error a nivel de conjunto).
  readonly campo: string | null
  // true SOLO para PT409 (conflicto_medicion) — la UI debe refetchear.
  readonly debeRefetchear: boolean
}

export type {
  Tratamiento,
  Nivel,
  Evaluacion,
  EntregaSemanal,
  FraseDerivada,
  FrasesPorSemana,
  SlotKey,
  ColumnKey,
  TerapeutaResponsable,
  EventoEvolucion,
  EtapaHistoria,
  MomentoMedicion,
  MedicionNoEditableMotivo,
  CentroEnergetico,
  ValorCentro,
  Medicion,
  EtapaEstructura,
  EstructuraPaciente,
  CampoMedicion,
  MedicionHistoria,
  MedicionRpcError,
  MedicionMutationResult,
  MedicionErrorUi,
}
export { TRATAMIENTO_STATE, EtapaStatus }
