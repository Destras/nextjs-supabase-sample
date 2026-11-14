import type { SemanaContenido } from '@/app/controllers/Tratamiento'
import type { AlfabetoCargado } from '@/app/controllers/Diagnostico'
// Espejo de `estados_paciente` (activo, pausado, baja_voluntaria). Dice si el
// terapeuta sigue atendiendo al paciente, no si tiene un tratamiento en curso
// (término "Paciente activo" de CONTEXT.md).
enum PACIENTE_STATE {
  ACTIVE = 'active',
  PAUSED = 'paused',
  BAJA = 'baja',
}

type Tendencia = 'up' | 'down' | 'flat'

type EstadoCierre = 'finalizada' | 'abandonada'

interface Causa {
  readonly nombre: string
  readonly definicion: string | null
  readonly emocionesEsperadas: string | null
}

interface Bloqueo {
  readonly id: string
  readonly nombre: string
}

interface GeneralInfo {
  readonly telefono: string | null
  readonly email: string | null
  readonly fechaNacimiento: string | null
  readonly edad: number | null
  readonly fechaAlta: string | null
}

interface EvalMes {
  readonly numeroNivel: number
  readonly evaluada: boolean
}

// Cómo está el tratamiento MÁS RECIENTE del paciente (BETA-015). Una etapa abierta
// le gana a las cerradas: 'sin_iniciar' si todavía no arrancó (sin fecha_inicio),
// 'en_curso' con su fecha_inicio. Sin etapa abierta: 'finalizado' si tuvo alguna,
// 'sin_tratamiento' si nunca tuvo. `fecha` solo viene en 'en_curso'.
type EstadoInicioTratamiento =
  | 'sin_iniciar'
  | 'en_curso'
  | 'finalizado'
  | 'sin_tratamiento'

interface InicioTratamiento {
  readonly estado: EstadoInicioTratamiento
  readonly fecha: string | null
}

type AvisoDeInicio = 'bienvenida' | 'con_app' | 'ya_recibida'

interface Paciente {
  readonly id: string
  readonly nombre: string
  readonly nivelFinalizado: boolean
  readonly mesActual: number | null
  readonly mesesTotales: number | null
  readonly etapaOrdinal: number | null
  readonly evaluaciones: ReadonlyArray<EvalMes>
  readonly semanaGlobal: number | null
  readonly semanasTotales: number | null
  readonly fechaInicioEtapaActiva: string | null
  readonly etapaActivaId: string | null
  readonly sinIniciar: boolean
  readonly modalidadResumen: string | null
  readonly causaActual: Causa | null
  readonly bloqueosIdentificados: ReadonlyArray<Bloqueo>
  readonly algoritmoActual: AlgoritmoResumen | null
  readonly alfabetosActuales: ReadonlyArray<AlfabetoCargado>
  readonly ultimoScore: number | null
  readonly tendencia: Tendencia
  readonly tieneAlerta: boolean
  readonly ultimaEvaluacion: string | null
  readonly proximaEvaluacion: string | null
  readonly inicioTratamiento: InicioTratamiento
  // Tiene cuenta (pacientes.user_id vinculado) / ya recibió la bienvenida
  // (pacientes.bienvenida_entregada_at). Alimentan `avisoDeInicio`.
  readonly tieneCuenta: boolean
  readonly bienvenidaRecibida: boolean
  readonly generalInfo: GeneralInfo
  readonly state: PACIENTE_STATE
}

// Paciente del terapeuta cuya etapa activa todavía no arrancó (fecha_inicio
// null, per DEC-6c) — incluye planes a medio cargar, no solo "cero
// entregas_plan". Vista mínima para el dashboard; no es el agregado completo.
// Se obtiene con un fetch dedicado, no por mapAsignacionToPaciente.
interface PacienteSinIniciar {
  readonly id: string
  readonly nombre: string
}

// Nombre y descripción del algoritmo de la etapa activa (tarjeta Diagnóstico).
interface AlgoritmoResumen {
  readonly nombre: string
  readonly definicion: string | null
}

// Fila de `etapa_alfabetos` tal como la lee/escribe la entidad: una por número
// (ADR 0015). Privada de Paciente: no se re-exporta desde el index.
interface EtapaAlfabetoRow {
  readonly alfabeto_id: string
  readonly numero: number
}

interface AlfabetoConNumeros {
  readonly alfabetoId: string
  readonly numeros: ReadonlyArray<number>
}

