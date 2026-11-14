import type {
  EvalMes,
  InicioTratamiento,
  Paciente,
  Tendencia,
} from '../PacienteTypes'
import { PACIENTE_STATE } from '../PacienteTypes'
import { computeEdad } from './computeEdad'
import { mesActual as computeMesActual } from './mesActual'
import { semanaActual } from './semanaActual'
import { etapaOrdinal as computeEtapaOrdinal } from './etapaOrdinal'
import { semanasDeTratamiento } from '@/app/controllers/Tratamiento/utils/semanasDeTratamiento'
import { alfabetosCargadosDeEmbed } from '@/app/controllers/Diagnostico'
import type { EtapaAlfabetoEmbed } from '@/app/controllers/Diagnostico'
import { etapaSortKey } from '@/app/utils/etapaSortKey'
import { hoyFechaDia } from '@/app/utils/fechaDia'

interface EvaluacionRaw {
  id: string
  score: number
  fecha_respuesta: string
}

interface NivelRaw {
  id: string
  numero_nivel: number
  fecha_seguimiento_esperada: string | null
  fecha_seguimiento_real: string | null
  nivel_evaluacion: EvaluacionRaw | null
}

interface BloqueoRaw {
  id: string
  nombre: string
}

interface EtapaBloqueoRaw {
  bloqueos: BloqueoRaw | null
}

interface CausaRaw {
  nombre: string
  definicion: string | null
  emociones_esperadas: string | null
}

interface AlgoritmoRaw {
  nombre: string
  definicion: string | null
}

interface ModalidadRaw {
  cantidad_niveles: number
  cantidad_sesiones: number | null
  tipos_disco: { nombre: string } | null
}

interface EtapaRaw {
  id: string
  fecha_inicio: string | null
  created_at: string
  fecha_finalizacion: string | null
  causas: CausaRaw | null
  modalidades: ModalidadRaw | null
  algoritmos: AlgoritmoRaw | null
  etapa_alfabetos: ReadonlyArray<EtapaAlfabetoEmbed>
  etapa_bloqueos: EtapaBloqueoRaw[]
  niveles: NivelRaw[]
}

interface AsignacionRaw {
  id: string
  pacientes: {
    id: string
    nombre: string
    telefono: string | null
    email: string | null
    fecha_nacimiento: string | null
    fecha_alta: string | null
    user_id: string | null
    bienvenida_entregada_at: string | null
    estados_paciente?: { codigo: string } | null
    etapas_tratamiento: EtapaRaw[]
  } | null
}

// Código de `estados_paciente` → estado del dominio. En un Map y no en un objeto
// literal: indexar un objeto con un código que viene de la base recorre
// Object.prototype ('constructor', 'toString'…) y devuelve basura.
const ESTADO_POR_CODIGO: ReadonlyMap<string, PACIENTE_STATE> = new Map([
  ['activo', PACIENTE_STATE.ACTIVE],
  ['pausado', PACIENTE_STATE.PAUSED],
  ['baja_voluntaria', PACIENTE_STATE.BAJA],
])

// Sin estado (hueco de datos) o con un código que no conocemos, cae a ACTIVE: es
// el default de la tabla y no hay razón para esconder al paciente.
const resolveState = (codigo: string | undefined): PACIENTE_STATE =>
  (codigo === undefined ? undefined : ESTADO_POR_CODIGO.get(codigo)) ??
  PACIENTE_STATE.ACTIVE

const computeTendencia = (
  evalsAsc: ReadonlyArray<EvaluacionRaw>,
): Tendencia => {
  if (evalsAsc.length < 2) return 'flat'
  const last = evalsAsc[evalsAsc.length - 1].score
  const prev = evalsAsc[evalsAsc.length - 2].score
  if (last > prev) return 'up'
  if (last < prev) return 'down'
  return 'flat'
}

// BETA-015: el inicio habla del tratamiento MÁS RECIENTE. La etapa abierta manda
// (un tratamiento nuevo sin arrancar le gana al cerrado); sin etapa abierta,
// alcanza con saber si alguna vez hubo una.
const deriveInicioTratamiento = (
  etapaActiva: EtapaRaw | null,
  tieneEtapas: boolean,
): InicioTratamiento => {
  if (etapaActiva !== null) {
    return etapaActiva.fecha_inicio === null
      ? { estado: 'sin_iniciar', fecha: null }
      : { estado: 'en_curso', fecha: etapaActiva.fecha_inicio }
  }
  return tieneEtapas
    ? { estado: 'finalizado', fecha: null }
    : { estado: 'sin_tratamiento', fecha: null }
}

