import type {
  EtapaHistoria,
  TerapeutaResponsable,
  EventoEvolucion,
  MedicionHistoria,
  MomentoMedicion,
} from '../TratamientoTypes'
import { EtapaStatus } from '../TratamientoTypes'
import { alfabetosCargadosDeEmbed } from '@/app/controllers/Diagnostico'
import type { EtapaAlfabetoEmbed } from '@/app/controllers/Diagnostico'
import { parseEmocionesEsperadas } from '@/app/controllers/Diagnostico/utils/mapCausaRow'
import { truncateComportamiento } from '@/app/controllers/Diagnostico/utils/mapAlgoritmoRow'
import { etapaSortKey } from '@/app/utils/etapaSortKey'
import { diaDeInstante, hoyFechaDia } from '@/app/utils/fechaDia'

// ---------------------------------------------------------------------------
// Private raw row types — never exported from the barrel
// ---------------------------------------------------------------------------

interface CausaRaw {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly definicion: string | null
  readonly emociones_esperadas: string | null
  readonly activo: boolean
}

interface AlgoritmoRaw {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly definicion: string | null
  readonly comportamiento: string | null
  readonly activo: boolean
}

interface BloqueoRaw {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly descripcion: string | null
  readonly activo: boolean
}

interface NivelEvaluacionRaw {
  readonly id: string
  readonly score: number
  readonly fecha_respuesta: string
}

interface NivelRaw {
  readonly id: string
  readonly numero_nivel: number
  readonly fecha_seguimiento_esperada: string | null
  readonly nivel_evaluacion: NivelEvaluacionRaw | null
}

interface ModalidadRaw {
  readonly nombre: string
  readonly cantidad_niveles: number
  readonly duracion_meses_estimada: number | null
}

interface MedicionValorRaw {
  readonly centro_id: string
  readonly valor: number
}

// PostgREST embed of mediciones_estructura (design §4.4). `registrada_por`
// stays a bare uuid here (unlike get_estructura_paciente's jsonb, which
// resolves it to {id, nombre}) — the `profiles(nombre)` embed is a SEPARATE
// join, present only when registrada_por is not null.
interface MedicionHistoriaRaw {
  readonly id: string
  readonly momento: string
  readonly estructura_general: number
  readonly registrada_en: string
  readonly registrada_por: string | null
  readonly profiles: { readonly nombre: string } | null
  readonly medicion_valores: ReadonlyArray<MedicionValorRaw>
}

interface EtapaHistoriaRaw {
  readonly id: string
  readonly fecha_inicio: string | null
  readonly fecha_finalizacion: string | null
  readonly motivo_cierre: string | null
  readonly estados_etapa: { readonly codigo: string } | null
  readonly created_at: string
  readonly causas: CausaRaw | null
  readonly algoritmos: AlgoritmoRaw | null
  readonly etapa_bloqueos: ReadonlyArray<{
    readonly bloqueos: BloqueoRaw | null
  }>
  readonly etapa_alfabetos: ReadonlyArray<EtapaAlfabetoEmbed>
  readonly niveles: ReadonlyArray<NivelRaw>
  readonly modalidades: ModalidadRaw | null
  readonly mediciones_estructura: ReadonlyArray<MedicionHistoriaRaw>
}