interface RegisterPacientePayload {
  readonly nombre: string
  readonly fechaNacimiento: string | null
  readonly email: string | null
  readonly telefono: string | null
  readonly causaId: string
  readonly algoritmoId: string
  readonly modalidadId: string
  readonly bloqueoIds: ReadonlyArray<string>
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface RegisterPacienteResult {
  readonly pacienteId: string | null
  readonly error: string | null
}

interface PacienteEditIdentidad {
  readonly nombre: string
  readonly fechaNacimiento: string | null
  readonly email: string | null
  readonly telefono: string | null
}

interface PacienteEditDiagnostico {
  readonly causaId: string | null
  readonly algoritmoId: string | null
  readonly modalidadId: string | null
  readonly bloqueoIds: ReadonlyArray<string>
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface PacienteEditData {
  readonly identidad: PacienteEditIdentidad
  readonly diagnostico: PacienteEditDiagnostico
  readonly etapaId: string | null
  readonly etapaFresca: boolean
  // El paciente ya activó su cuenta (pacientes.user_id vinculado). Con cuenta, el
  // email de la ficha no se puede cambiar desde la edición (BETA-030).
  readonly tieneCuenta: boolean
}

interface UpdatePacienteIdentidadPayload {
  readonly pacienteId: string
  readonly nombre: string
  readonly fechaNacimiento: string | null
  readonly email: string | null
  readonly telefono: string | null
}

interface UpdateEtapaDiagnosticoPayload {
  readonly pacienteId: string
  readonly causaId: string
  readonly algoritmoId: string
  readonly modalidadId: string
  readonly bloqueoIds: ReadonlyArray<string>
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface SetEtapaAlfabetosPayload {
  readonly pacienteId: string
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface UpdatePacienteResult {
  readonly error: string | null
}

interface CerrarEtapaPayload {
  readonly pacienteId: string
  readonly estado: EstadoCierre
  readonly motivo: string | null
}

interface IniciarTratamientoPayload {
  readonly etapaId: string
  readonly semanas: ReadonlyArray<SemanaContenido> | null
}

type EstadoBienvenida = 'enviada' | 'innecesaria' | 'fallida' | 'desconocida'

type ResultadoReenvio = 'enviada' | 'innecesaria' | 'error'

type ErrorDeInicio =
  | 'etapa_cerrada'
  | 'paciente_dado_de_baja'
  | 'semana_pasada'
  | 'desconocido'

interface IniciarTratamientoResult {
  readonly ok: boolean
  readonly error: ErrorDeInicio | null
  readonly iniciado: boolean
  readonly bienvenida: EstadoBienvenida
}

interface IniciarNuevaEtapaPayload {
  readonly pacienteId: string
  readonly causaId: string
  readonly algoritmoId: string
  readonly modalidadId: string
  readonly bloqueoIds: ReadonlyArray<string>
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface IniciarNuevaEtapaResult {
  readonly etapaId: string | null
  readonly error: string | null
}

interface TelefonoEnOtraFichaResult {
  readonly enOtraFicha: boolean
  readonly error: string | null
}

// La ficha que ya tiene un email, tal como la dejan ver las RLS al que pregunta
// (ADR 0010). `dadoDeBaja` = su estado es `baja_voluntaria`. `accesible` = quien
// pregunta ve una asignación abierta, o sea que `/pacientes/[id]` le abre el detalle
// (con la asignación cerrada la ficha se encuentra, pero el detalle da "sin acceso").
interface FichaPorEmail {
  readonly id: string
  readonly nombre: string
  readonly dadoDeBaja: boolean
  readonly accesible: boolean
}

interface BuscarFichaPorEmailResult {
  readonly ficha: FichaPorEmail | null
  readonly error: string | null
}

export type {
  AvisoDeInicio,
  AlfabetoConNumeros,
  AlgoritmoResumen,
  EtapaAlfabetoRow,
  BuscarFichaPorEmailResult,
  CerrarEtapaPayload,
  ErrorDeInicio,
  EstadoBienvenida,
  EstadoCierre,
  EstadoInicioTratamiento,
  FichaPorEmail,
  EvalMes,
  GeneralInfo,
  IniciarNuevaEtapaPayload,
  IniciarNuevaEtapaResult,
  IniciarTratamientoPayload,
  IniciarTratamientoResult,
  InicioTratamiento,
  Paciente,
  PacienteSinIniciar,
  PacienteEditData,
  PacienteEditDiagnostico,
  PacienteEditIdentidad,
  RegisterPacientePayload,
  RegisterPacienteResult,
  ResultadoReenvio,
  TelefonoEnOtraFichaResult,
  SetEtapaAlfabetosPayload,
  Tendencia,
  UpdateEtapaDiagnosticoPayload,
  UpdatePacienteIdentidadPayload,
  UpdatePacienteResult,
}
export { PACIENTE_STATE }
