import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import type { SlotKey } from '../TratamientoTypes'

// SlotKey/ColumnKey are public entity types — they live in TratamientoTypes.ts
// (frasesAutomaticas/FRA-006) and are re-exported from the entity barrel.
// SlotSource/SlotDefinition stay here: they never leave this file, they only
// exist to shape SLOT_DEFINITIONS below.
type SlotSource =
  | TIPO_CONTENIDO.VIDEO
  | TIPO_CONTENIDO.AUDIO
  | TIPO_CONTENIDO.EGREGOR
  | TIPO_CONTENIDO.CMA
  | TIPO_CONTENIDO.IC

interface SlotDefinition {
  readonly key: SlotKey
  readonly orden: number
  readonly source: SlotSource
}

// This map MUST mirror public.etapa_plan_completo's orden filter (1..5) and
// public.set_entregas_plan's tipo-per-orden validation (DEC-8,
// 71_rpcs_pacientes.sql) EXACTLY. SQL cannot import TypeScript, so the map
// necessarily lives in both places — slotDefinitions.test.ts pins this exact
// array so an edit here without opening the SQL fails review, not production.
const SLOT_DEFINITIONS: ReadonlyArray<SlotDefinition> = [
  { key: 'meditacion', orden: 1, source: TIPO_CONTENIDO.VIDEO },
  { key: 'mantra', orden: 2, source: TIPO_CONTENIDO.AUDIO },
  { key: 'egregor', orden: 3, source: TIPO_CONTENIDO.EGREGOR },
  { key: 'cma', orden: 4, source: TIPO_CONTENIDO.CMA },
  { key: 'ic', orden: 5, source: TIPO_CONTENIDO.IC },
]

const SLOT_KEYS: ReadonlyArray<SlotKey> = SLOT_DEFINITIONS.map((d) => d.key)

/**
 * Shared grid track template for the weekly plan table. The header (PlanEnviosCard)
 * and each data row (SemanaRow) are INDEPENDENT grids, so they only stay aligned if
 * every grid computes identical column widths — hence one shared source of truth.
 *
 * The flexible tracks use `minmax(0, ...)` (not a bare `1fr`, which is
 * `minmax(auto, 1fr)`): the `auto` minimum lets a long value (e.g. a long frase)
 * widen its column past its share, so that row desfases from the header and the
 * other rows. `minmax(0, ...)` pins the minimum to 0 so content truncates instead
 * of widening the column, keeping every grid identical and aligned. This now
 * applies to the truncated trigger of the frases popover (Task 1.2), not a combobox.
 * Columns: Semana · Meditación · Mantra · Egregor · CMA · IC · Frases. With 7
 * tracks the desync risk a bare `1fr` would introduce is stronger, not weaker
 * — every flexible track keeps `minmax(0, ...)`.
 *
 * The 6 content tracks are equal (BETA-026): Frases used to take 1.2fr, which
 * narrowed the 5 comboboxes on a screen where the grid already had to fit
 * ~1064px (1440 minus the sidebar and paddings).
 */
const SEMANA_GRID_TEMPLATE = '96px repeat(6, minmax(0, 1fr))'

export type { SlotSource, SlotDefinition }
export { SLOT_DEFINITIONS, SLOT_KEYS, SEMANA_GRID_TEMPLATE }