interface AsignacionRaw {
  readonly id: string
  readonly terapeuta_id: string
  readonly fecha_desde: string
  readonly fecha_hasta: string | null
  readonly motivo: string | null
  readonly terapeutas: {
    readonly id: string
    readonly profiles: { readonly nombre: string } | null
  } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EventoConClave {
  readonly clave: string
  readonly evento: EventoEvolucion
}

const resolveStatus = (codigo: string | undefined): EtapaStatus => {
  if (codigo === 'pendiente') return EtapaStatus.PENDIENTE
  if (codigo === 'activa') return EtapaStatus.EN_CURSO
  if (codigo === 'finalizada') return EtapaStatus.FINALIZADA
  if (codigo === 'abandonada') return EtapaStatus.ABANDONADA
  return EtapaStatus.EN_CURSO
}

const daysBetween = (from: string, to: string): number => {
  const msPerDay = 1000 * 60 * 60 * 24
  return (new Date(to).getTime() - new Date(from).getTime()) / msPerDay
}

// A timestamptz ('2026-09-21T17:40:35.740526+00:00') collapsed to its
// calendar day IN ARGENTINA (ADR 0012, BETA-040) — the same day the Estructura
// tab renders through `formatDate`, so both surfaces show the same date. The
// slice is only the fallback for a value that is not a parseable instant.
const toFechaDia = (timestamp: string): string =>
  diaDeInstante(timestamp) ?? timestamp.slice(0, 10)

const rangesOverlap = (
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
  todayStr: string,
): boolean => {
  const aEndStr = aEnd ?? todayStr
  const bEndStr = bEnd ?? todayStr
  // [aStart, aEndStr] overlaps [bStart, bEndStr] iff aStart <= bEndStr && bStart <= aEndStr
  return aStart <= bEndStr && bStart <= aEndStr
}

// `apertura` and `cierre_automatico` never show a delta — same rule as
// mapEstructuraPaciente.ts (medir-chakras design §4.1): apertura has no
// baseline, and cierre_automatico is a COPY of the last real reading, not a
// new measurement.
const suppressesDeltaHistoria = (momento: string): boolean =>
  momento === 'apertura' || momento === 'cierre_automatico'

// Maps the mediciones_estructura embed to MedicionHistoria, deliberately
// separate from Medicion (R6 — see the comment on EtapaHistoria.mediciones
// in TratamientoTypes.ts). Sorted ascending by (registrada_en, id) — the
// same total order get_estructura_paciente guarantees — so the delta chain
// and the emitted timeline events are deterministic.
// Each medición travels with its full-precision `registrada_en`: the
// emitted `registradaEn` is date-only (MED-004), but the timeline sort needs
// the timestamp so same-day events keep their real order.
interface MedicionConTimestamp {
  readonly medicion: MedicionHistoria
  readonly timestamp: string
}

const mapMedicionesHistoria = (
  medicionesRaw: ReadonlyArray<MedicionHistoriaRaw>,
): ReadonlyArray<MedicionConTimestamp> => {
  const sorted = [...medicionesRaw].sort((a, b) => {
    if (a.registrada_en !== b.registrada_en) {
      return a.registrada_en < b.registrada_en ? -1 : 1
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  return sorted.map((raw, index) => {
    const previous = index > 0 ? sorted[index - 1] : null
    const suppress = previous === null || suppressesDeltaHistoria(raw.momento)
    const deltaEstructura = suppress
      ? null
      : raw.estructura_general - previous!.estructura_general

    const medicion: MedicionHistoria = {
      id: raw.id,
      momento: raw.momento as MomentoMedicion,
      estructuraGeneral: raw.estructura_general,
      deltaEstructura,
      registradaEn: toFechaDia(raw.registrada_en),
      autorNombre: raw.profiles?.nombre ?? null,
      valores: raw.medicion_valores.map((v) => ({
        centroId: v.centro_id,
        valor: v.valor,
      })),
    }
    return { medicion, timestamp: raw.registrada_en }
  })
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

const mapEtapasToHistoria = (
  etapasRaw: ReadonlyArray<EtapaHistoriaRaw>,
  asignacionesRaw: ReadonlyArray<AsignacionRaw>,
  today: Date = new Date(),
): ReadonlyArray<EtapaHistoria> => {
  // Día LOCAL: con el día UTC, desde las 21:00 de Argentina "hoy" ya era mañana
  // (BETA-017).
  const todayStr = hoyFechaDia(today)

  const mapped = etapasRaw.map((etapa) => {
    const status = resolveStatus(etapa.estados_etapa?.codigo)
    const fechaFin = etapa.fecha_finalizacion
    const etapaEndStr = fechaFin ?? todayStr
    // An etapa that never started (fecha_inicio null) still existed since it
    // was created — that is its real time window. Anchor internal
    // calculations on it; fechaInicio itself is still exposed as null below.
    const etapaStartStr = etapaSortKey(etapa.fecha_inicio, etapa.created_at)

    // ── diagnostico ──────────────────────────────────────────────────────────
    const causa = etapa.causas
    const algoritmo = etapa.algoritmos
    const bloqueos = etapa.etapa_bloqueos
      .map((row) => row.bloqueos)
      .filter((b): b is BloqueoRaw => b !== null)
      .map((b) => ({
        id: b.id,
        codigo: b.codigo,
        nombre: b.nombre,
        descripcion: b.descripcion ?? '',
        activo: b.activo,
      }))

    const diagnostico = {
      causa: causa
        ? {
            id: causa.id,
            codigo: causa.codigo,
            nombre: causa.nombre,
            definicion: causa.definicion ?? '',
            emocionesEsperadas: parseEmocionesEsperadas(
              causa.emociones_esperadas,
            ),
            activo: causa.activo,
            etapas: [],
          }
        : {
            id: '',
            codigo: '',
            nombre: '',
            definicion: '',
            emocionesEsperadas: [],
            activo: false,
            etapas: [],
          },
      algoritmo: algoritmo
        ? (() => {
            const comportamiento = algoritmo.comportamiento ?? ''
            return {
              id: algoritmo.id,
              codigo: algoritmo.codigo,
              nombre: algoritmo.nombre,
              definicion: algoritmo.definicion ?? '',
              comportamiento,
              comportamientoBadge: truncateComportamiento(comportamiento),
              activo: algoritmo.activo,
              etapas: [],
            }
          })()
        : {
            id: '',
            codigo: '',
            nombre: '',
            definicion: '',
            comportamiento: '',
            comportamientoBadge: '',
            activo: false,
            etapas: [],
          },
      bloqueos,
    }

    // ── modalidad ────────────────────────────────────────────────────────────
    const modalidad = etapa.modalidades
      ? {
          nombre: etapa.modalidades.nombre,
          cantidadNiveles: etapa.modalidades.cantidad_niveles,
          duracionMesesEstimada: etapa.modalidades.duracion_meses_estimada,
        }
      : null

    // ── duracionMeses ────────────────────────────────────────────────────────
    const duracionMeses =
      etapa.fecha_inicio === null
        ? null
        : Math.round(daysBetween(etapa.fecha_inicio, etapaEndStr) / 30.44)

    // ── deltaScoreEtapa ───────────────────────────────────────────────────────
    const evaluatedNiveles = etapa.niveles
      .filter((n) => n.nivel_evaluacion !== null)
      .sort(
        (a, b) =>
          new Date(a.nivel_evaluacion!.fecha_respuesta).getTime() -
          new Date(b.nivel_evaluacion!.fecha_respuesta).getTime(),
      )

    const deltaScoreEtapa =
      evaluatedNiveles.length >= 2
        ? {
            primero: evaluatedNiveles[0].nivel_evaluacion!.score,
            ultimo:
              evaluatedNiveles[evaluatedNiveles.length - 1].nivel_evaluacion!
                .score,
          }
        : null

    // ── responsables ─────────────────────────────────────────────────────────
    const seenTerapeutas = new Set<string>()
    const responsables: TerapeutaResponsable[] = []
    for (const asig of asignacionesRaw) {
      const overlaps = rangesOverlap(
        asig.fecha_desde,
        asig.fecha_hasta,
        etapaStartStr,
        etapaEndStr,
        todayStr,
      )
      // RLS may hide the terapeutas/profiles embed (terapeutas:null for a
      // therapist viewing another therapist's row, DEC-E0-4). Without a name
      // there is nothing to show → skip; responsables collapses to [].
      const nombre = asig.terapeutas?.profiles?.nombre
      if (overlaps && nombre && !seenTerapeutas.has(asig.terapeuta_id)) {
        seenTerapeutas.add(asig.terapeuta_id)
        responsables.push({
          terapeutaId: asig.terapeuta_id,
          nombre,
        })
      }
    }

    // ── mediciones de estructura (medir-chakras/PR2) ────────────────────────────
    const medicionesConTimestamp = mapMedicionesHistoria(
      etapa.mediciones_estructura,
    )
    const medicionesHistoria = medicionesConTimestamp.map((m) => m.medicion)
    const medicionEventos: EventoConClave[] = medicionesConTimestamp.map(
      ({ medicion: m, timestamp }) => ({
        clave: timestamp,
        evento: {
          tipo: 'medicion',
          fecha: m.registradaEn,
          medicionId: m.id,
          momento: m.momento,
          estructuraGeneral: m.estructuraGeneral,
          deltaEstructura: m.deltaEstructura,
        },
      }),
    )

    // ── eventos ───────────────────────────────────────────────────────────────
    // Nivel events — one per nivel, fecha = fecha_respuesta if evaluated, else fecha_seguimiento_esperada.
    // deltaScore is computed against the chronologically previous evaluated nivel.
    const nivelEventos: EventoEvolucion[] = []
    // A nivel with neither an evaluation nor a fecha_seguimiento_esperada
    // (unscheduled niveles of an unstarted etapa, per DEC-E1-4) has no date
    // to place it on the timeline yet — skip it rather than emitting a
    // dateless event.
    const nivelesWithEventDate = etapa.niveles
      .map((n) => ({
        n,
        eventDate:
          n.nivel_evaluacion?.fecha_respuesta ?? n.fecha_seguimiento_esperada,
      }))
      .filter(
        (x): x is { n: NivelRaw; eventDate: string } => x.eventDate !== null,
      )
    nivelesWithEventDate.sort((a, b) =>
      a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0,
    )

    let lastEvaluatedScore: number | null = null
    for (const { n, eventDate } of nivelesWithEventDate) {
      const eval_ = n.nivel_evaluacion
      const score = eval_ ? eval_.score : null
      let deltaScore: number | null = null
      if (eval_ !== null && lastEvaluatedScore !== null) {
        deltaScore = eval_.score - lastEvaluatedScore
      }
      if (eval_ !== null) {
        lastEvaluatedScore = eval_.score
      }
      nivelEventos.push({
        tipo: 'nivel',
        fecha: eventDate,
        numeroNivel: n.numero_nivel,
        score,
        deltaScore,
      })
    }

    // cambio_terapeuta events — skip first visible assignment (baseline rule, DEC-E0-4)
    // Sort by fecha_desde asc; the input is already ordered asc by contract (Q2 order),
    // but sort defensively.
    const cambioEventos: EventoEvolucion[] = []
    const sortedAsig = [...asignacionesRaw].sort((a, b) =>
      a.fecha_desde < b.fecha_desde
        ? -1
        : a.fecha_desde > b.fecha_desde
          ? 1
          : 0,
    )
    for (let i = 1; i < sortedAsig.length; i++) {
      const current = sortedAsig[i]
      const prev = sortedAsig[i - 1]
      // RLS may hide the terapeutas/profiles embed (DEC-E0-4). A cambio_terapeuta
      // event needs both names; if either is unavailable, skip it (a therapist
      // never sees other therapists' identities → no change events).
      const deNombre = prev.terapeutas?.profiles?.nombre
      const aNombre = current.terapeutas?.profiles?.nombre
      // Only emit event if fecha_desde falls in [fechaInicio, etapaEnd]
      if (
        deNombre &&
        aNombre &&
        current.fecha_desde >= etapaStartStr &&
        current.fecha_desde <= etapaEndStr
      ) {
        cambioEventos.push({
          tipo: 'cambio_terapeuta',
          fecha: current.fecha_desde,
          de: deNombre,
          a: aNombre,
          motivo: current.motivo,
        })
      }
    }

    // Merge and sort eventos asc by their full-precision key (nivel and
    // cambio_terapeuta sort by their own fecha; mediciones by the raw
    // registrada_en, since their fecha is normalised to the day — MED-004).
    // Array.prototype.sort is stable, so ties keep the per-kind order.
    const eventos: EventoEvolucion[] = [
      ...nivelEventos.map((evento) => ({ clave: evento.fecha, evento })),
      ...cambioEventos.map((evento) => ({ clave: evento.fecha, evento })),
      ...medicionEventos,
    ]
      .sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0))
      .map(({ evento }) => evento)

    // ── proximaEvaluacion ────────────────────────────────────────────────────
    let proximaEvaluacion: string | null = null
    if (status === EtapaStatus.EN_CURSO) {
      const futureUnevaluated = etapa.niveles
        .filter(
          (n): n is NivelRaw & { fecha_seguimiento_esperada: string } =>
            n.nivel_evaluacion === null &&
            n.fecha_seguimiento_esperada !== null &&
            n.fecha_seguimiento_esperada > todayStr,
        )
        .map((n) => n.fecha_seguimiento_esperada)
        .sort()
      proximaEvaluacion = futureUnevaluated[0] ?? null
    }

    const historia: EtapaHistoria = {
      id: etapa.id,
      status,
      fechaInicio: etapa.fecha_inicio,
      fechaFin: fechaFin,
      diagnostico,
      modalidad,
      responsables,
      eventos,
      duracionMeses,
      deltaScoreEtapa,
      motivoCierre: etapa.motivo_cierre,
      proximaEvaluacion,
      mediciones: medicionesHistoria,
      alfabetos: alfabetosCargadosDeEmbed(etapa.etapa_alfabetos),
    }

    return { historia, etapaStartStr }
  })

  // ── output ordering ───────────────────────────────────────────────────────
  // EN_CURSO first; rest by coalesce(fechaInicio, createdAt) desc — an etapa
  // that never started still sorts by the moment it was created (same rule
  // as etapaOrdinal.ts / the SQL, see the anchor above).
  return mapped
    .sort((a, b) => {
      const aStatus = a.historia.status
      const bStatus = b.historia.status
      if (aStatus === EtapaStatus.EN_CURSO && bStatus !== EtapaStatus.EN_CURSO)
        return -1
      if (bStatus === EtapaStatus.EN_CURSO && aStatus !== EtapaStatus.EN_CURSO)
        return 1
      // both same status bucket — sort by the anchor desc
      return b.etapaStartStr < a.etapaStartStr
        ? -1
        : b.etapaStartStr > a.etapaStartStr
          ? 1
          : 0
    })
    .map((m) => m.historia)
}

export type { EtapaHistoriaRaw, AsignacionRaw }
export { mapEtapasToHistoria }
