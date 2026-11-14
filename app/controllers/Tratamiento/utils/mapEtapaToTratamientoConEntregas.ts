import { mapEtapaToTratamiento } from './mapEtapaToTratamiento'
import type { EtapaTratamientoRaw } from './mapEtapaToTratamiento'
import type {
  Tratamiento,
  EntregaSemanal,
  FraseDerivada,
  FrasesPorSemana,
} from '../TratamientoTypes'
import { mapContenidoRow } from '@/app/controllers/Contenido'
import type { Contenido, ContenidoRowRaw } from '@/app/controllers/Contenido'
import { semanasDeTratamiento } from './semanasDeTratamiento'

interface EntregaPlanRawRow {
  readonly dia_offset: number
  readonly orden: number
  readonly contenido: ContenidoRowRaw | null
}

interface EtapaConEntregasRow extends EtapaTratamientoRaw {
  readonly modalidades: {
    readonly cantidad_niveles: number
  }
  readonly entregas_plan: ReadonlyArray<EntregaPlanRawRow>
}

// Raw row shape of get_frases_del_tratamiento_activo, grouped by semana.
// Private to this entity (Rule 5) — never re-exported from index.ts. The
// inner frase items reuse the public FraseDerivada shape as-is (orden/origen/
// texto pass through unchanged from the RPC to the domain type).
interface FrasesPorSemanaRawRow {
  readonly semana: number
  readonly frases: ReadonlyArray<FraseDerivada>
}

interface MapEtapaToTratamientoConEntregasResult {
  readonly tratamiento: Tratamiento | null
  readonly semanasTotales: number | null
  readonly cantidadNiveles: number | null
  readonly frasesPorSemana: FrasesPorSemana
}

const mapEtapaToTratamientoConEntregas = (
  raw: EtapaConEntregasRow,
  frasesPorSemanaRaw: ReadonlyArray<FrasesPorSemanaRawRow> = [],
): MapEtapaToTratamientoConEntregasResult => {
  // Built directly from the RPC rows — independent of whether the etapa has
  // ANY entregas_plan rows yet. This is what lets a just-diagnosed paciente
  // (empty plan, 16 content-less weeks) show its 3 derived frases per week
  // from the very first render of the asignador (frasesAutomaticas/epic-1,
  // Task 1.2 — widens the Task 0.4 gap where frases only merged onto weeks
  // that already had content). Built mutable, exposed as `FrasesPorSemana`
  // (readonly) once complete.
  const frasesPorSemanaBuilder: Record<
    number,
    ReadonlyArray<FraseDerivada>
  > = {}
  for (const row of frasesPorSemanaRaw) {
    frasesPorSemanaBuilder[row.semana] = row.frases
  }
  const frasesPorSemana: FrasesPorSemana = frasesPorSemanaBuilder

  const base = mapEtapaToTratamiento(raw)
  if (base === null) {
    return {
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
    }
  }

  const cantidadNiveles = raw.modalidades.cantidad_niveles
  // semanasTotales = cantidad_niveles * 4 (single source of truth). cantidad_sesiones
  // is clinical metadata and never defines our content weeks. Ver semanasDeTratamiento.
  const semanasTotales = semanasDeTratamiento(cantidadNiveles)

  // Map each row to its domain piece (a contenido media item). Rows whose
  // join is null or whose contenido tipo is unsupported are skipped. The
  // manual frase join is retired — frases are now auto-derived and exposed
  // only via the sibling `frasesPorSemana` return value (frasesAutomaticas/
  // FRA-005), never sourced from entregas_plan and never merged onto
  // EntregaSemanal.
  type SurvivingRow = {
    diaOffset: number
    orden: number
    contenido: Contenido
    numeroSemana: number
  }

  const surviving: SurvivingRow[] = []
  for (const row of raw.entregas_plan) {
    const mapped: Contenido | null =
      row.contenido !== null ? mapContenidoRow(row.contenido) : null
    if (mapped === null) continue
    surviving.push({
      diaOffset: row.dia_offset,
      orden: row.orden,
      contenido: mapped,
      numeroSemana: Math.floor(row.dia_offset / 7) + 1,
    })
  }

  // Sort by (orden, dia_offset) ascending
  surviving.sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.diaOffset - b.diaOffset
  })

  // Group by numeroSemana
  const byWeek = new Map<number, typeof surviving>()
  for (const row of surviving) {
    const group = byWeek.get(row.numeroSemana)
    if (group === undefined) {
      byWeek.set(row.numeroSemana, [row])
    } else {
      group.push(row)
    }
  }

  const entregasSemanales: ReadonlyArray<EntregaSemanal> = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, rows]) => ({
      id: `semana-${n}`,
      numeroSemana: n,
      fechaEntregada: null,
      fechaEntregaEsperada: null,
      contenido: rows.map((r) => r.contenido),
    }))

  return {
    tratamiento: {
      ...base,
      entregasSemanales,
    },
    semanasTotales,
    cantidadNiveles,
    frasesPorSemana,
  }
}

export type { EtapaConEntregasRow, FrasesPorSemanaRawRow }
export { mapEtapaToTratamientoConEntregas }