const mapAsignacionToPaciente = (
  raw: AsignacionRaw,
  today: Date = new Date(),
): Paciente => {
  const etapas = raw.pacientes?.etapas_tratamiento ?? []
  // Etapa activa = la abierta (fecha_finalizacion null) más reciente por
  // fecha_inicio, con desempate determinista por id desc. Alinea con el RPC
  // (order by fecha_inicio desc) en vez de depender del orden de fetch.
  const etapaActiva =
    etapas
      .filter((e) => e.fecha_finalizacion === null)
      .sort(
        (a, b) =>
          etapaSortKey(b.fecha_inicio, b.created_at).localeCompare(
            etapaSortKey(a.fecha_inicio, a.created_at),
          ) || b.id.localeCompare(a.id),
      )[0] ?? null

  const nivelesActivos = etapaActiva?.niveles ?? []

  // Task 0.3 additions ────────────────────────────────────────────────────────

  const etapaActivaId = etapaActiva?.id ?? null

  // mesesTotales (eje temporal en meses) === cantidad_niveles de la modalidad:
  // un mismo valor. Se expone como `mesesTotales` en el agregado pero se computa
  // una sola vez acá.
  const cantidadNiveles = etapaActiva?.modalidades?.cantidad_niveles ?? null

  const mesActual = computeMesActual(
    etapaActiva !== null &&
      cantidadNiveles !== null &&
      etapaActiva.fecha_inicio !== null
      ? { fechaInicio: etapaActiva.fecha_inicio, cantidadNiveles }
      : null,
    today,
  )

  // etapaOrdinal sorts by fechaInicio ?? createdAt (coalesce, DEC-E0-1),
  // reading the real `created_at` column (Task 0.3) — never the fecha_inicio
  // stopgap Task 0.2 left in place, which would crash (`.slice` on null) or
  // rank a closed-never-started etapa (DEC-11) after ones that did start.
  const etapaOrdinal = computeEtapaOrdinal(
    etapas.map((e) => ({
      id: e.id,
      fechaInicio: e.fecha_inicio,
      createdAt: e.created_at,
    })),
    etapaActivaId,
  )

  // DEC-02: evaluaciones has fixed length = cantidadNiveles (from the active
  // etapa's modalidad). Each slot is set to evaluada=true iff the nivel row
  // for that numero_nivel has nivel_evaluacion != null. Missing rows → false.
  const evaluaciones: ReadonlyArray<EvalMes> =
    etapaActiva !== null && cantidadNiveles !== null
      ? Array.from({ length: cantidadNiveles }, (_, i) => {
          const numeroNivel = i + 1
          const nivelRow = nivelesActivos.find(
            (n) => n.numero_nivel === numeroNivel,
          )
          return {
            numeroNivel,
            evaluada: nivelRow?.nivel_evaluacion != null,
          }
        })
      : []

  // DEC-05 (refinado, code review): re-derive nivelFinalizado from etapa
  // presence + evaluaciones.
  // - sin NINGUNA etapa (nunca arrancó) → false: no se puede "finalizar" algo
  //   que nunca empezó (antes daba true y mostraba "Finalizado" sin tratamiento).
  // - etapas presentes pero ninguna activa → ciclo cerrado → true.
  // - etapa activa → true solo cuando mesActual alcanzó cantidadNiveles y toda
  //   evaluación está hecha.
  const nivelFinalizado =
    etapas.length > 0 &&
    (etapaActiva === null ||
      (mesActual !== null &&
        cantidadNiveles !== null &&
        mesActual === cantidadNiveles &&
        evaluaciones.every((e) => e.evaluada)))

  // semanasTotales = cantidad_niveles * 4 (misma fuente única que la entidad
  // Tratamiento). Las "sesiones" de la modalidad (16/32) son metadata clínica del
  // equipo terapéutico, NO nuestras semanas de contenido. Ver semanasDeTratamiento.
  const semanasTotales = semanasDeTratamiento(cantidadNiveles)

  // Guard BEFORE constructing the Date: new Date(null) resolves to epoch
  // 1970, which would make semanaGlobal a huge number and, once capped by
  // Math.min below, falsely read as "última semana" for a paciente who never
  // started (bug killed by Task 0.3).
  //
  // Mismo util que alimenta mesActual (ADR 0011): mes = ceil(semana / 4), así
  // que "Mes N · Semana M" nunca pueden desalinearse.
  //
  // Piso en 1 (BETA-031, ADR 0012): si hay fecha_inicio el tratamiento arrancó,
  // así que la semana nunca es 0 ni negativa. Una fecha_inicio "futura" solo
  // aparece en filas guardadas cuando la base contaba el día en UTC (un plan
  // completado después de las 21:00 arrancaba "mañana").
  const semanaGlobalRaw =
    etapaActiva !== null && etapaActiva.fecha_inicio !== null
      ? Math.max(1, semanaActual(etapaActiva.fecha_inicio, today))
      : null

  const semanaGlobal =
    semanaGlobalRaw !== null && semanasTotales !== null
      ? Math.min(semanaGlobalRaw, semanasTotales)
      : semanaGlobalRaw

  const fechaInicioEtapaActiva = etapaActiva?.fecha_inicio ?? null

  // sinIniciar: hay una etapa abierta (etapaActivaId !== null) pero todavía
  // no arrancó (fechaInicioEtapaActiva === null). Derivado una sola vez acá
  // (per DEC-E0-4) para que las 4 vistas consumidoras no repitan la expresión.
  const sinIniciar = etapaActivaId !== null && fechaInicioEtapaActiva === null

  const modalidad = etapaActiva?.modalidades ?? null
  const tipoDiscoCorto =
    modalidad?.tipos_disco?.nombre.replace(/^Disco\s+/i, '') ?? null
  const modalidadResumen =
    modalidad?.cantidad_sesiones != null && tipoDiscoCorto !== null
      ? `${modalidad.cantidad_sesiones} discos de ${tipoDiscoCorto}`
      : null

  const causaActual = etapaActiva?.causas
    ? {
        nombre: etapaActiva.causas.nombre,
        definicion: etapaActiva.causas.definicion,
        emocionesEsperadas: etapaActiva.causas.emociones_esperadas,
      }
    : null

  const bloqueosIdentificados = (etapaActiva?.etapa_bloqueos ?? [])
    .map((eb) => eb.bloqueos)
    .filter((b): b is BloqueoRaw => b !== null)

  const algoritmoActual = etapaActiva?.algoritmos
    ? {
        nombre: etapaActiva.algoritmos.nombre,
        definicion: etapaActiva.algoritmos.definicion,
      }
    : null

  const alfabetosActuales = alfabetosCargadosDeEmbed(
    etapaActiva?.etapa_alfabetos ?? [],
  )

  const evalsAsc = etapas
    .flatMap((e) => e.niveles)
    .map((n) => n.nivel_evaluacion)
    .filter((e): e is EvaluacionRaw => e !== null)
    .sort((a, b) => a.fecha_respuesta.localeCompare(b.fecha_respuesta))

  const ultimoEval = evalsAsc.at(-1) ?? null
  const ultimaEvaluacion = ultimoEval?.fecha_respuesta ?? null
  const ultimoScore = ultimoEval?.score ?? null
  const tendencia = computeTendencia(evalsAsc)
  // El mapper NO puede decidir esto: la entidad se arma desde
  // asignaciones_paciente y no ve el motor de alertas. Aproximarlo con el score
  // fallaba en las dos direcciones (no veía mes_3/fin/eval_vencida, y seguía
  // marcando al paciente cuya alerta ya fue atendida). Lo resuelve
  // marcarAlertas() con las alertas reales; acá arranca en false.
  const tieneAlerta = false

  // Día contra día, como strings: `new Date('yyyy-MM-dd')` es medianoche UTC, o
  // sea las 21:00 de la víspera en Argentina, y la próxima evaluación desaparecía
  // esa noche (BETA-017). Estricto, igual que el RPC (> current_date).
  const hoy = hoyFechaDia(today)
  const proximaEvaluacion =
    etapaActiva?.niveles
      .map((n) => n.fecha_seguimiento_esperada)
      .filter((d): d is string => d !== null && d > hoy)
      .sort()[0] ?? null

  const fechaNacimiento = raw.pacientes?.fecha_nacimiento ?? null

  return {
    id: raw.pacientes?.id ?? raw.id,
    nombre: raw.pacientes?.nombre ?? '',
    nivelFinalizado,
    mesActual,
    mesesTotales: cantidadNiveles,
    etapaOrdinal,
    evaluaciones,
    semanaGlobal,
    semanasTotales,
    fechaInicioEtapaActiva,
    etapaActivaId,
    sinIniciar,
    modalidadResumen,
    causaActual,
    bloqueosIdentificados,
    algoritmoActual,
    alfabetosActuales,
    ultimoScore,
    tendencia,
    tieneAlerta,
    ultimaEvaluacion,
    proximaEvaluacion,
    inicioTratamiento: deriveInicioTratamiento(etapaActiva, etapas.length > 0),
    tieneCuenta: (raw.pacientes?.user_id ?? null) !== null,
    bienvenidaRecibida:
      (raw.pacientes?.bienvenida_entregada_at ?? null) !== null,
    generalInfo: {
      telefono: raw.pacientes?.telefono ?? null,
      email: raw.pacientes?.email ?? null,
      fechaNacimiento,
      edad: computeEdad(fechaNacimiento, today),
      fechaAlta: raw.pacientes?.fecha_alta ?? null,
    },
    state: resolveState(raw.pacientes?.estados_paciente?.codigo),
  }
}

export type { AsignacionRaw }
export { mapAsignacionToPaciente }
